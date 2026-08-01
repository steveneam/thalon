import { readEnv } from "@thalon/platform";
import { describe, expect, it } from "vitest";
import {
  createYouTubeDriver,
  productionSocialDrivers,
  productionSocialPublisherResolver,
  SocialDriverApiError,
  SocialTokenExpiredError,
  youtubeDerivedTitle,
  YouTubeExtraMediaUnsupportedError,
  YouTubeMadeForKidsUndeclaredError,
  YouTubeVideoRequiredError,
} from "../drivers";
import { isRefusingSocialPublisher, resolveSocialPublisher, type SocialPostInput } from "../registry";

/**
 * s90 (youtube-destination lane): the YouTube driver suite — BUILT, never
 * live (the drivers.test.ts discipline). Every fetch is an injected capture
 * pinning the exact wire shape of the official `videos.insert` resumable
 * dance; every refusal proves the credential never leaks and that NOTHING
 * in this lane can arm the platform.
 */

const TOKEN = "tok_youtube_secret_never_logged";
const VIDEO = { bytes: Buffer.from("not-really-an-mp4"), contentType: "video/mp4" };
const INPUT: SocialPostInput = {
  draftId: "draft-yt-1",
  text: "Three ways trades businesses turn their site into local work.\nThe long version, with numbers.",
  media: [VIDEO],
  settings: { maxPostsPerDay: 1, madeForKids: false },
};

interface SeenRequest {
  url: string;
  init: RequestInit;
}

function capture(routes: (url: string, init: RequestInit) => Response) {
  const seen: SeenRequest[] = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    seen.push({ url: String(url), init: init ?? {} });
    return routes(String(url), init ?? {});
  };
  return { seen, fetchImpl };
}

const UPLOAD_URL = "https://yt.example/upload-session-1";

function routes(opts: { session?: () => Response; upload?: () => Response } = {}) {
  return capture((url) => {
    if (url.includes("uploadType=resumable")) {
      return (
        opts.session?.() ??
        new Response("", { status: 200, headers: { location: UPLOAD_URL } })
      );
    }
    return opts.upload?.() ?? new Response(JSON.stringify({ id: "yt-vid-1" }), { status: 200 });
  });
}

function driver(fetchImpl: typeof fetch) {
  return createYouTubeDriver({
    accessToken: TOKEN,
    baseUrl: "https://yt.example",
    fetchImpl,
    sleep: async () => {},
  });
}

async function apiError(promise: Promise<unknown>): Promise<SocialDriverApiError> {
  const rejection = await promise.then(
    () => {
      throw new Error("expected a rejection");
    },
    (err) => err,
  );
  expect(rejection).toBeInstanceOf(SocialDriverApiError);
  return rejection as SocialDriverApiError;
}

describe("youtubeDerivedTitle (title = first line, the Reddit derivation)", () => {
  it("takes the body's first line", () => {
    expect(youtubeDerivedTitle("A headline\nBody line one.")).toBe("A headline");
  });

  it("a >100-char first line clamps with an ellipsis", () => {
    const derived = youtubeDerivedTitle("x".repeat(150));
    expect(derived.length).toBe(100);
    expect(derived.endsWith("…")).toBe(true);
  });
});

describe("createYouTubeDriver (official videos.insert, resumable)", () => {
  it("happy path: metadata POST opens the session, bytes PUT to its Location, the video id is the receipt", async () => {
    const { seen, fetchImpl } = routes();
    const receipt = await driver(fetchImpl).publish({
      ...INPUT,
      settings: { madeForKids: false, privacy: "unlisted", title: "A launch note" },
    });

    expect(seen).toHaveLength(2);
    const [session, upload] = seen;
    expect(session.url).toBe(
      "https://yt.example/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    );
    expect(session.init.method).toBe("POST");
    const sessionHeaders = session.init.headers as Record<string, string>;
    expect(sessionHeaders.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(sessionHeaders["X-Upload-Content-Type"]).toBe("video/mp4");
    expect(sessionHeaders["X-Upload-Content-Length"]).toBe(String(VIDEO.bytes.length));
    const metadata = JSON.parse(String(session.init.body));
    expect(metadata).toEqual({
      snippet: { title: "A launch note", description: INPUT.text },
      status: { selfDeclaredMadeForKids: false, privacyStatus: "unlisted" },
    });

    expect(upload.url).toBe(UPLOAD_URL);
    expect(upload.init.method).toBe("PUT");
    expect((upload.init.headers as Record<string, string>)["Content-Type"]).toBe("video/mp4");

    expect(receipt.externalPostId).toBe("yt-vid-1");
    expect(receipt.meta).toEqual({
      permalink: "https://www.youtube.com/watch?v=yt-vid-1",
      apiVersion: "v3",
      madeForKids: false,
      privacy: "unlisted",
    });

    // The token travels ONLY in the Authorization header — never a URL.
    for (const request of seen) {
      expect(request.url).not.toContain(TOKEN);
    }
  });

  it("no title setting: the body's first line titles the video, the FULL body stays the description", async () => {
    const { seen, fetchImpl } = routes();
    await driver(fetchImpl).publish(INPUT);
    const metadata = JSON.parse(String(seen[0].init.body));
    expect(metadata.snippet.title).toBe(
      "Three ways trades businesses turn their site into local work.",
    );
    expect(metadata.snippet.description).toBe(INPUT.text);
  });

  it("the made-for-kids declaration passes through EXACTLY as declared — true stays true", async () => {
    const { seen, fetchImpl } = routes();
    await driver(fetchImpl).publish({ ...INPUT, settings: { madeForKids: true } });
    const metadata = JSON.parse(String(seen[0].init.body));
    expect(metadata.status.selfDeclaredMadeForKids).toBe(true);
    expect(metadata.status.privacyStatus).toBeUndefined();
  });

  it("an UNDECLARED made-for-kids refuses typed before any network call — never defaulted", async () => {
    const { seen, fetchImpl } = routes();
    await expect(
      driver(fetchImpl).publish({ ...INPUT, settings: { maxPostsPerDay: 1 } }),
    ).rejects.toBeInstanceOf(YouTubeMadeForKidsUndeclaredError);
    // A malformed settings block reads as NO settings, which fails the same
    // safe way: undeclared, refused.
    await expect(
      driver(fetchImpl).publish({ ...INPUT, settings: { madeForKids: "yes" as never } }),
    ).rejects.toBeInstanceOf(YouTubeMadeForKidsUndeclaredError);
    expect(seen).toHaveLength(0);
  });

  it("a TEXT-ONLY post refuses typed — a video is the medium", async () => {
    const { seen, fetchImpl } = routes();
    await expect(
      driver(fetchImpl).publish({ ...INPUT, media: undefined }),
    ).rejects.toBeInstanceOf(YouTubeVideoRequiredError);
    expect(seen).toHaveLength(0);
  });

  it("an IMAGE-ONLY post refuses typed — an image cannot satisfy the video demand", async () => {
    const { fetchImpl } = routes();
    await expect(
      driver(fetchImpl).publish({
        ...INPUT,
        media: [{ bytes: Buffer.from("jpg"), contentType: "image/jpeg" }],
      }),
    ).rejects.toBeInstanceOf(YouTubeVideoRequiredError);
  });

  it("media beside the video refuses typed rather than being silently dropped", async () => {
    const { seen, fetchImpl } = routes();
    await expect(
      driver(fetchImpl).publish({
        ...INPUT,
        media: [VIDEO, { bytes: Buffer.from("jpg"), contentType: "image/jpeg" }],
      }),
    ).rejects.toBeInstanceOf(YouTubeExtraMediaUnsupportedError);
    expect(seen).toHaveLength(0);
  });

  it("a configured title over the platform's 100 refuses, naming both numbers", async () => {
    const { fetchImpl } = routes();
    const err = await apiError(
      driver(fetchImpl).publish({
        ...INPUT,
        settings: { madeForKids: false, title: "t".repeat(120) },
      }),
    );
    expect(err.message).toContain("120");
    expect(err.message).toContain("100");
  });

  it("angle brackets refuse pre-call — the platform bars them and the driver never rewrites approved words", async () => {
    const { seen, fetchImpl } = routes();
    const err = await apiError(
      driver(fetchImpl).publish({ ...INPUT, text: "AI < humans? A study." }),
    );
    expect(err.message).toContain('"<"');
    expect(seen).toHaveLength(0);
  });

  it("the 5000 ceiling is BYTES: a body that passes a character count still refuses when its bytes exceed it", async () => {
    const { fetchImpl } = routes();
    // 3000 characters — inside the fit gate's character ceiling — but é is
    // two UTF-8 bytes, so the platform sees 6000.
    const err = await apiError(
      driver(fetchImpl).publish({ ...INPUT, text: "é".repeat(3000) }),
    );
    expect(err.message).toContain("6000 bytes");
    expect(err.message).toContain("5000");
  });

  it("a session with no Location upload URL refuses — nothing provably started", async () => {
    const { fetchImpl } = routes({ session: () => new Response("", { status: 200 }) });
    const err = await apiError(driver(fetchImpl).publish(INPUT));
    expect(err.message).toContain("Location");
  });

  it("a 2xx upload without a video id refuses — never treated as posted", async () => {
    const { fetchImpl } = routes({
      upload: () => new Response(JSON.stringify({ kind: "youtube#video" }), { status: 200 }),
    });
    const err = await apiError(driver(fetchImpl).publish(INPUT));
    expect(err.message).toContain("without a video id");
  });

  it("a dead token surfaces as the typed refresh signal, and the secret never leaks", async () => {
    const { fetchImpl } = routes({
      session: () => new Response("Invalid Credentials", { status: 401 }),
    });
    const rejection = await driver(fetchImpl)
      .publish(INPUT)
      .catch((err) => err);
    expect(rejection).toBeInstanceOf(SocialTokenExpiredError);
    expect((rejection as Error).message).not.toContain(TOKEN);
  });
});

describe("youtube arming — structurally impossible until the Google portal-app window (s90)", () => {
  it("the bare ratchet names both missing arms", () => {
    const publisher = resolveSocialPublisher("youtube", {}, productionSocialDrivers(readEnv({})));
    expect(publisher.name).toBe("disarmed");
    if (!isRefusingSocialPublisher(publisher)) throw new Error("unreachable");
    expect(publisher.refusal.message).toContain("SOCIAL_YOUTUBE_ACCESS_TOKEN");
    expect(publisher.refusal.message).toContain("SOCIAL_YOUTUBE_ARMED");
  });

  it("even a hand-set env pair cannot arm youtube — no seat exists for it to fill", () => {
    // The platform env schema declares no SOCIAL_YOUTUBE_* pair and the
    // production resolver's source map carries no youtube seats, so a raw
    // process-env pair evaporates before the ratchet ever sees it. This is
    // the lane's "nothing you ship can post", as a test instead of a claim —
    // the seats land with the founder's Google portal-app window.
    const resolve = productionSocialPublisherResolver(
      readEnv({ SOCIAL_YOUTUBE_ACCESS_TOKEN: TOKEN, SOCIAL_YOUTUBE_ARMED: "true" }),
    );
    const publisher = resolve("youtube");
    expect(publisher.name).toBe("disarmed");
    if (!isRefusingSocialPublisher(publisher)) throw new Error("unreachable");
    expect(publisher.refusal.message).toContain("SOCIAL_YOUTUBE_ACCESS_TOKEN");
  });
});
