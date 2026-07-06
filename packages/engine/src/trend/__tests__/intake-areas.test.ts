import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import { createFakeEmbeddingDriver, type EmbeddingDriver } from "../../ingest/shell/embedder";
import { createFakeTrendSource } from "../fake-source";
import { runTrendIntake } from "../intake";
import type { TrendItem, TrendSource } from "../trend-source";
import type { Watchlist } from "../watchlist";

let handle: DbHandle | undefined;
let storeRoot: string | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
  if (storeRoot) {
    rmSync(storeRoot, { recursive: true, force: true });
    storeRoot = undefined;
  }
});

const NOW = 1_750_000_000_000;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const AREA_VIDEO = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "AI video tooling",
  description: "Deterministic render pipelines for faceless channels",
};
const AREA_SEO = {
  id: "22222222-2222-2222-2222-222222222222",
  name: "Search intel",
  description: "keyword horizon math from search console data",
};

/**
 * "hot" is a clear ratio outlier whose text is BYTE-IDENTICAL to
 * AREA_VIDEO's description — the fake embedder hashes text to vectors, so
 * identical text means cosine 1 and attribution to AREA_VIDEO is certain.
 * "meh" arms the ratio rules (views ≥ minViews) but stays under every
 * threshold — a scored non-outlier.
 */
const ITEMS: TrendItem[] = [
  {
    externalId: "hot",
    url: "https://platform.test/hot",
    text: AREA_VIDEO.description,
    account: "alpha",
    publishedAt: NOW - DAY,
    metrics: { views: 120_000, shares: 3_000, bookmarks: 5_000 },
  },
  {
    externalId: "meh",
    text: "an unremarkable clip about cooking",
    account: "alpha",
    publishedAt: NOW - DAY,
    metrics: { views: 1_000, shares: 2, bookmarks: 1 },
  },
];

function spyingSource(items: readonly TrendItem[]): { source: TrendSource; polls: Watchlist[] } {
  const inner = createFakeTrendSource(items);
  const polls: Watchlist[] = [];
  return {
    polls,
    source: {
      name: "fake",
      async poll(watchlist) {
        polls.push(watchlist);
        return inner.poll(watchlist);
      },
    },
  };
}

async function setup(): Promise<{
  ctx: TenantCtx;
  repos: Repos;
  objectStore: LocalObjectStore;
  embedder: EmbeddingDriver;
}> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  const ctx = tenantCtx(tenant.id);
  await repos.brandProfiles.create(ctx, {
    config: { voice: {}, denylist: [], platformProfiles: {} },
    activate: true,
  });
  storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-trend-areas-"));
  return {
    ctx,
    repos,
    objectStore: new LocalObjectStore(storeRoot),
    embedder: createFakeEmbeddingDriver(1536),
  };
}

describe("runTrendIntake with monitored areas (B6.4, keyless + networkless)", () => {
  it("expands active areas into the polled watchlist, ranks every item per area, and tags ingested exemplars with best-relevance area provenance", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    const { source, polls } = spyingSource(ITEMS);

    const result = await runTrendIntake(
      ctx,
      repos,
      {
        watchlist: { source: "fake", queries: ["standing query"] },
        areas: [AREA_VIDEO, { ...AREA_SEO, status: "paused" }],
        nowMs: NOW,
      },
      { source, embedder, objectStore, capTokens: 1_000_000 },
    );

    // CANDIDATE GENERATION: the poll received the standing query first, then
    // the active area's expansion (name → description clause). The paused
    // area contributed nothing.
    expect(polls).toHaveLength(1);
    expect(polls[0].queries).toEqual([
      "standing query",
      "AI video tooling",
      "Deterministic render pipelines for faceless channels",
    ]);
    expect(result.areas).toEqual([
      {
        areaId: AREA_VIDEO.id,
        areaName: AREA_VIDEO.name,
        queries: ["AI video tooling", "Deterministic render pipelines for faceless channels"],
        droppedQueries: 0,
      },
    ]);

    // RANKING: one row per (item × active area), score-descending, with the
    // relevance reason naming the area. "hot" text === the area description,
    // so its relevance is exactly 1 under the hash-embedding fake.
    expect(result.ranked).toHaveLength(2);
    expect(result.ranked.map((r) => r.areaId)).toEqual([AREA_VIDEO.id, AREA_VIDEO.id]);
    const hotRow = result.ranked.find((r) => r.item.externalId === "hot")!;
    expect(hotRow.components.relevance).toBe(1);
    expect(hotRow.reasons[0]).toContain('to area "AI video tooling"');
    expect(hotRow.reasons.some((r) => r.startsWith("engagement"))).toBe(true);
    expect(result.ranked[0].score).toBeGreaterThanOrEqual(result.ranked[1].score);

    // Existing behavior is intact alongside: snapshots for every item,
    // outlier-only ingest.
    expect(result.snapshotsAppended).toBe(2);
    expect(result.ingested.map((i) => i.externalId)).toEqual(["hot"]);

    // PROVENANCE: additive areaId/areaName keys on the existing meta.trend
    // payload — nothing else about the payload changed.
    const source0 = await repos.sources.get(ctx, result.ingested[0].sourceId);
    const trendMeta = (source0!.meta as { trend: Record<string, unknown> }).trend;
    expect(trendMeta).toMatchObject({
      source: "fake",
      externalId: "hot",
      account: "alpha",
      areaId: AREA_VIDEO.id,
      areaName: AREA_VIDEO.name,
    });
  });

  it("attributes each ingested outlier to its best-RELEVANCE area when several areas are active", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    const { source } = spyingSource(ITEMS);

    const result = await runTrendIntake(
      ctx,
      repos,
      { watchlist: { source: "fake" }, areas: [AREA_SEO, AREA_VIDEO], nowMs: NOW },
      { source, embedder, objectStore, capTokens: 1_000_000 },
    );

    // Every item ranks against BOTH areas (full transparency for area filters)...
    expect(result.ranked).toHaveLength(4);
    // ...but provenance goes to the relevance winner, not the listing order.
    const source0 = await repos.sources.get(ctx, result.ingested[0].sourceId);
    const trendMeta = (source0!.meta as { trend: Record<string, unknown> }).trend;
    expect(trendMeta.areaId).toBe(AREA_VIDEO.id);
    expect(trendMeta.areaName).toBe(AREA_VIDEO.name);
  });

  it("without areas the sweep is byte-identical to pre-B6.4 behavior: no expansion, no ranking, no embed call beyond ingest", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    const { source, polls } = spyingSource(ITEMS);

    const result = await runTrendIntake(
      ctx,
      repos,
      { watchlist: { source: "fake", queries: ["standing query"] }, nowMs: NOW },
      { source, embedder, objectStore, capTokens: 1_000_000 },
    );

    expect(polls[0].queries).toEqual(["standing query"]);
    expect(result.areas).toEqual([]);
    expect(result.ranked).toEqual([]);
    const source0 = await repos.sources.get(ctx, result.ingested[0].sourceId);
    const trendMeta = (source0!.meta as { trend: Record<string, unknown> }).trend;
    expect(trendMeta).not.toHaveProperty("areaId");
  });

  it("a request carrying only paused areas behaves exactly like a request with none", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    const { source, polls } = spyingSource(ITEMS);

    const result = await runTrendIntake(
      ctx,
      repos,
      {
        watchlist: { source: "fake", queries: ["standing query"] },
        areas: [{ ...AREA_VIDEO, status: "paused" }],
        nowMs: NOW,
      },
      { source, embedder, objectStore, capTokens: 1_000_000 },
    );

    expect(polls[0].queries).toEqual(["standing query"]);
    expect(result.areas).toEqual([]);
    expect(result.ranked).toEqual([]);
  });

  it("honors the per-area query ration from the area's own config and reports the cut", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    const { source, polls } = spyingSource(ITEMS);

    const result = await runTrendIntake(
      ctx,
      repos,
      {
        watchlist: { source: "fake" },
        areas: [{ ...AREA_VIDEO, config: { maxQueriesPerSweep: 1 } }],
        nowMs: NOW,
      },
      { source, embedder, objectStore, capTokens: 1_000_000 },
    );

    expect(polls[0].queries).toEqual(["AI video tooling"]);
    expect(result.areas[0].queries).toEqual(["AI video tooling"]);
    expect(result.areas[0].droppedQueries).toBe(1);
  });

  it("plumbs ranker weights end to end: tenant default from the request, per-area override from area config", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    const { source } = spyingSource(ITEMS);

    const result = await runTrendIntake(
      ctx,
      repos,
      {
        watchlist: { source: "fake" },
        areas: [
          AREA_VIDEO,
          { ...AREA_SEO, config: { weights: { relevance: 0 } } },
        ],
        rankerConfig: { weights: { engagement: 0, velocity: 0, freshness: 0 } },
        nowMs: NOW,
      },
      { source, embedder, objectStore, capTokens: 1_000_000 },
    );

    // Tenant default silences everything but relevance → score IS relevance.
    const hotVideo = result.ranked.find(
      (r) => r.item.externalId === "hot" && r.areaId === AREA_VIDEO.id,
    )!;
    expect(hotVideo.weights).toEqual({ relevance: 1, engagement: 0, velocity: 0, freshness: 0 });
    expect(hotVideo.score).toBe(hotVideo.components.relevance);
    expect(hotVideo.score).toBe(1);

    // The SEO area's override additionally zeroes relevance → every armed
    // weight is 0 → score 0, and the unset override fields kept the tenant 0s.
    const hotSeo = result.ranked.find(
      (r) => r.item.externalId === "hot" && r.areaId === AREA_SEO.id,
    )!;
    expect(hotSeo.weights).toEqual({ relevance: 0, engagement: 0, velocity: 0, freshness: 0 });
    expect(hotSeo.score).toBe(0);
  });

  it("wires stored-history Δ-velocity into the ranked feed: the second sweep sees the spike between snapshots", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    const alphaItems = (metrics: Record<string, Record<string, number>>): TrendItem[] =>
      ["hot", "p1", "p2"].map((externalId) => ({
        externalId,
        text:
          externalId === "hot"
            ? AREA_VIDEO.description
            : `baseline filler item ${externalId}`,
        account: "alpha",
        publishedAt: NOW - DAY,
        metrics: metrics[externalId],
      }));

    const sweepOne = await runTrendIntake(
      ctx,
      repos,
      { watchlist: { source: "fake" }, areas: [AREA_VIDEO], nowMs: NOW },
      {
        source: spyingSource(
          alphaItems({
            hot: { views: 10_000 },
            p1: { views: 5_000 },
            p2: { views: 5_000 },
          }),
        ).source,
        embedder,
        objectStore,
        capTokens: 1_000_000,
      },
    );
    // One snapshot per item so far — the Δ signal cannot arm yet.
    const hotFirst = sweepOne.ranked.find((r) => r.item.externalId === "hot")!;
    expect(hotFirst.reasons.some((r) => r.includes("Δ"))).toBe(false);

    const sweepTwo = await runTrendIntake(
      ctx,
      repos,
      { watchlist: { source: "fake" }, areas: [AREA_VIDEO], nowMs: NOW + 2 * HOUR },
      {
        source: spyingSource(
          alphaItems({
            hot: { views: 40_000 }, // Δ 30k over 2h → 15,000 views/h
            p1: { views: 5_100 }, // Δ 50 views/h
            p2: { views: 5_400 }, // Δ 200 views/h → stored baseline median 125
          }),
        ).source,
        embedder,
        objectStore,
        capTokens: 1_000_000,
      },
    );

    const hotSecond = sweepTwo.ranked.find((r) => r.item.externalId === "hot")!;
    const velocityReason = hotSecond.reasons.find((r) => r.startsWith("velocity"));
    expect(velocityReason).toContain("Δ 15000");
    expect(velocityReason).toContain("stored baseline 125");
    // The armed Δ signal (15000/(15000+375) ≈ 0.976) averages with the sweep
    // signal and lifts the component well above sweep one's.
    expect(hotSecond.components.velocity).toBeGreaterThan(0.8);
    expect(hotSecond.components.velocity!).toBeGreaterThan(hotFirst.components.velocity!);
  });

  it("replays deterministically: the same sweep re-run yields the identical ranked feed off the embedding cache", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    const request = {
      watchlist: { source: "fake" as const },
      areas: [AREA_SEO, AREA_VIDEO],
      nowMs: NOW,
    };
    const deps = () => ({
      source: spyingSource(ITEMS).source,
      embedder,
      objectStore,
      capTokens: 1_000_000,
    });

    const first = await runTrendIntake(ctx, repos, request, deps());
    const replay = await runTrendIntake(ctx, repos, request, deps());
    expect(replay.ranked).toEqual(first.ranked);
    expect(replay.snapshotsAppended).toBe(0); // structural idempotency intact
  });
});
