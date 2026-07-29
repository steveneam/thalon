import { describe, expect, it } from "vitest";
import {
  createBlueskyMetricsReader,
  createFacebookMetricsReader,
  createInstagramMetricsReader,
  createRedditMetricsReader,
  createXMetricsReader,
} from "../../drivers";
import { SocialDriverApiError, SocialTokenExpiredError } from "../../drivers/errors";
import { SocialMetricsPermissionError, SocialMetricsUnreadableError } from "../errors";

/**
 * D2 (s87): the five metrics readers — BUILT, never live (the drivers.test.ts
 * discipline: every platform response here is an injected fake and no test in
 * this file can reach a network).
 *
 * The assertions are mostly about ONE thing, because one thing is what these
 * readers are for: **absence is never zero**. A field the platform omits must
 * produce no sample; a field the platform sends as 0 must produce a sample
 * worth 0. Everything else on the Analytics surface is built on that
 * distinction holding in five separate parsers.
 */

const TOKEN = "tok_secret_never_logged";

interface Seen {
  url: string;
  init: RequestInit;
}

function capture(route: (url: string) => Response) {
  const seen: Seen[] = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    seen.push({ url: String(url), init: init ?? {} });
    return route(String(url));
  };
  return { seen, fetchImpl };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("bluesky metrics reader", () => {
  const session = { accessJwt: "jwt", did: "did:plc:me", handle: "me.bsky.social" };

  it("reads the postView counts and reports the structural absences", async () => {
    const { seen, fetchImpl } = capture((url) =>
      url.includes("createSession")
        ? json(session)
        : json({
            posts: [
              { uri: "at://did:plc:me/app.bsky.feed.post/abc", likeCount: 12, repostCount: 3, replyCount: 4, quoteCount: 1, bookmarkCount: 2 },
            ],
          }),
    );
    const reader = createBlueskyMetricsReader({
      appPassword: TOKEN,
      identifier: "me.bsky.social",
      fetchImpl,
    });
    const report = await reader.fetchPostMetrics({
      externalPostId: "at://did:plc:me/app.bsky.feed.post/abc",
    });

    expect(report.samples).toEqual([
      { label: "likes", value: 12, platformField: "likeCount" },
      { label: "reposts", value: 3, platformField: "repostCount" },
      { label: "replies", value: 4, platformField: "replyCount" },
      { label: "quotes", value: 1, platformField: "quoteCount" },
      { label: "bookmarks", value: 2, platformField: "bookmarkCount" },
    ]);
    // The "no impressions" sentence rides along so the surface can print it.
    expect(report.unavailable.map((u) => u.label)).toEqual(["impressions", "reach"]);
    expect(report.unavailable[0].reason).toContain("no impressions in the API");
    // The post URI travels as a query param, encoded.
    expect(seen[1].url).toContain("app.bsky.feed.getPosts?uris=at%3A%2F%2F");
    // The credential never appears in a URL.
    expect(seen.every((s) => !s.url.includes(TOKEN))).toBe(true);
  });

  it("an OMITTED count yields NO sample; a count of 0 yields a sample worth 0", async () => {
    const { fetchImpl } = capture((url) =>
      url.includes("createSession")
        ? json(session)
        : // An older AppView: no bookmarkCount at all, and a genuinely
          // unliked post reporting a real zero.
          json({ posts: [{ likeCount: 0, repostCount: 5 }] }),
    );
    const reader = createBlueskyMetricsReader({ appPassword: TOKEN, identifier: "me", fetchImpl });
    const report = await reader.fetchPostMetrics({ externalPostId: "at://x" });

    expect(report.samples).toEqual([
      { label: "likes", value: 0, platformField: "likeCount" },
      { label: "reposts", value: 5, platformField: "repostCount" },
    ]);
    expect(report.samples.some((s) => s.label === "bookmarks")).toBe(false);
    expect(report.samples.some((s) => s.label === "replies")).toBe(false);
  });

  it("a deleted post refuses rather than recording nothing-shaped-as-something", async () => {
    const { fetchImpl } = capture((url) =>
      url.includes("createSession") ? json(session) : json({ posts: [] }),
    );
    const reader = createBlueskyMetricsReader({ appPassword: TOKEN, identifier: "me", fetchImpl });
    await expect(reader.fetchPostMetrics({ externalPostId: "at://gone" })).rejects.toThrow(
      SocialMetricsUnreadableError,
    );
  });

  it("a revoked app password surfaces as the hardened fetch's typed 401", async () => {
    const { fetchImpl } = capture(() => new Response("bad password", { status: 401 }));
    const reader = createBlueskyMetricsReader({ appPassword: TOKEN, identifier: "me", fetchImpl });
    await expect(reader.fetchPostMetrics({ externalPostId: "at://x" })).rejects.toThrow(
      SocialTokenExpiredError,
    );
  });
});

describe("x metrics reader", () => {
  it("asks for public_metrics and reads every count it returns", async () => {
    const { seen, fetchImpl } = capture(() =>
      json({
        data: [
          {
            id: "1",
            public_metrics: {
              impression_count: 4200,
              like_count: 31,
              reply_count: 2,
              retweet_count: 7,
              quote_count: 1,
              bookmark_count: 9,
            },
          },
        ],
      }),
    );
    const reader = createXMetricsReader({ accessToken: TOKEN, fetchImpl });
    const report = await reader.fetchPostMetrics({ externalPostId: "1" });

    expect(report.samples).toContainEqual({
      label: "impressions",
      value: 4200,
      platformField: "public_metrics.impression_count",
    });
    expect(report.samples).toHaveLength(6);
    expect(seen[0].url).toContain("tweet.fields=public_metrics");
    expect(seen[0].url).toContain("ids=1");
  });

  it("a 200 with no metrics (deleted/withheld post) refuses — it does not report zeros", async () => {
    const { fetchImpl } = capture(() => json({ errors: [{ title: "Not Found Error" }] }));
    const reader = createXMetricsReader({ accessToken: TOKEN, fetchImpl });
    await expect(reader.fetchPostMetrics({ externalPostId: "1" })).rejects.toThrow(
      SocialMetricsUnreadableError,
    );
  });

  it("403 → the typed permission refusal, carrying X's own words", async () => {
    const { fetchImpl } = capture(
      () => new Response("Your client app is not configured for this endpoint", { status: 403 }),
    );
    const reader = createXMetricsReader({ accessToken: TOKEN, fetchImpl });
    await expect(reader.fetchPostMetrics({ externalPostId: "1" })).rejects.toThrow(
      SocialMetricsPermissionError,
    );
  });

  it("in 1.0a mode it signs the GET — and the credential never rides the URL", async () => {
    const { seen, fetchImpl } = capture(() => json({ data: [{ public_metrics: { like_count: 1 } }] }));
    const reader = createXMetricsReader({
      accessToken: TOKEN,
      oauth1: { apiKey: "k", apiKeySecret: "ks", accessTokenSecret: "ts" },
      fetchImpl,
    });
    await reader.fetchPostMetrics({ externalPostId: "1" });
    const auth = (seen[0].init.headers as Record<string, string>).Authorization;
    expect(auth.startsWith("OAuth ")).toBe(true);
    expect(auth).toContain("oauth_signature=");
    expect(seen[0].url).not.toContain(TOKEN);
    expect(auth).not.toContain("ks");
  });
});

describe("facebook metrics reader", () => {
  it("asks ONLY for live metrics — never the retired impressions family", async () => {
    const { seen, fetchImpl } = capture(() => json({ data: [] }));
    const reader = createFacebookMetricsReader({ accessToken: TOKEN, pageId: "page", fetchImpl });
    await reader.fetchPostMetrics({ externalPostId: "page_1" });
    const url = decodeURIComponent(seen[0].url);
    expect(url).toContain("post_media_view");
    expect(url).toContain("post_total_media_view_unique");
    // The two metrics Meta retired in 2025 — asking for either returns an
    // invalid-metric error, so neither is ever asked for.
    expect(url).not.toContain("metric=post_impressions");
    expect(url).not.toContain(",post_impressions");
  });

  it("maps the surviving metrics, and sums the reaction-type map into one total", async () => {
    const { fetchImpl } = capture(() =>
      json({
        data: [
          { name: "post_media_view", values: [{ value: 980 }] },
          { name: "post_total_media_view_unique", values: [{ value: 640 }] },
          { name: "post_clicks", values: [{ value: 45 }] },
          { name: "post_reactions_by_type_total", values: [{ value: { like: 20, love: 5, wow: 2 } }] },
        ],
      }),
    );
    const reader = createFacebookMetricsReader({ accessToken: TOKEN, pageId: "page", fetchImpl });
    const report = await reader.fetchPostMetrics({ externalPostId: "page_1" });

    expect(report.samples).toEqual([
      { label: "views", value: 980, platformField: "post_media_view" },
      { label: "reach", value: 640, platformField: "post_total_media_view_unique" },
      { label: "clicks", value: 45, platformField: "post_clicks" },
      { label: "reactions", value: 27, platformField: "post_reactions_by_type_total" },
    ]);
  });

  it("a reaction map that is not a map of numbers yields NO sample — not a zero", async () => {
    const { fetchImpl } = capture(() =>
      json({ data: [{ name: "post_reactions_by_type_total", values: [{ value: "unexpected" }] }] }),
    );
    const reader = createFacebookMetricsReader({ accessToken: TOKEN, pageId: "page", fetchImpl });
    const report = await reader.fetchPostMetrics({ externalPostId: "page_1" });
    expect(report.samples).toEqual([]);
  });

  it("Graph's 400-shaped permission error becomes the typed permission refusal", async () => {
    const { fetchImpl } = capture(
      () =>
        new Response(
          JSON.stringify({ error: { message: "(#200) Requires read_insights permission" } }),
          { status: 400 },
        ),
    );
    const reader = createFacebookMetricsReader({ accessToken: TOKEN, pageId: "page", fetchImpl });
    const err = await reader
      .fetchPostMetrics({ externalPostId: "page_1" })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SocialMetricsPermissionError);
    // Meta's own words survive — the operator needs THAT sentence.
    expect((err as Error).message).toContain("read_insights");
  });

  it("an outage stays an outage — only permission-shaped answers are reclassified", async () => {
    const { fetchImpl } = capture(() => new Response("upstream exploded", { status: 500 }));
    const reader = createFacebookMetricsReader({ accessToken: TOKEN, pageId: "page", fetchImpl });
    const err = await reader
      .fetchPostMetrics({ externalPostId: "page_1" })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SocialDriverApiError);
    expect(err).not.toBeInstanceOf(SocialMetricsPermissionError);
  });
});

describe("instagram metrics reader", () => {
  it("asks for views (not the v22-retired impressions) and maps saved → saves", async () => {
    const { seen, fetchImpl } = capture(() =>
      json({
        data: [
          { name: "views", values: [{ value: 1500 }] },
          { name: "reach", values: [{ value: 1180 }] },
          { name: "likes", values: [{ value: 64 }] },
          { name: "comments", values: [{ value: 8 }] },
          { name: "saved", values: [{ value: 11 }] },
          { name: "shares", values: [{ value: 3 }] },
        ],
      }),
    );
    const reader = createInstagramMetricsReader({
      accessToken: TOKEN,
      igUserId: "ig-user",
      fetchImpl,
    });
    const report = await reader.fetchPostMetrics({ externalPostId: "media-1" });

    const url = decodeURIComponent(seen[0].url);
    expect(url).toContain("metric=views,reach,likes,comments,saved,shares");
    expect(url).not.toContain("impressions");
    expect(url).toContain("/media-1/insights");
    expect(report.samples).toContainEqual({ label: "saves", value: 11, platformField: "saved" });
    expect(report.samples).toHaveLength(6);
  });

  it("a missing insights permission is the typed refusal, not an unexplained failure", async () => {
    const { fetchImpl } = capture(
      () =>
        new Response(
          JSON.stringify({ error: { message: "(#10) Application does not have permission for this action" } }),
          { status: 400 },
        ),
    );
    const reader = createInstagramMetricsReader({ accessToken: TOKEN, igUserId: "u", fetchImpl });
    await expect(reader.fetchPostMetrics({ externalPostId: "m" })).rejects.toThrow(
      SocialMetricsPermissionError,
    );
  });
});

describe("reddit metrics reader", () => {
  it("keys on the fullname the ledger already holds, and reads score/comments/ratio", async () => {
    const { seen, fetchImpl } = capture(() =>
      json({
        data: {
          children: [{ data: { score: 42, num_comments: 7, upvote_ratio: 0.93, view_count: null } }],
        },
      }),
    );
    const reader = createRedditMetricsReader({ accessToken: TOKEN, fetchImpl });
    const report = await reader.fetchPostMetrics({ externalPostId: "t3_abc" });

    expect(seen[0].url).toContain("/api/info?id=t3_abc");
    expect(report.samples).toEqual([
      { label: "score", value: 42, platformField: "score" },
      { label: "comments", value: 7, platformField: "num_comments" },
      { label: "upvote_ratio", value: 0.93, platformField: "upvote_ratio" },
    ]);
    // view_count is null for a non-moderator — no sample, and the reason is
    // in the matrix rather than left as a mystery gap.
    expect(report.samples.some((s) => s.label === "impressions")).toBe(false);
    expect(report.unavailable.map((u) => u.label)).toContain("impressions");
  });

  it("a NEGATIVE score is recorded as it stands — flooring it at zero would be its own lie", async () => {
    const { fetchImpl } = capture(() =>
      json({ data: { children: [{ data: { score: -8, num_comments: 3 } }] } }),
    );
    const reader = createRedditMetricsReader({ accessToken: TOKEN, fetchImpl });
    const report = await reader.fetchPostMetrics({ externalPostId: "t3_abc" });
    expect(report.samples[0]).toEqual({ label: "score", value: -8, platformField: "score" });
  });

  it("an empty children array (removed post) refuses — /api/info answers 200, so this is the only place to catch it", async () => {
    const { fetchImpl } = capture(() => json({ data: { children: [] } }));
    const reader = createRedditMetricsReader({ accessToken: TOKEN, fetchImpl });
    await expect(reader.fetchPostMetrics({ externalPostId: "t3_gone" })).rejects.toThrow(
      SocialMetricsUnreadableError,
    );
  });
});
