import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import { createFakeEmbeddingDriver, type EmbeddingDriver } from "../../ingest/shell/embedder";
import { createFakeTrendSource } from "../fake-source";
import { readSweepBundle, runTrendSweep, sweepBundleKey } from "../sweep";
import type { TrendItem } from "../trend-source";

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
const DAY = 24 * 3_600_000;

const AREA = { name: "AI video tooling", description: "Deterministic render pipelines for faceless channels" };

const ITEMS: TrendItem[] = [
  {
    externalId: "hot",
    url: "https://platform.test/hot",
    text: AREA.description, // byte-identical to the area description → cosine 1 on the hash-embedding fake
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
  storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-sweep-"));
  return { ctx, repos, objectStore: new LocalObjectStore(storeRoot), embedder: createFakeEmbeddingDriver(1536) };
}

describe("runTrendSweep", () => {
  it("polls active areas, ranks, and persists a wire-ready bundle the route can read back", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    await repos.monitoredAreas.create(ctx, AREA);

    const { bundle, cardsCut } = await runTrendSweep(
      ctx,
      repos,
      { nowMs: NOW, intervalMs: 4 * 3_600_000 },
      { source: createFakeTrendSource(ITEMS), embedder, objectStore, capTokens: 1_000_000 },
    );

    expect(bundle.source).toBe("fake");
    expect(bundle.sweptAtMs).toBe(NOW);
    expect(bundle.nextSweepAtMs).toBe(NOW + 4 * 3_600_000);
    expect(bundle.polled).toBe(2);
    expect(bundle.areasSwept).toBe(1);
    expect(bundle.ingested).toBe(1); // "hot" is the outlier
    expect(cardsCut).toBe(0);
    // Per (item × area), score-descending; the byte-identical text ranks first.
    expect(bundle.cards).toHaveLength(2);
    expect(bundle.cards[0]).toMatchObject({
      externalId: "hot",
      areaName: AREA.name,
      isOutlier: true,
      account: "alpha",
    });
    expect(bundle.cards[0].id).toBe(`${bundle.cards[0].areaId}:hot`);
    expect(bundle.cards[0].score).toBeGreaterThan(bundle.cards[1].score);
    expect(bundle.cards[0].reasons.length).toBeGreaterThan(0);
    expect(bundle.cards[0].shareToView).toBeCloseTo(0.025, 3);
    expect(bundle.cards[0].dossier).toBeUndefined(); // generation is gateway-gated — never fabricated

    // The route-side read round-trips through the schema.
    const read = await readSweepBundle(ctx.tenantId, objectStore);
    expect(read).toEqual(bundle);
  });

  it("latest sweep wins — the bundle key is a mutable pointer, overwritten per run", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    await repos.monitoredAreas.create(ctx, AREA);
    const deps = { source: createFakeTrendSource(ITEMS), embedder, objectStore, capTokens: 1_000_000 };

    await runTrendSweep(ctx, repos, { nowMs: NOW }, deps);
    await runTrendSweep(ctx, repos, { nowMs: NOW + 3_600_000 }, deps);

    const read = await readSweepBundle(ctx.tenantId, objectStore);
    expect(read?.sweptAtMs).toBe(NOW + 3_600_000);
    expect(await objectStore.list("sweeps/")).toEqual([sweepBundleKey(ctx.tenantId)]);
  });

  it("caps the bundle at maxCards score-descending and REPORTS the cut (no silent truncation)", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    await repos.monitoredAreas.create(ctx, AREA);

    const { bundle, cardsCut } = await runTrendSweep(
      ctx,
      repos,
      { nowMs: NOW, maxCards: 1 },
      { source: createFakeTrendSource(ITEMS), embedder, objectStore, capTokens: 1_000_000 },
    );
    expect(bundle.cards).toHaveLength(1);
    expect(bundle.cards[0].externalId).toBe("hot");
    expect(cardsCut).toBe(1);
  });

  it("sweeps with zero active areas honestly: snapshots accrue, cards stay empty, paused areas leave no residue", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    const area = await repos.monitoredAreas.create(ctx, AREA);
    await repos.monitoredAreas.update(ctx, area.id, { status: "paused" });

    const { bundle } = await runTrendSweep(
      ctx,
      repos,
      { nowMs: NOW, watchlist: { accounts: ["alpha"] } },
      { source: createFakeTrendSource(ITEMS), embedder, objectStore, capTokens: 1_000_000 },
    );
    expect(bundle.areasSwept).toBe(0);
    expect(bundle.polled).toBe(2);
    expect(bundle.snapshotsAppended).toBe(2);
    expect(bundle.cards).toEqual([]);
    // No-areas bundles still persist — the cadence stamp reads sweptAt from them.
    expect(await readSweepBundle(ctx.tenantId, objectStore)).not.toBeNull();
  });

  it("returns null from readSweepBundle before any sweep — the route's fixture fallback signal", async () => {
    const { ctx, objectStore } = await setup();
    expect(await readSweepBundle(ctx.tenantId, objectStore)).toBeNull();
  });

  it("stored watchlists for the selected driver feed the poll (the B4.3 rows' pass-3 promise)", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    await repos.watchlists.create(ctx, { source: "fake", accounts: ["alpha"] });
    const items: TrendItem[] = [
      ...ITEMS,
      { externalId: "other", text: "someone else's clip", account: "beta", publishedAt: NOW - DAY, metrics: { views: 10 } },
    ];

    const { bundle } = await runTrendSweep(
      ctx,
      repos,
      { nowMs: NOW },
      { source: createFakeTrendSource(items), embedder, objectStore, capTokens: 1_000_000 },
    );
    // The fake filters to watched accounts — "beta" never entered the sweep.
    expect(bundle.polled).toBe(2);
  });
});
