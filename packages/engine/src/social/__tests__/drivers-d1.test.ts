import { describe, expect, it } from "vitest";
import {
  blueskyLinkFacets,
  createBlueskyDriver,
  createRedditDriver,
  hardenedPlatformFetch,
  RedditMediaUnsupportedError,
  redditTitleSplit,
  SocialDriverApiError,
  SocialTokenExpiredError,
} from "../drivers";
import type { SocialPostInput } from "../registry";

/**
 * D1 (s83): the connector-seam driver suite — BUILT, never live (the
 * drivers.test.ts discipline). Every fetch is an injected capture pinning
 * the exact wire shape; every refusal proves the credential never leaks.
 * These two are the FIRST drivers on the hardened platform fetch, so its
 * classification (429-retry · 401 → typed refresh signal · verbatim body)
 * is pinned here too.
 */

const TOKEN = "tok_secret_never_logged";
const APP_PASSWORD = "xxxx-yyyy-zzzz-secret";
const INPUT: SocialPostInput = {
  draftId: "draft-1",
  text: "Three ways trades businesses turn their site into local work.\nThe long version, with numbers.",
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

const instantSleep = async () => {};

describe("hardenedPlatformFetch (the D1 refusal classification)", () => {
  it("429 → honors Retry-After and retries; a later 200 wins", async () => {
    const waits: number[] = [];
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return calls < 3
        ? new Response("slow down", { status: 429, headers: { "retry-after": "7" } })
        : new Response("{}", { status: 200 });
    };
    const res = await hardenedPlatformFetch("reddit", fetchImpl, "https://x/", {}, {
      sleep: async (ms) => {
        waits.push(ms);
      },
    });
    expect(res.ok).toBe(true);
    expect(calls).toBe(3);
    expect(waits).toEqual([7000, 7000]);
  });

  it("429 forever → SocialDriverApiError naming the retry budget and the platform's words", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response("too many requests, friend", { status: 429 });
    await expect(
      hardenedPlatformFetch("reddit", fetchImpl, "https://x/", {}, { sleep: instantSleep }),
    ).rejects.toThrow(/still rate-limited after 2 retries: too many requests, friend/);
  });

  it("401 → SocialTokenExpiredError, never retried", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return new Response("Unauthorized", { status: 401 });
    };
    await expect(
      hardenedPlatformFetch("bluesky", fetchImpl, "https://x/", {}, { sleep: instantSleep }),
    ).rejects.toThrow(SocialTokenExpiredError);
    expect(calls).toBe(1);
  });
});

describe("redditTitleSplit (title = first line, every approved word survives)", () => {
  it("splits a multi-line body: first line titles, remainder is the selftext", () => {
    expect(redditTitleSplit("A headline\nBody line one.\nBody line two.")).toEqual({
      title: "A headline",
      selftext: "Body line one.\nBody line two.",
    });
  });

  it("a single short line is title-only", () => {
    expect(redditTitleSplit("Just this.")).toEqual({ title: "Just this.", selftext: "" });
  });

  it("a >300-char first line clamps the title and keeps the FULL body as selftext", () => {
    const long = "x".repeat(400);
    const split = redditTitleSplit(long);
    expect(split.title.length).toBe(300);
    expect(split.title.endsWith("…")).toBe(true);
    expect(split.selftext).toBe(long);
  });
});

describe("createRedditDriver (official /api/submit, self posts)", () => {
  const routes = (opts: { me?: () => Response; submit?: () => Response } = {}) =>
    capture((url) => {
      if (url.endsWith("/api/v1/me")) {
        return opts.me?.() ?? new Response(JSON.stringify({ name: "steve_ops" }), { status: 200 });
      }
      return (
        opts.submit?.() ??
        new Response(
          JSON.stringify({
            json: { errors: [], data: { name: "t3_abc123", url: "https://reddit.com/r/u_steve_ops/x" } },
          }),
          { status: 200 },
        )
      );
    });

  it("accepted → receipt with the platform's fullname; wire shape pinned (endpoints, UA, auth, form, profile target)", async () => {
    const { seen, fetchImpl } = routes();
    const driver = createRedditDriver({ accessToken: TOKEN, fetchImpl });
    const receipt = await driver.publish(INPUT);
    expect(receipt.externalPostId).toBe("t3_abc123");
    expect(receipt.meta).toEqual({
      target: "u_steve_ops",
      author: "u/steve_ops",
      permalink: "https://reddit.com/r/u_steve_ops/x",
    });
    expect(seen.map((r) => r.url)).toEqual([
      "https://oauth.reddit.com/api/v1/me",
      "https://oauth.reddit.com/api/submit",
    ]);
    const headers = seen[1].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(headers["User-Agent"]).toContain("thalon-engine");
    const form = new URLSearchParams(String(seen[1].init.body));
    expect(form.get("kind")).toBe("self");
    expect(form.get("sr")).toBe("u_steve_ops");
    expect(form.get("title")).toBe("Three ways trades businesses turn their site into local work.");
    expect(form.get("text")).toBe("The long version, with numbers.");
    expect(form.get("api_type")).toBe("json");
  });

  it("a configured subreddit (the tenant's cadence block via settings) beats the profile target", async () => {
    const { seen, fetchImpl } = routes();
    const driver = createRedditDriver({ accessToken: TOKEN, fetchImpl });
    await driver.publish({ ...INPUT, settings: { maxPostsPerDay: 1, subreddit: "smallbusiness" } });
    const form = new URLSearchParams(String(seen[1].init.body));
    expect(form.get("sr")).toBe("smallbusiness");
  });

  it("a structured api_type=json refusal surfaces the platform's own words, token never leaks", async () => {
    const { fetchImpl } = routes({
      submit: () =>
        new Response(
          JSON.stringify({
            json: { errors: [["SUBREDDIT_NOTALLOWED", "you aren't allowed to post there", "sr"]] },
          }),
          { status: 200 },
        ),
    });
    const driver = createRedditDriver({ accessToken: TOKEN, fetchImpl });
    const rejection = await driver.publish(INPUT).catch((err) => err);
    expect(rejection).toBeInstanceOf(SocialDriverApiError);
    expect((rejection as Error).message).toContain("you aren't allowed to post there");
    expect((rejection as Error).message).not.toContain(TOKEN);
  });

  it("media → typed unsupported refusal BEFORE any network call (never a silent text-only post)", async () => {
    const { seen, fetchImpl } = routes();
    const driver = createRedditDriver({ accessToken: TOKEN, fetchImpl });
    await expect(
      driver.publish({
        ...INPUT,
        media: [{ bytes: Buffer.from("png"), contentType: "image/png" }],
      }),
    ).rejects.toThrow(RedditMediaUnsupportedError);
    expect(seen).toHaveLength(0);
  });

  it("an expired token surfaces as the typed refresh signal", async () => {
    const { fetchImpl } = routes({ me: () => new Response("Unauthorized", { status: 401 }) });
    const driver = createRedditDriver({ accessToken: TOKEN, fetchImpl });
    await expect(driver.publish(INPUT)).rejects.toThrow(SocialTokenExpiredError);
  });
});

describe("blueskyLinkFacets (UTF-8 byte offsets, deterministic)", () => {
  it("indexes by BYTES, not code points — a non-ASCII char before the link shifts the span correctly", () => {
    const text = "café → https://example.com/x, then prose";
    const facets = blueskyLinkFacets(text);
    expect(facets).toHaveLength(1);
    const index = facets[0].index as { byteStart: number; byteEnd: number };
    expect(index.byteStart).toBe(Buffer.byteLength("café → ", "utf8"));
    const span = Buffer.from(text, "utf8")
      .subarray(index.byteStart, index.byteEnd)
      .toString("utf8");
    // Trailing comma reads as prose, not address.
    expect(span).toBe("https://example.com/x");
    expect((facets[0].features as Array<{ uri: string }>)[0].uri).toBe("https://example.com/x");
  });

  it("no URL → no facets key material", () => {
    expect(blueskyLinkFacets("plain words only")).toEqual([]);
  });
});

describe("createBlueskyDriver (raw XRPC app-password session)", () => {
  const routes = (opts: { session?: () => Response; create?: () => Response } = {}) =>
    capture((url) => {
      if (url.includes("createSession")) {
        return (
          opts.session?.() ??
          new Response(
            JSON.stringify({ accessJwt: "jwt_1", did: "did:plc:abc", handle: "steve.bsky.social" }),
            { status: 200 },
          )
        );
      }
      if (url.includes("uploadBlob")) {
        return new Response(JSON.stringify({ blob: { $type: "blob", ref: { $link: "bafy" } } }), {
          status: 200,
        });
      }
      return (
        opts.create?.() ??
        new Response(
          JSON.stringify({ uri: "at://did:plc:abc/app.bsky.feed.post/3k44", cid: "bafyrec" }),
          { status: 200 },
        )
      );
    });

  it("accepted → receipt with the at:// uri; session + record pinned (identifier/password body, repo=did, judged text verbatim)", async () => {
    const { seen, fetchImpl } = routes();
    const driver = createBlueskyDriver({
      appPassword: APP_PASSWORD,
      identifier: "steve.bsky.social",
      fetchImpl,
      clock: () => new Date("2026-08-01T09:30:00Z"),
    });
    const receipt = await driver.publish({ draftId: "d", text: "Short and true." });
    expect(receipt.externalPostId).toBe("at://did:plc:abc/app.bsky.feed.post/3k44");
    expect(receipt.meta).toEqual({ cid: "bafyrec", author: "@steve.bsky.social" });
    expect(seen.map((r) => r.url)).toEqual([
      "https://bsky.social/xrpc/com.atproto.server.createSession",
      "https://bsky.social/xrpc/com.atproto.repo.createRecord",
    ]);
    expect(JSON.parse(String(seen[0].init.body))).toEqual({
      identifier: "steve.bsky.social",
      password: APP_PASSWORD,
    });
    const record = JSON.parse(String(seen[1].init.body)) as {
      repo: string;
      collection: string;
      record: { text: string; createdAt: string; facets?: unknown };
    };
    expect(record.repo).toBe("did:plc:abc");
    expect(record.collection).toBe("app.bsky.feed.post");
    expect(record.record.text).toBe("Short and true.");
    expect(record.record.createdAt).toBe("2026-08-01T09:30:00.000Z");
    expect(record.record.facets).toBeUndefined();
    const headers = seen[1].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer jwt_1");
  });

  it("an image uploads as a blob and embeds; the blob call carries the image content type", async () => {
    const { seen, fetchImpl } = routes();
    const driver = createBlueskyDriver({
      appPassword: APP_PASSWORD,
      identifier: "steve.bsky.social",
      fetchImpl,
    });
    await driver.publish({
      draftId: "d",
      text: "With a picture.",
      media: [{ bytes: Buffer.from("png-bytes"), contentType: "image/png", altText: "A drawing" }],
    });
    expect(seen[1].url).toContain("uploadBlob");
    expect((seen[1].init.headers as Record<string, string>)["Content-Type"]).toBe("image/png");
    const record = JSON.parse(String(seen[2].init.body)) as {
      record: { embed?: { $type: string; images: Array<{ alt: string }> } };
    };
    expect(record.record.embed?.$type).toBe("app.bsky.embed.images");
    expect(record.record.embed?.images[0].alt).toBe("A drawing");
  });

  it("a revoked app password (401) surfaces as the typed refresh signal — which for this flavor means reconnect", async () => {
    const { fetchImpl } = routes({
      session: () => new Response("AuthenticationRequired", { status: 401 }),
    });
    const driver = createBlueskyDriver({
      appPassword: APP_PASSWORD,
      identifier: "steve.bsky.social",
      fetchImpl,
    });
    const rejection = await driver
      .publish({ draftId: "d", text: "won't land" })
      .catch((err) => err);
    expect(rejection).toBeInstanceOf(SocialTokenExpiredError);
    expect((rejection as Error).message).not.toContain(APP_PASSWORD);
  });
});
