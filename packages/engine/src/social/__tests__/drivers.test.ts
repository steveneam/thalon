import { readEnv } from "@thalon/platform";
import { describe, expect, it } from "vitest";
import { PublishRefusedError, SocialMediaUnsupportedError } from "../errors";
import {
  createFacebookDriver,
  createInstagramDriver,
  createLinkedInDriver,
  createXDriver,
  FACEBOOK_GRAPH_VERSION,
  InstagramTextOnlyUnsupportedError,
  LINKEDIN_VERSION,
  productionSocialDrivers,
  productionSocialPublisherResolver,
  SocialDriverApiError,
} from "../drivers";
import { isRefusingSocialPublisher, resolveSocialPublisher, type SocialPostInput } from "../registry";

/**
 * B-pub.2 (s65): driver unit suite — BUILT, never live. Every fetch is an
 * injected capture; the assertions pin the exact wire shape (endpoint, API
 * version, auth header, verbatim body) so an accidental payload drift is a
 * red test, and prove the credential never leaks into an error message.
 */

const TOKEN = "tok_secret_never_logged";
const INPUT: SocialPostInput = {
  draftId: "draft-1",
  text: "Three ways trades businesses turn their site into local work. A thread.",
};

interface SeenRequest {
  url: string;
  init: RequestInit;
}

/** An injected fetch that records every request and answers via the routing function. */
function capture(routes: (url: string) => Response) {
  const seen: SeenRequest[] = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    seen.push({ url: String(url), init: init ?? {} });
    return routes(String(url));
  };
  return { seen, fetchImpl };
}

function headersOf(request: SeenRequest): Record<string, string> {
  return request.init.headers as Record<string, string>;
}

async function apiError(promise: Promise<unknown>): Promise<SocialDriverApiError> {
  const rejection = await promise.catch((err) => err);
  expect(rejection).toBeInstanceOf(SocialDriverApiError);
  expect((rejection as Error).message).not.toContain(TOKEN);
  return rejection as SocialDriverApiError;
}

describe("createLinkedInDriver (versioned REST Posts API, author from userinfo)", () => {
  const routes = (opts: { userinfo?: () => Response; post?: () => Response } = {}) =>
    capture((url) => {
      if (url.endsWith("/v2/userinfo")) {
        return (
          opts.userinfo?.() ?? new Response(JSON.stringify({ sub: "AbC123" }), { status: 200 })
        );
      }
      return (
        opts.post?.() ??
        new Response(null, { status: 201, headers: { "x-restli-id": "urn:li:share:42" } })
      );
    });

  it("accepted → receipt with the platform's post URN; both requests pinned (endpoint, version, auth, verbatim commentary)", async () => {
    const { seen, fetchImpl } = routes();
    const driver = createLinkedInDriver({ accessToken: TOKEN, fetchImpl });
    expect(driver.platform).toBe("linkedin");

    const receipt = await driver.publish(INPUT);
    expect(receipt.externalPostId).toBe("urn:li:share:42");
    expect(receipt.meta).toEqual({
      authorUrn: "urn:li:person:AbC123",
      permalink: "https://www.linkedin.com/feed/update/urn:li:share:42",
      apiVersion: LINKEDIN_VERSION,
    });

    expect(seen).toHaveLength(2);
    expect(seen[0].url).toBe("https://api.linkedin.com/v2/userinfo");
    expect(headersOf(seen[0]).Authorization).toBe(`Bearer ${TOKEN}`);

    expect(seen[1].url).toBe("https://api.linkedin.com/rest/posts");
    expect(seen[1].init.method).toBe("POST");
    const headers = headersOf(seen[1]);
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(headers["LinkedIn-Version"]).toBe(LINKEDIN_VERSION);
    expect(headers["X-Restli-Protocol-Version"]).toBe("2.0.0");
    expect(JSON.parse(String(seen[1].init.body))).toEqual({
      author: "urn:li:person:AbC123",
      commentary: INPUT.text,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByViewer: false,
    });
  });

  it("a userinfo failure surfaces as the typed error carrying platform + status + detail — no post attempt", async () => {
    const { seen, fetchImpl } = routes({
      userinfo: () => new Response("token revoked", { status: 401 }),
    });
    const driver = createLinkedInDriver({ accessToken: TOKEN, fetchImpl });
    const err = await apiError(driver.publish(INPUT));
    expect(err.platform).toBe("linkedin");
    expect(err.status).toBe(401);
    expect(err.message).toContain("token revoked");
    expect(seen).toHaveLength(1);
  });

  it("a userinfo 2xx without a `sub` claim refuses — no author, no post", async () => {
    const { seen, fetchImpl } = routes({
      userinfo: () => new Response(JSON.stringify({}), { status: 200 }),
    });
    const driver = createLinkedInDriver({ accessToken: TOKEN, fetchImpl });
    const err = await apiError(driver.publish(INPUT));
    expect(err.message).toContain("sub");
    expect(seen).toHaveLength(1);
  });

  it("a create-post non-2xx surfaces as the typed error with the platform's own message", async () => {
    const { fetchImpl } = routes({
      post: () => new Response("commentary exceeds limits", { status: 422 }),
    });
    const driver = createLinkedInDriver({ accessToken: TOKEN, fetchImpl });
    const err = await apiError(driver.publish(INPUT));
    expect(err.status).toBe(422);
    expect(err.message).toContain("commentary exceeds limits");
  });

  it("a 2xx create without the x-restli-id URN is refused — a post is only a post with the platform's id", async () => {
    const { fetchImpl } = routes({ post: () => new Response(null, { status: 201 }) });
    const driver = createLinkedInDriver({ accessToken: TOKEN, fetchImpl });
    const err = await apiError(driver.publish(INPUT));
    expect(err.message).toContain("x-restli-id");
  });
});

describe("createXDriver (official v2 create-post)", () => {
  it("accepted → receipt with the platform's id; request pinned (endpoint, bearer auth, verbatim text)", async () => {
    const { seen, fetchImpl } = capture(
      () => new Response(JSON.stringify({ data: { id: "1801", text: INPUT.text } }), { status: 201 }),
    );
    const driver = createXDriver({ accessToken: TOKEN, fetchImpl });
    expect(driver.platform).toBe("x");

    const receipt = await driver.publish(INPUT);
    expect(receipt.externalPostId).toBe("1801");
    expect(receipt.meta).toEqual({ permalink: "https://x.com/i/web/status/1801" });

    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe("https://api.x.com/2/tweets");
    expect(seen[0].init.method).toBe("POST");
    expect(headersOf(seen[0]).Authorization).toBe(`Bearer ${TOKEN}`);
    // The body is EXACTLY { text } — the judged body verbatim, nothing else.
    expect(JSON.parse(String(seen[0].init.body))).toEqual({ text: INPUT.text });
  });

  it("a non-2xx surfaces as the typed error carrying platform + status + the platform's message", async () => {
    const { fetchImpl } = capture(
      () =>
        new Response(JSON.stringify({ title: "Forbidden", detail: "not permitted" }), {
          status: 403,
        }),
    );
    const driver = createXDriver({ accessToken: TOKEN, fetchImpl });
    const err = await apiError(driver.publish(INPUT));
    expect(err.platform).toBe("x");
    expect(err.status).toBe(403);
    expect(err.message).toContain("not permitted");
  });

  it("a 2xx without an accepted-post id is refused", async () => {
    const { fetchImpl } = capture(() => new Response(JSON.stringify({}), { status: 201 }));
    const driver = createXDriver({ accessToken: TOKEN, fetchImpl });
    const err = await apiError(driver.publish(INPUT));
    expect(err.message).toContain("without an accepted-post id");
  });
});

describe("createFacebookDriver (Graph API Page feed post)", () => {
  const PAGE_ID = "1029384756";

  it("accepted → receipt with the composite post id; request pinned (versioned endpoint, bearer auth, verbatim message)", async () => {
    const { seen, fetchImpl } = capture(
      () => new Response(JSON.stringify({ id: "1029384756_555" }), { status: 200 }),
    );
    const driver = createFacebookDriver({ accessToken: TOKEN, pageId: PAGE_ID, fetchImpl });
    expect(driver.platform).toBe("facebook");

    const receipt = await driver.publish(INPUT);
    expect(receipt.externalPostId).toBe("1029384756_555");
    expect(receipt.meta).toEqual({
      permalink: "https://www.facebook.com/1029384756_555",
      apiVersion: FACEBOOK_GRAPH_VERSION,
    });

    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe(
      `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/${PAGE_ID}/feed`,
    );
    expect(seen[0].init.method).toBe("POST");
    expect(headersOf(seen[0]).Authorization).toBe(`Bearer ${TOKEN}`);
    const body = new URLSearchParams(String(seen[0].init.body));
    expect(body.get("message")).toBe(INPUT.text);
    // The token rides ONLY the header — never the URL or body, where it would leak into logs.
    expect(seen[0].url).not.toContain(TOKEN);
    expect(String(seen[0].init.body)).not.toContain(TOKEN);
  });

  it("a non-2xx surfaces as the typed error carrying platform + status + the platform's message", async () => {
    const { fetchImpl } = capture(
      () =>
        new Response(JSON.stringify({ error: { message: "Invalid OAuth access token" } }), {
          status: 400,
        }),
    );
    const driver = createFacebookDriver({ accessToken: TOKEN, pageId: PAGE_ID, fetchImpl });
    const err = await apiError(driver.publish(INPUT));
    expect(err.platform).toBe("facebook");
    expect(err.status).toBe(400);
    expect(err.message).toContain("Invalid OAuth access token");
  });

  it("a 2xx without an accepted-post id is refused", async () => {
    const { fetchImpl } = capture(() => new Response(JSON.stringify({}), { status: 200 }));
    const driver = createFacebookDriver({ accessToken: TOKEN, pageId: PAGE_ID, fetchImpl });
    const err = await apiError(driver.publish(INPUT));
    expect(err.message).toContain("without an accepted-post id");
  });
});

describe("createInstagramDriver (the honesty case — text-only has no IG form)", () => {
  it("publish refuses with the typed media-required error — a PublishRefusedError, never infrastructure failure", async () => {
    const driver = createInstagramDriver({ accessToken: TOKEN, igUserId: "17841400000000000" });
    expect(driver.platform).toBe("instagram");
    expect(driver.name).toBe("instagram-text-refusal");

    const rejection = await driver.publish(INPUT).catch((err) => err);
    expect(rejection).toBeInstanceOf(InstagramTextOnlyUnsupportedError);
    expect(rejection).toBeInstanceOf(PublishRefusedError);
    expect((rejection as InstagramTextOnlyUnsupportedError).refusal).toBe(
      "platform_requires_media",
    );
    expect((rejection as InstagramTextOnlyUnsupportedError).draftId).toBe(INPUT.draftId);
    expect((rejection as Error).message).toContain("requires image or video media");
    expect((rejection as Error).message).not.toContain(TOKEN);
  });
});

describe("productionSocialDrivers (assembly — extras decide which factories exist)", () => {
  const FULL_EXTRAS = {
    SOCIAL_FACEBOOK_PAGE_ID: "1029384756",
    SOCIAL_INSTAGRAM_USER_ID: "17841400000000000",
  };

  it("with every extra set: linkedin, x, facebook, instagram — and NEVER tiktok (out of scope, review-gated)", () => {
    const drivers = productionSocialDrivers(readEnv(FULL_EXTRAS));
    expect(Object.keys(drivers).sort()).toEqual(["facebook", "instagram", "linkedin", "x"]);
    expect(drivers.tiktok).toBeUndefined();
  });

  it("with no extras: only the extra-less linkedin + x factories assemble", () => {
    const drivers = productionSocialDrivers(readEnv({}));
    expect(Object.keys(drivers).sort()).toEqual(["linkedin", "x"]);
  });

  it("facebook without its page-id extra is driverless — the ladder names the missing driver even fully env-armed", () => {
    const env = {
      SOCIAL_FACEBOOK_ACCESS_TOKEN: TOKEN,
      SOCIAL_FACEBOOK_ARMED: "true",
    };
    const publisher = resolveSocialPublisher("facebook", env, productionSocialDrivers(readEnv(env)));
    expect(publisher.name).toBe("disarmed");
    if (!isRefusingSocialPublisher(publisher)) throw new Error("unreachable");
    expect(publisher.refusal.message).toContain("facebook driver");
  });

  it("each armed platform resolves ITS driver through the untouched ratchet", () => {
    const env = {
      ...FULL_EXTRAS,
      SOCIAL_LINKEDIN_ACCESS_TOKEN: TOKEN,
      SOCIAL_LINKEDIN_ARMED: "true",
      SOCIAL_X_ACCESS_TOKEN: TOKEN,
      SOCIAL_X_ARMED: "true",
      SOCIAL_FACEBOOK_ACCESS_TOKEN: TOKEN,
      SOCIAL_FACEBOOK_ARMED: "true",
      SOCIAL_INSTAGRAM_ACCESS_TOKEN: TOKEN,
      SOCIAL_INSTAGRAM_ARMED: "true",
    };
    const drivers = productionSocialDrivers(readEnv(env));
    expect(resolveSocialPublisher("linkedin", env, drivers).name).toBe("linkedin-rest-posts");
    expect(resolveSocialPublisher("x", env, drivers).name).toBe("x-v2-create-post");
    expect(resolveSocialPublisher("facebook", env, drivers).name).toBe("facebook-page-feed");
    expect(resolveSocialPublisher("instagram", env, drivers).name).toBe("instagram-text-refusal");
    // TikTok stays behind the ladder with no driver to resolve.
    expect(resolveSocialPublisher("tiktok", env, drivers).name).toBe("disarmed");
  });

  it("an armed instagram is structurally armed yet still refuses every publish with the typed media error", async () => {
    const env = {
      ...FULL_EXTRAS,
      SOCIAL_INSTAGRAM_ACCESS_TOKEN: TOKEN,
      SOCIAL_INSTAGRAM_ARMED: "true",
    };
    const publisher = resolveSocialPublisher(
      "instagram",
      env,
      productionSocialDrivers(readEnv(env)),
    );
    expect(isRefusingSocialPublisher(publisher)).toBe(false);
    await expect(publisher.publish(INPUT)).rejects.toBeInstanceOf(
      InstagramTextOnlyUnsupportedError,
    );
  });
});

describe("productionSocialPublisherResolver (s67 — the production caller's one-stop wiring)", () => {
  it("default env: every platform resolves to a refusing publisher naming its missing arms", () => {
    const resolve = productionSocialPublisherResolver(readEnv({}));
    const publisher = resolve("linkedin");
    expect(publisher.name).toBe("disarmed");
    if (!isRefusingSocialPublisher(publisher)) throw new Error("unreachable");
    expect(publisher.refusal.message).toContain("SOCIAL_LINKEDIN_ACCESS_TOKEN");
    expect(publisher.refusal.message).toContain("SOCIAL_LINKEDIN_ARMED");
  });

  it("an armed pair resolves ITS live driver — the validated env's SOCIAL_* keys reach the ratchet", () => {
    const resolve = productionSocialPublisherResolver(
      readEnv({ SOCIAL_LINKEDIN_ACCESS_TOKEN: TOKEN, SOCIAL_LINKEDIN_ARMED: "true" }),
    );
    expect(resolve("linkedin").name).toBe("linkedin-rest-posts");
    // Arming one platform arms ONLY that platform.
    expect(resolve("x").name).toBe("disarmed");
  });

  it("facebook armed without its PAGE_ID extra still refuses (no factory assembled); with it, the driver resolves", () => {
    const armed = {
      SOCIAL_FACEBOOK_ACCESS_TOKEN: TOKEN,
      SOCIAL_FACEBOOK_ARMED: "true",
    };
    const without = productionSocialPublisherResolver(readEnv(armed))("facebook");
    expect(without.name).toBe("disarmed");
    if (!isRefusingSocialPublisher(without)) throw new Error("unreachable");
    expect(without.refusal.message).toContain("facebook driver");

    const withExtra = productionSocialPublisherResolver(
      readEnv({ ...armed, SOCIAL_FACEBOOK_PAGE_ID: "1029384756" }),
    )("facebook");
    expect(withExtra.name).toBe("facebook-page-feed");
  });
});

describe("LinkedIn media leg (B-pub.3): initializeUpload → PUT bytes → post carries the image URN", () => {
  const IMAGE_URN = "urn:li:image:IMG1";
  const UPLOAD_URL = "https://upload.linkedin.example/img-1";
  const MEDIA_INPUT: SocialPostInput = {
    ...INPUT,
    media: [
      {
        bytes: Buffer.from("fake-png-bytes"),
        contentType: "image/png",
        altText: "Three-panel horse drawing",
      },
    ],
  };

  const mediaRoutes = (
    opts: { init?: () => Response; upload?: () => Response; post?: () => Response } = {},
  ) =>
    capture((url) => {
      if (url.endsWith("/v2/userinfo")) {
        return new Response(JSON.stringify({ sub: "AbC123" }), { status: 200 });
      }
      if (url.includes("/rest/images")) {
        return (
          opts.init?.() ??
          new Response(JSON.stringify({ value: { uploadUrl: UPLOAD_URL, image: IMAGE_URN } }), {
            status: 200,
          })
        );
      }
      if (url === UPLOAD_URL) {
        return opts.upload?.() ?? new Response(null, { status: 201 });
      }
      return (
        opts.post?.() ??
        new Response(null, { status: 201, headers: { "x-restli-id": "urn:li:share:99" } })
      );
    });

  it("accepted → four pinned requests; the post body carries content.media.id + altText, commentary verbatim", async () => {
    const { seen, fetchImpl } = mediaRoutes();
    const driver = createLinkedInDriver({ accessToken: TOKEN, fetchImpl });

    const receipt = await driver.publish(MEDIA_INPUT);
    expect(receipt.externalPostId).toBe("urn:li:share:99");

    expect(seen.map((r) => r.url)).toEqual([
      "https://api.linkedin.com/v2/userinfo",
      "https://api.linkedin.com/rest/images?action=initializeUpload",
      UPLOAD_URL,
      "https://api.linkedin.com/rest/posts",
    ]);

    const init = seen[1];
    expect(init.init.method).toBe("POST");
    expect(headersOf(init)["LinkedIn-Version"]).toBe(LINKEDIN_VERSION);
    expect(JSON.parse(String(init.init.body))).toEqual({
      initializeUploadRequest: { owner: "urn:li:person:AbC123" },
    });

    const upload = seen[2];
    expect(upload.init.method).toBe("PUT");
    expect(headersOf(upload)["Content-Type"]).toBe("application/octet-stream");
    expect(Buffer.from(upload.init.body as Uint8Array).equals(MEDIA_INPUT.media![0].bytes)).toBe(
      true,
    );

    const post = JSON.parse(String(seen[3].init.body)) as Record<string, unknown>;
    expect(post.commentary).toBe(INPUT.text);
    expect(post.content).toEqual({
      media: { id: IMAGE_URN, altText: "Three-panel horse drawing" },
    });
  });

  it("initializeUpload refusal surfaces as SocialDriverApiError — the post request is never made", async () => {
    const { seen, fetchImpl } = mediaRoutes({
      init: () => new Response(JSON.stringify({ message: "denied" }), { status: 403 }),
    });
    const driver = createLinkedInDriver({ accessToken: TOKEN, fetchImpl });
    const error = await apiError(driver.publish(MEDIA_INPUT));
    expect(error.status).toBe(403);
    expect(seen.some((r) => r.url.endsWith("/rest/posts"))).toBe(false);
  });

  it("a failed byte upload surfaces as SocialDriverApiError — the post request is never made", async () => {
    const { seen, fetchImpl } = mediaRoutes({
      upload: () => new Response(null, { status: 500 }),
    });
    const driver = createLinkedInDriver({ accessToken: TOKEN, fetchImpl });
    const error = await apiError(driver.publish(MEDIA_INPUT));
    expect(error.status).toBe(500);
    expect(seen.some((r) => r.url.endsWith("/rest/posts"))).toBe(false);
  });

  it("a text-only input still makes exactly two requests — the media leg is structurally absent", async () => {
    const { seen, fetchImpl } = mediaRoutes();
    const driver = createLinkedInDriver({ accessToken: TOKEN, fetchImpl });
    await driver.publish(INPUT);
    expect(seen.map((r) => r.url)).toEqual([
      "https://api.linkedin.com/v2/userinfo",
      "https://api.linkedin.com/rest/posts",
    ]);
  });

  it("x and facebook refuse a media input with SocialMediaUnsupportedError BEFORE any network call", async () => {
    const neverFetch: typeof fetch = async () => {
      throw new Error("the media guard must refuse before any call");
    };
    for (const driver of [
      createXDriver({ accessToken: TOKEN, fetchImpl: neverFetch }),
      createFacebookDriver({ accessToken: TOKEN, pageId: "42", fetchImpl: neverFetch }),
    ]) {
      const rejection = await driver.publish(MEDIA_INPUT).catch((err: Error) => err);
      expect(rejection).toBeInstanceOf(SocialMediaUnsupportedError);
      expect((rejection as SocialMediaUnsupportedError).platform).toBe(driver.platform);
    }
  });
});
