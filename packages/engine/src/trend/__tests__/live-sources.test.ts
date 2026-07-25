import { readEnv } from "@thalon/platform";
import { describe, expect, it } from "vitest";
import { blueskyTrendSource } from "../bluesky-source";
import { getTrendSource, getTrendSources, registeredTrendSources } from "../source-registry";
import { youtubeTrendSource } from "../youtube-source";

/** B6.5 live TrendSource drivers — fixture-fetched, keyless, zero network (ground rule). */

const BSKY_POST = (n: number, handle = "analyst.bsky.social") => ({
  uri: `at://did:plc:abc${n}/app.bsky.feed.post/rkey${n}`,
  cid: `cid${n}`,
  author: { did: `did:plc:abc${n}`, handle, displayName: "Analyst" },
  record: { $type: "app.bsky.feed.post", text: `post ${n} about ai video`, createdAt: "2026-07-06T10:00:00.000Z" },
  replyCount: n,
  repostCount: n * 2,
  likeCount: n * 10,
  quoteCount: 1,
  indexedAt: "2026-07-06T10:05:00.000Z",
});

describe("bluesky trend source", () => {
  it("polls queries via an app-password session then searchPosts, mapping posts with platform-native metric names", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const source = blueskyTrendSource({
      config: { identifier: "thalon.bsky.social", appPassword: "app-pass" },
      fetchImpl: (async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        if (url.includes("createSession")) {
          return new Response(JSON.stringify({ accessJwt: "jwt-1", did: "did:plc:self" }), { status: 200 });
        }
        return new Response(JSON.stringify({ posts: [BSKY_POST(1), BSKY_POST(2)] }), { status: 200 });
      }) as typeof fetch,
    });

    const items = await source.poll({ source: "bluesky", accounts: [], queries: ["ai video"] });
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toContain("bsky.social/xrpc/com.atproto.server.createSession");
    expect(calls[1].url).toContain("bsky.social/xrpc/app.bsky.feed.searchPosts");
    expect(calls[1].url).toContain("q=ai+video");
    expect(calls[1].url).toContain("sort=top");
    expect((calls[1].init?.headers as Record<string, string>).authorization).toBe("Bearer jwt-1");
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      externalId: "at://did:plc:abc1/app.bsky.feed.post/rkey1",
      url: "https://bsky.app/profile/analyst.bsky.social/post/rkey1",
      text: "post 1 about ai video",
      account: "analyst.bsky.social",
      publishedAt: Date.parse("2026-07-06T10:00:00.000Z"),
      metrics: { likes: 10, reposts: 2, replies: 1, quotes: 1 },
    });
  });

  it("polls accounts via getAuthorFeed and skips reposts — an account's feed is what IT publishes", async () => {
    const source = blueskyTrendSource({
      fetchImpl: (async (url: string) => {
        expect(url).toContain("/xrpc/app.bsky.feed.getAuthorFeed");
        expect(url).toContain("actor=analyst.bsky.social");
        return new Response(
          JSON.stringify({
            feed: [
              { post: BSKY_POST(1) },
              { post: BSKY_POST(9, "someone-else.bsky.social"), reason: { $type: "app.bsky.feed.defs#reasonRepost" } },
            ],
          }),
          { status: 200 },
        );
      }) as typeof fetch,
    });
    const items = await source.poll({ source: "bluesky", accounts: ["analyst.bsky.social"], queries: [] });
    expect(items).toHaveLength(1);
    expect(items[0].externalId).toBe("at://did:plc:abc1/app.bsky.feed.post/rkey1");
  });

  it("dedupes the same post found by overlapping queries", async () => {
    const source = blueskyTrendSource({
      config: { identifier: "thalon.bsky.social", appPassword: "app-pass" },
      fetchImpl: (async (url: string) =>
        new Response(
          JSON.stringify(url.includes("createSession") ? { accessJwt: "jwt-1" } : { posts: [BSKY_POST(1)] }),
          { status: 200 },
        )) as typeof fetch,
    });
    const items = await source.poll({ source: "bluesky", accounts: [], queries: ["ai", "ai video"] });
    expect(items).toHaveLength(1);
  });

  it("refuses query search without credentials LOUDLY — accounts stay keyless, queries need the free app password", async () => {
    const source = blueskyTrendSource({
      config: { identifier: undefined, appPassword: undefined },
      fetchImpl: (async () => {
        throw new Error("must not fetch");
      }) as typeof fetch,
    });
    await expect(source.poll({ source: "bluesky", accounts: [], queries: ["x"] })).rejects.toThrow(
      /BLUESKY_IDENTIFIER \+ BLUESKY_APP_PASSWORD/,
    );
  });

  it("refuses a sweep over the request budget LOUDLY, naming both knobs", async () => {
    const source = blueskyTrendSource({
      config: { maxRequestsPerSweep: 2 },
      fetchImpl: (async () => {
        throw new Error("must not fetch");
      }) as typeof fetch,
    });
    await expect(
      source.poll({ source: "bluesky", accounts: ["a.bsky.social"], queries: ["q1", "q2"] }),
    ).rejects.toThrow(/maxRequestsPerSweep=2.*maxQueriesPerSweep/s);
  });

  it("surfaces AppView errors loudly", async () => {
    const source = blueskyTrendSource({
      config: {},
      fetchImpl: (async () => new Response("nope", { status: 429 })) as typeof fetch,
    });
    await expect(
      source.poll({ source: "bluesky", accounts: ["a.bsky.social"], queries: [] }),
    ).rejects.toThrow(/responded 429/);
  });
});

describe("youtube trend source", () => {
  const SEARCH_RESPONSE = {
    items: [
      { id: { kind: "youtube#video", videoId: "vid1" } },
      { id: { kind: "youtube#video", videoId: "vid2" } },
    ],
  };
  const VIDEOS_RESPONSE = {
    items: [
      {
        id: "vid1",
        snippet: {
          title: "Will AI replace consultants?",
          description: "A look at the future.",
          channelId: "UCchan1",
          publishedAt: "2026-07-05T09:00:00Z",
        },
        statistics: { viewCount: "15000", likeCount: "800", commentCount: "90" },
      },
      {
        id: "vid2",
        snippet: { title: "Quiet video", description: "", channelId: "UCchan2", publishedAt: "2026-07-04T09:00:00Z" },
        statistics: {},
      },
    ],
  };

  it("refuses to poll without an api key — keyed runtime config, never silent", async () => {
    const source = youtubeTrendSource({ config: {} });
    await expect(source.poll({ source: "youtube", accounts: [], queries: ["x"] })).rejects.toThrow(
      /YOUTUBE_API_KEY/,
    );
  });

  it("chunks videos.list at 50 ids — a wide sweep never sends one giant 400 (s72)", async () => {
    // Three searches × 40 unique ids = 120 collected → 3 videos.list chunks.
    const calls: string[] = [];
    let searchN = 0;
    const source = youtubeTrendSource({
      config: { apiKey: "k-test", maxSearchesPerSweep: 3, perQueryLimit: 40 },
      fetchImpl: (async (url: string) => {
        calls.push(url);
        if (url.includes("/search")) {
          searchN++;
          return new Response(
            JSON.stringify({
              items: Array.from({ length: 40 }, (_, i) => ({
                id: { kind: "youtube#video", videoId: `s${searchN}v${i}` },
              })),
            }),
            { status: 200 },
          );
        }
        const idParam = new URL(url).searchParams.get("id") ?? "";
        return new Response(
          JSON.stringify({
            items: idParam.split(",").map((id) => ({
              id,
              snippet: { title: `t ${id}`, description: "", channelId: `UC${id}`, publishedAt: "2026-07-05T09:00:00Z" },
              statistics: { viewCount: "100" },
            })),
          }),
          { status: 200 },
        );
      }) as typeof fetch,
    });

    const items = await source.poll({ source: "youtube", accounts: [], queries: ["a", "b", "c"] });
    const videoCalls = calls.filter((u) => u.includes("/videos?"));
    expect(videoCalls).toHaveLength(3);
    for (const u of videoCalls) {
      const n = (new URL(u).searchParams.get("id") ?? "").split(",").length;
      expect(n).toBeLessThanOrEqual(50);
    }
    expect(items).toHaveLength(120);
  });

  it("searches then batch-fetches statistics, coercing the API's string counters", async () => {
    const calls: string[] = [];
    const source = youtubeTrendSource({
      config: { apiKey: "k-test" },
      fetchImpl: (async (url: string) => {
        calls.push(url);
        return new Response(
          JSON.stringify(url.includes("/search") ? SEARCH_RESPONSE : VIDEOS_RESPONSE),
          { status: 200 },
        );
      }) as typeof fetch,
    });

    const items = await source.poll({ source: "youtube", accounts: [], queries: ["ai consulting"] });
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain("/search?");
    expect(calls[0]).toContain("q=ai+consulting");
    expect(calls[1]).toContain("/videos?");
    expect(calls[1]).toContain("id=vid1%2Cvid2");
    expect(items).toEqual([
      {
        externalId: "vid1",
        url: "https://www.youtube.com/watch?v=vid1",
        text: "Will AI replace consultants?\nA look at the future.",
        account: "UCchan1",
        publishedAt: Date.parse("2026-07-05T09:00:00Z"),
        metrics: { views: 15_000, likes: 800, comments: 90 },
      },
      {
        externalId: "vid2",
        url: "https://www.youtube.com/watch?v=vid2",
        text: "Quiet video",
        account: "UCchan2",
        publishedAt: Date.parse("2026-07-04T09:00:00Z"),
        metrics: { views: 0, likes: 0, comments: 0 },
      },
    ]);
  });

  it("refuses account polling with the recorded follow-up message", async () => {
    const source = youtubeTrendSource({ config: { apiKey: "k" } });
    await expect(
      source.poll({ source: "youtube", accounts: ["UCchan1"], queries: [] }),
    ).rejects.toThrow(/bluesky driver/);
  });

  it("refuses a sweep over the search budget LOUDLY — search.list has its own daily bucket", async () => {
    const source = youtubeTrendSource({ config: { apiKey: "k", maxSearchesPerSweep: 1 } });
    await expect(
      source.poll({ source: "youtube", accounts: [], queries: ["a", "b"] }),
    ).rejects.toThrow(/maxSearchesPerSweep=1/);
  });
});

describe("trend source registry", () => {
  it("registers fake | bluesky | youtube and resolves explicit name > TREND_SOURCE env > fake", () => {
    expect(registeredTrendSources()).toEqual(["fake", "bluesky", "youtube"]);
    expect(getTrendSource().name).toBe("fake");
    expect(getTrendSource("bluesky").name).toBe("bluesky");
    expect(() => getTrendSource("x-twitter")).toThrow(/registered: fake, bluesky, youtube/);
  });

  it("YOUTUBE_MAX_SEARCHES_PER_SWEEP reaches the driver's ration (s72 env seat)", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: unknown) => {
      calls.push(String(url));
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ items: [] }),
      } as Response;
    }) as typeof fetch;
    const env = readEnv({ YOUTUBE_API_KEY: "k", YOUTUBE_MAX_SEARCHES_PER_SWEEP: "2" });
    const source = getTrendSource("youtube", env, { fetchImpl });
    // Two queries fit the raised ration — the default 1 would refuse this poll.
    await source.poll({ source: "youtube", accounts: [], queries: ["a", "b"] });
    expect(calls.filter((u) => u.includes("/search")).length).toBe(2);
  });

  it("comma-list selection resolves every listed driver in order (s72 multi-source soak)", () => {
    expect(getTrendSources("youtube,bluesky").map((s) => s.name)).toEqual(["youtube", "bluesky"]);
    // Whitespace tolerated, duplicates collapsed — the selection is config typed by hand.
    expect(getTrendSources(" bluesky , bluesky ").map((s) => s.name)).toEqual(["bluesky"]);
    // A single name behaves exactly as before.
    expect(getTrendSources("fake").map((s) => s.name)).toEqual(["fake"]);
    // One unknown member fails the WHOLE selection loudly — never a silent partial soak.
    expect(() => getTrendSources("bluesky,x-twitter")).toThrow(/unknown trend source "x-twitter"/);
  });
});
