import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import { createFakeEmbeddingDriver, type EmbeddingDriver } from "../../ingest/shell/embedder";
import { admissionOrigin, runAdmissions } from "../admission";
import { createFakeTrendSource } from "../fake-source";
import { runTrendIntake } from "../intake";
import type { RankedCandidate } from "../ranker";
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
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const AREA = {
  name: "Hook craft",
  description:
    "Hook patterns that carry a post: the promise up front, proof in the middle, a pivot before the payoff — long-form craft notes on openings that actually hold attention.",
};

/** A distinct body comfortably over the default 140-char floor. */
function longBody(label: string): string {
  return `${label} — a worked hook pattern with a full body: the promise, the proof, the pivot, and the payoff, written out at enough length that a bare headline could never pass for it.`;
}

/** Fixture items are one-per-account by default — the single-sweep account-baseline door stays silent, isolating the admission loop. */
function fixture(externalId: string, overrides: Partial<TrendItem> = {}): TrendItem {
  return {
    externalId,
    url: `https://platform.test/${externalId}`,
    text: longBody(externalId),
    account: `acct-${externalId}`,
    publishedAt: NOW - DAY,
    metrics: { views: 50_000 },
    ...overrides,
  };
}

async function setup(denylist: string[] = []): Promise<{
  ctx: TenantCtx;
  repos: Repos;
  objectStore: LocalObjectStore;
  embedder: EmbeddingDriver;
  /** The monitored area as a ROW through the repo door — the durable cap ledger references real area rows (FK), exactly like production. */
  area: { id: string; name: string; description: string };
}> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  const ctx = tenantCtx(tenant.id);
  await repos.brandProfiles.create(ctx, {
    config: { voice: {}, denylist, platformProfiles: {} },
    activate: true,
  });
  const row = await repos.monitoredAreas.create(ctx, AREA);
  storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-trend-admission-"));
  return {
    ctx,
    repos,
    objectStore: new LocalObjectStore(storeRoot),
    embedder: createFakeEmbeddingDriver(1536),
    area: { id: row.id, name: AREA.name, description: AREA.description },
  };
}

describe("runTrendIntake admission pass (B-learn L1, keyless + networkless)", () => {
  it("ships ARMED: a floors-qualified item admits under the default knobs with full provenance; headlines, under-floor and missing-metric items are rejected with why-counts", async () => {
    const { ctx, repos, objectStore, embedder, area } = await setup();
    const items = [
      fixture("win"),
      fixture("headline", { text: "Breaking: markets move on a rumor", metrics: { views: 90_000 } }),
      fixture("quiet", { metrics: { views: 2_000 } }),
      fixture("bsky", { metrics: { likes: 900, reposts: 300 } }), // no views counter — fails closed
    ];

    const result = await runTrendIntake(
      ctx,
      repos,
      { watchlist: { source: "fake" }, areas: [area], nowMs: NOW },
      { source: createFakeTrendSource(items), embedder, objectStore, capTokens: 1_000_000 },
    );

    // The legacy single-sweep door stayed silent (one item per account — no
    // baseline peers, no ratio metrics): every admission below is the NEW loop.
    expect(result.ingested).toEqual([]);
    expect(result.screened).toEqual([]);

    expect(result.admissions.admitted).toEqual([
      { externalId: "win", sourceId: expect.any(String), areaId: area.id },
    ]);
    expect(result.admissions.byArea).toEqual([
      {
        areaId: area.id,
        areaName: area.name,
        enabled: true,
        considered: 4,
        admitted: 1,
        reEncountered: 0,
        rejected: { bodyLength: 1, floors: 2, velocity: 0, denylist: 0, cap: 0 },
        capRemaining: 19,
      },
    ]);

    // The admitted source carries the kickoff's provenance contract.
    const source = await repos.sources.get(ctx, result.admissions.admitted[0].sourceId);
    expect(source!.kind).toBe("exemplar");
    expect(source!.uri).toBe("https://platform.test/win");
    const meta = source!.meta as { origin: string; trend: Record<string, unknown> };
    expect(meta.origin).toBe(admissionOrigin(area.id));
    expect(meta.trend).toMatchObject({
      source: "fake",
      externalId: "win",
      account: "acct-win",
      capturedAtMs: NOW,
      areaId: area.id,
      areaName: area.name,
    });
    expect(meta.trend.reasons).toEqual([
      expect.stringContaining("body length"),
      "views 50000 ≥ floor 10000",
      expect.stringContaining("baseline unarmed"),
    ]);

    // Engagement counters landed as source_metrics snapshots through the door.
    const metrics = await repos.sourceMetrics.listBySource(ctx, source!.id);
    expect(metrics.map((m) => [m.metricName, m.metricValue])).toEqual([["views", 50_000]]);
  });

  it("never admits the same text twice: a re-sweep re-encounters the source (no cap slot) while fresh metrics append", async () => {
    const { ctx, repos, objectStore, embedder, area } = await setup();
    const items = [fixture("win")];
    const deps = { source: createFakeTrendSource(items), embedder, objectStore, capTokens: 1_000_000 };

    const first = await runTrendIntake(
      ctx,
      repos,
      { watchlist: { source: "fake" }, areas: [area], nowMs: NOW },
      deps,
    );
    expect(first.admissions.admitted).toHaveLength(1);
    const sourceId = first.admissions.admitted[0].sourceId;

    const second = await runTrendIntake(
      ctx,
      repos,
      { watchlist: { source: "fake" }, areas: [area], nowMs: NOW + 2 * HOUR },
      deps,
    );
    expect(second.admissions.admitted).toEqual([]);
    expect(second.admissions.reEncountered).toEqual([
      { externalId: "win", sourceId, areaId: area.id },
    ]);
    // Same UTC day: the one created admission still counts; the re-encounter took no slot.
    expect(second.admissions.byArea[0].capRemaining).toBe(19);
    // source_metrics is append-only — the engagement history accrued.
    const metrics = await repos.sourceMetrics.listBySource(ctx, sourceId);
    expect(metrics).toHaveLength(2);
  });

  it("enforces the per-area UTC-day cap in RANKED order, persists it across sweeps, and resets next day", async () => {
    const { ctx, repos, objectStore, embedder, area } = await setup();
    // "top" is byte-identical to the area description — relevance 1 under the
    // hash-embedding fake, so it deterministically outranks "second".
    const top = fixture("top", { text: area.description });
    const second = fixture("second");
    const third = fixture("third");
    // L0: the cap override is AREA DATA — it rides the row's config.admission.
    const cappedArea = { ...area, config: { admission: { maxAdmissionsPerDay: 1 } } };
    const deps = (items: TrendItem[]) => ({
      source: createFakeTrendSource(items),
      embedder,
      objectStore,
      capTokens: 1_000_000,
    });

    const sweep1 = await runTrendIntake(
      ctx,
      repos,
      { watchlist: { source: "fake" }, areas: [cappedArea], nowMs: NOW },
      deps([top, second]),
    );
    expect(sweep1.admissions.admitted).toEqual([
      { externalId: "top", sourceId: expect.any(String), areaId: area.id },
    ]);
    expect(sweep1.admissions.byArea[0].rejected.cap).toBe(1);
    expect(sweep1.admissions.byArea[0].capRemaining).toBe(0);

    // Later the same UTC day: the created admission holds its slot in the
    // durable trend_admissions ledger (day from the argument clock) — a NEW
    // qualifier is refused.
    const sweep2 = await runTrendIntake(
      ctx,
      repos,
      { watchlist: { source: "fake" }, areas: [cappedArea], nowMs: NOW + 2 * HOUR },
      deps([top, third]),
    );
    expect(sweep2.admissions.admitted).toEqual([]);
    expect(sweep2.admissions.reEncountered.map((r) => r.externalId)).toEqual(["top"]);
    expect(sweep2.admissions.byArea[0].rejected.cap).toBe(1);

    // Next UTC day: the cap resets and the refused qualifier admits.
    const sweep3 = await runTrendIntake(
      ctx,
      repos,
      { watchlist: { source: "fake" }, areas: [cappedArea], nowMs: NOW + DAY },
      deps([third]),
    );
    expect(sweep3.admissions.admitted.map((a) => a.externalId)).toEqual(["third"]);
  });

  it("an ARMED stored baseline binds the Δ-velocity multiple: the uniform firehose is rejected, the genuine spiker admits with the Δ reason", async () => {
    const { ctx, repos, objectStore, embedder, area } = await setup();
    const bot = (externalId: string, views: number): TrendItem =>
      fixture(externalId, { account: "bot", metrics: { views } });
    const deps = (items: TrendItem[]) => ({
      source: createFakeTrendSource(items),
      embedder,
      objectStore,
      capTokens: 1_000_000,
    });

    // Sweep 1 stores the history: a/b/c pass floors and admit (baseline still
    // unarmed — one snapshot each); d sits under the views floor.
    const sweep1 = await runTrendIntake(
      ctx,
      repos,
      { watchlist: { source: "fake" }, areas: [area], nowMs: NOW },
      deps([bot("a", 30_000), bot("b", 30_000), bot("c", 30_000), bot("d", 5_000)]),
    );
    expect(sweep1.admissions.admitted.map((r) => r.externalId).sort()).toEqual(["a", "b", "c"]);
    expect(sweep1.admissions.byArea[0].rejected.floors).toBe(1);

    // Sweep 2, +2h: a/b/c gained 10k views (Δ 5000/h — the account's own
    // uniform pace); d gained 40k (Δ 20000/h = 4× the stored baseline).
    const sweep2 = await runTrendIntake(
      ctx,
      repos,
      { watchlist: { source: "fake" }, areas: [area], nowMs: NOW + 2 * HOUR },
      deps([bot("a", 40_000), bot("b", 40_000), bot("c", 40_000), bot("d", 45_000)]),
    );
    expect(sweep2.admissions.admitted.map((r) => r.externalId)).toEqual(["d"]);
    expect(sweep2.admissions.byArea[0].rejected.velocity).toBe(3);
    expect(sweep2.admissions.reEncountered).toEqual([]); // velocity-rejected before the hash check

    const source = await repos.sources.get(ctx, sweep2.admissions.admitted[0].sourceId);
    const meta = source!.meta as { trend: { reasons: string[] } };
    expect(meta.trend.reasons).toContain(
      "Δ-velocity 20000/h is ≥ 4× the account's stored baseline 5000/h",
    );
  });

  it("the tenant's G1 denylist screens admission candidates — denylisted craft never enters the pool", async () => {
    const { ctx, repos, objectStore, embedder, area } = await setup(["miracle cure"]);
    const result = await runTrendIntake(
      ctx,
      repos,
      { watchlist: { source: "fake" }, areas: [area], nowMs: NOW },
      {
        source: createFakeTrendSource([
          fixture("spam", { text: `${longBody("spam")} This miracle cure sells itself.` }),
        ]),
        embedder,
        objectStore,
        capTokens: 1_000_000,
      },
    );
    expect(result.admissions.byArea[0].rejected.denylist).toBe(1);
    expect(result.admissions.admitted).toEqual([]);
    expect(result.screened).toEqual([]); // the legacy door never saw an outlier
    expect(await repos.sources.listByKind(ctx, ["exemplar"])).toEqual([]);
  });

  it("a budget-rail refusal at the door is logged VERBATIM and never fatal — the sweep completes", async () => {
    const { ctx, repos, objectStore, embedder, area } = await setup();
    const filler = [fixture("f1", { metrics: { views: 2_000 } }), fixture("f2", { metrics: { views: 2_000 } })];

    // Sweep 1: nothing qualifies; the ranking embed records the only usage.
    await runTrendIntake(
      ctx,
      repos,
      { watchlist: { source: "fake" }, areas: [area], nowMs: NOW },
      { source: createFakeTrendSource(filler), embedder, objectStore, capTokens: 1_000_000 },
    );
    const spent = await repos.usageLedger.totalForDay(ctx);
    const capTokens = spent.tokensIn + spent.tokensOut + 1;

    // Sweep 2 carries a NEW qualifier long enough (600 words > the 500-word
    // chunk target) that the door's chunks are cache MISSES: the ranking
    // embed (one miss, the new text) crosses the cap, so the door's metered
    // call refuses — and the sweep still returns whole.
    const bigwin = fixture("bigwin", {
      text: Array.from({ length: 600 }, (_, i) => `word${i}`).join(" "),
    });
    const result = await runTrendIntake(
      ctx,
      repos,
      { watchlist: { source: "fake" }, areas: [area], nowMs: NOW + 2 * HOUR },
      { source: createFakeTrendSource([...filler, bigwin]), embedder, objectStore, capTokens },
    );

    expect(result.polled).toBe(3); // the sweep itself completed
    expect(result.admissions.admitted).toEqual([]);
    expect(result.admissions.budgetRefusals).toEqual([
      {
        areaId: area.id,
        externalId: "bigwin",
        reason: expect.stringContaining("over its daily token budget"),
      },
    ]);
    expect(await repos.sources.listByKind(ctx, ["exemplar"])).toEqual([]);
  });

  it("a per-area enabled:false override ON THE AREA ROW watches without admitting", async () => {
    const { ctx, repos, objectStore, embedder, area } = await setup();
    const result = await runTrendIntake(
      ctx,
      repos,
      {
        watchlist: { source: "fake" },
        areas: [{ ...area, config: { admission: { enabled: false } } }],
        nowMs: NOW,
      },
      { source: createFakeTrendSource([fixture("win")]), embedder, objectStore, capTokens: 1_000_000 },
    );
    expect(result.admissions.admitted).toEqual([]);
    expect(result.admissions.byArea[0]).toMatchObject({ enabled: false, considered: 1, admitted: 0 });
  });

  it("the UTC-day cap holds under RACING sweeps — the durable-ledger pin the in-memory count could not pass", async () => {
    const { ctx, repos, objectStore, embedder, area } = await setup();

    // Barrier: BOTH passes must finish their day-count read and reach the
    // content-hash pre-check before either claims. The retired in-memory
    // count read 0 twice here and admitted twice past a cap of 1; the
    // durable claim serializes on the ledger's unique slot index instead.
    let arrived = 0;
    let release: () => void = () => {};
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const gatedRepos = {
      ...repos,
      sources: {
        ...repos.sources,
        getByContentHash: async (c: typeof ctx, hash: string) => {
          arrived++;
          if (arrived >= 2) release();
          await barrier;
          return repos.sources.getByContentHash(c, hash);
        },
      },
    };

    const rankedRow = (item: TrendItem): RankedCandidate => ({
      item,
      areaId: area.id,
      areaName: area.name,
      score: 0.9,
      components: { relevance: 1, engagement: null, velocity: null, freshness: 0.5 },
      weights: { relevance: 1, engagement: 1, velocity: 1, freshness: 1 },
      reasons: [],
    });
    const pass = (externalId: string) => {
      const item = fixture(externalId);
      return runAdmissions(
        ctx,
        gatedRepos,
        {
          source: "fake",
          nowMs: NOW,
          denylist: [],
          areas: [{ id: area.id, name: area.name, admission: { maxAdmissionsPerDay: 1 } }],
          ranked: [rankedRow(item)],
          attribution: new Map([[externalId, { areaId: area.id, areaName: area.name }]]),
          longitudinal: new Map(),
          alreadyProcessed: new Set(),
        },
        { embedder, objectStore, capTokens: 1_000_000 },
      );
    };

    const [a, b] = await Promise.all([pass("race-a"), pass("race-b")]);
    expect([...a.admitted, ...b.admitted]).toHaveLength(1);
    expect(a.byArea[0].rejected.cap + b.byArea[0].rejected.cap).toBe(1);
    // The pool and the ledger agree: exactly one slot, exactly one exemplar.
    expect(await repos.sources.listByKind(ctx, ["exemplar"])).toHaveLength(1);
    expect((await repos.trendAdmissions.countsForDay(ctx, NOW)).get(area.id)).toBe(1);
  });

  it("without active areas the admission pass reports empty — the pre-B6.4 sweep shape is untouched", async () => {
    const { ctx, repos, objectStore, embedder, area } = await setup();
    const result = await runTrendIntake(
      ctx,
      repos,
      { watchlist: { source: "fake" }, nowMs: NOW },
      { source: createFakeTrendSource([fixture("win")]), embedder, objectStore, capTokens: 1_000_000 },
    );
    expect(result.admissions).toEqual({
      admitted: [],
      reEncountered: [],
      byArea: [],
      budgetRefusals: [],
    });
  });
});
