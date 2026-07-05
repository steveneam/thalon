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

/** alpha's "hot" is a clear multi-rule outlier (and carries PII); beta's "banned" is a ratio outlier that hits the tenant denylist; the two peers are baseline noise. */
const ITEMS: TrendItem[] = [
  {
    externalId: "hot",
    url: "https://platform.test/hot",
    text: "This hook format tripled reach — DM jane@corp.test for the template.",
    account: "alpha",
    publishedAt: NOW - DAY,
    metrics: { views: 120_000, shares: 3_000, bookmarks: 5_000 },
  },
  {
    externalId: "p1",
    text: "regular post one",
    account: "alpha",
    publishedAt: NOW - DAY,
    metrics: { views: 1_000, shares: 2, bookmarks: 1 },
  },
  {
    externalId: "p2",
    text: "regular post two",
    account: "alpha",
    publishedAt: NOW - DAY,
    metrics: { views: 1_200, shares: 3, bookmarks: 2 },
  },
  {
    externalId: "banned",
    text: "Our guaranteed returns strategy went viral overnight.",
    account: "beta",
    publishedAt: NOW - DAY,
    metrics: { views: 80_000, shares: 4_000, bookmarks: 100 },
  },
];

async function setup(denylist: string[] = []): Promise<{
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
    config: { voice: {}, denylist, platformProfiles: {} },
    activate: true,
  });
  storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-trend-"));
  return {
    ctx,
    repos,
    objectStore: new LocalObjectStore(storeRoot),
    embedder: createFakeEmbeddingDriver(1536),
  };
}

describe("runTrendIntake (B3.12 skeleton, keyless + networkless)", () => {
  it("polls, scores, and auto-ingests outliers as PII-stripped exemplars with metric snapshots — denylist hits never enter", async () => {
    const { ctx, repos, objectStore, embedder } = await setup(["guaranteed returns"]);

    const result = await runTrendIntake(
      ctx,
      repos,
      { watchlist: { source: "fake", accounts: ["alpha", "beta"] }, nowMs: NOW },
      { source: createFakeTrendSource(ITEMS), embedder, objectStore, capTokens: 1_000_000 },
    );

    expect(result.polled).toBe(4);
    expect(result.scored.filter((s) => s.isOutlier).map((s) => s.item.externalId)).toEqual([
      "hot",
      "banned",
    ]);

    // The denylist-hitting outlier was screened out, with the term named.
    expect(result.screened).toEqual([{ externalId: "banned", matchedTerms: ["guaranteed returns"] }]);

    // The clean outlier ingested as an exemplar source through the B2.4 path.
    expect(result.ingested).toHaveLength(1);
    const [ingested] = result.ingested;
    expect(ingested.externalId).toBe("hot");
    expect(ingested.created).toBe(true);
    const source = await repos.sources.get(ctx, ingested.sourceId);
    expect(source!.kind).toBe("exemplar");
    const trendMeta = (source!.meta as { trend: Record<string, unknown> }).trend;
    expect(trendMeta).toMatchObject({ source: "fake", externalId: "hot", account: "alpha" });
    expect(trendMeta.reasons).toHaveLength(3); // velocity + share-to-view + bookmark-efficiency all fired

    // PII never entered storage: the chunks carry the redacted text.
    const chunks = await repos.sourceChunks.listBySource(ctx, ingested.sourceId);
    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) expect(chunk.text).not.toContain("jane@corp.test");
    expect(chunks.some((chunk) => chunk.text.includes("[EMAIL]"))).toBe(true);

    // Engagement counters landed as timestamped source_metrics snapshots.
    const metrics = await repos.sourceMetrics.listBySource(ctx, ingested.sourceId);
    expect(metrics.map((m) => [m.metricName, m.metricValue]).sort()).toEqual([
      ["bookmarks", 5_000],
      ["shares", 3_000],
      ["views", 120_000],
    ]);

    // Non-outliers leave NO residue: the only source row is the ingested exemplar.
    expect(result.scored.find((s) => s.item.externalId === "p1")!.isOutlier).toBe(false);
    const allMetricsP1 = await repos.sourceMetrics.listBySource(ctx, ingested.sourceId);
    expect(allMetricsP1).toHaveLength(3);
  });

  it("PINS the ingested exemplar's content hash byte-for-byte (A10: content hashes stay stable through B4.3's storage wiring)", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    const result = await runTrendIntake(
      ctx,
      repos,
      { watchlist: { source: "fake", accounts: ["alpha"] }, nowMs: NOW },
      { source: createFakeTrendSource(ITEMS), embedder, objectStore, capTokens: 1_000_000 },
    );
    const source = await repos.sources.get(ctx, result.ingested[0].sourceId);
    // sha256 of the PII-stripped "hot" fixture text — a changed byte here
    // breaks re-sweep idempotency for every existing tenant. Fix the code,
    // never this pin.
    expect(source!.contentHash).toBe(
      "6dc9bab58129801359d46251fba105f6e185656bd4becf1e9b0aa7ba21b90c28",
    );
  });

  it("B4.3: EVERY polled item accrues a trend_snapshots history row — idempotent per capture instant, longitudinal history across sweeps", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    const deps = { source: createFakeTrendSource(ITEMS), embedder, objectStore, capTokens: 1_000_000 };
    const request = { watchlist: { source: "fake", accounts: ["alpha"] }, nowMs: NOW };

    const first = await runTrendIntake(ctx, repos, request, deps);
    expect(first.polled).toBe(3);
    expect(first.snapshotsAppended).toBe(3); // hot + p1 + p2 — non-outliers included

    // A NON-outlier accrued history without ever becoming a source.
    const p1History = await repos.trendSnapshots.listByItem(ctx, { source: "fake", externalId: "p1" });
    expect(p1History).toHaveLength(1);
    expect(p1History[0].metrics).toEqual({ views: 1_000, shares: 2, bookmarks: 1 });
    expect(p1History[0].capturedAt.getTime()).toBe(NOW);

    // Same-instant replay appends nothing (structural idempotency)...
    const replay = await runTrendIntake(ctx, repos, request, deps);
    expect(replay.snapshotsAppended).toBe(0);

    // ...a later sweep appends the next history row per item.
    const later = await runTrendIntake(ctx, repos, { ...request, nowMs: NOW + 3_600_000 }, deps);
    expect(later.snapshotsAppended).toBe(3);
    const accountHistory = await repos.trendSnapshots.listByAccount(ctx, { source: "fake", account: "alpha" });
    expect(accountHistory).toHaveLength(6); // 3 items × 2 capture instants

    // The capture is audited (B4.4 events spine).
    const events = await repos.events.list(ctx, { entityType: "trend_snapshot", limit: 500 });
    expect(events.filter((e) => e.event === "trend_snapshot.captured")).toHaveLength(6);
  });

  it("re-sweeps idempotently on content while appending fresh metric snapshots", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    const deps = { source: createFakeTrendSource(ITEMS), embedder, objectStore, capTokens: 1_000_000 };
    const request = { watchlist: { source: "fake", accounts: ["alpha"] }, nowMs: NOW };

    const first = await runTrendIntake(ctx, repos, request, deps);
    expect(first.ingested).toEqual([expect.objectContaining({ externalId: "hot", created: true })]);

    const second = await runTrendIntake(ctx, repos, { ...request, nowMs: NOW + 3_600_000 }, deps);
    expect(second.ingested).toEqual([
      expect.objectContaining({
        externalId: "hot",
        created: false, // same stripped content → same source row
        sourceId: first.ingested[0].sourceId,
      }),
    ]);

    // ...but the engagement history accrued: two snapshots per metric now.
    const metrics = await repos.sourceMetrics.listBySource(ctx, first.ingested[0].sourceId);
    expect(metrics).toHaveLength(6);
  });

  it("polls only watchlisted accounts — the watchlist is the acquisition scope", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    const result = await runTrendIntake(
      ctx,
      repos,
      { watchlist: { source: "fake", accounts: ["beta"] }, nowMs: NOW },
      { source: createFakeTrendSource(ITEMS), embedder, objectStore, capTokens: 1_000_000 },
    );
    expect(result.polled).toBe(1);
    // beta's item is a ratio outlier and no denylist is configured → it ingests.
    expect(result.ingested.map((i) => i.externalId)).toEqual(["banned"]);
  });

  it("throws when the tenant has no active brand profile — the denylist screen has nothing to read", async () => {
    handle = await openTestDb();
    const { repos } = handle;
    const tenant = await repos.tenants.create({ slug: "bare", name: "Bare" });
    const ctx = tenantCtx(tenant.id);
    await expect(
      runTrendIntake(
        ctx,
        repos,
        { watchlist: { source: "fake" }, nowMs: NOW },
        { source: createFakeTrendSource(ITEMS), embedder: createFakeEmbeddingDriver(1536) },
      ),
    ).rejects.toThrow(/no active brand profile/);
  });
});
