import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import { createFakeEmbeddingDriver } from "../../ingest/shell/embedder";
import { readSweepBundle } from "../sweep";
import { findDueTenants, runDueSweeps, type SweepScheduleLike } from "../sweep-scheduler";
import type { TrendItem, TrendSource } from "../trend-source";

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

const NOW = new Date(1_750_000_000_000);
const MINUTE = 60_000;

function schedule(overrides: Partial<SweepScheduleLike> & { tenantId: string }): SweepScheduleLike {
  return { enabled: true, cadenceMinutes: 240, lastSweepAt: null, ...overrides };
}

describe("findDueTenants", () => {
  it("never-swept enabled schedules are due immediately", () => {
    expect(findDueTenants([schedule({ tenantId: "a" })], NOW)).toEqual(["a"]);
  });

  it("exactly-due IS due (boundary inclusive), one minute early is not", () => {
    const exactly = schedule({
      tenantId: "a",
      lastSweepAt: new Date(NOW.getTime() - 240 * MINUTE),
    });
    const early = schedule({
      tenantId: "b",
      lastSweepAt: new Date(NOW.getTime() - 239 * MINUTE),
    });
    expect(findDueTenants([exactly, early], NOW)).toEqual(["a"]);
  });

  it("disabled schedules never surface, however stale", () => {
    const stale = schedule({
      tenantId: "a",
      enabled: false,
      lastSweepAt: new Date(NOW.getTime() - 10_000 * MINUTE),
    });
    const neverSweptDisabled = schedule({ tenantId: "b", enabled: false });
    expect(findDueTenants([stale, neverSweptDisabled], NOW)).toEqual([]);
  });

  it("preserves input order across multiple due tenants", () => {
    expect(
      findDueTenants([schedule({ tenantId: "b" }), schedule({ tenantId: "a" })], NOW),
    ).toEqual(["b", "a"]);
  });
});

const AREA = { name: "AI video tooling", description: "Deterministic render pipelines for faceless channels" };

function items(account: string): TrendItem[] {
  return [
    {
      externalId: `${account}-hot`,
      text: AREA.description,
      account,
      publishedAt: NOW.getTime() - 24 * 3_600_000,
      metrics: { views: 120_000, shares: 3_000, bookmarks: 5_000 },
    },
  ];
}

/** Fake-shaped source that refuses one marked account — the per-tenant failure injector. */
function faultySource(all: TrendItem[], refuseAccount: string): TrendSource {
  return {
    name: "fake",
    async poll(watchlist) {
      if (watchlist.accounts.includes(refuseAccount)) {
        throw new Error(`driver refused: ${refuseAccount} credentials missing`);
      }
      const watched = new Set(watchlist.accounts);
      return all.filter((item) => watched.has(item.account));
    },
  };
}

async function setupTenant(
  repos: Repos,
  slug: string,
  account: string,
): Promise<TenantCtx> {
  const tenant = await repos.tenants.create({ slug, name: slug });
  const ctx = tenantCtx(tenant.id);
  await repos.brandProfiles.create(ctx, {
    config: { voice: {}, denylist: [], platformProfiles: {} },
    activate: true,
  });
  await repos.monitoredAreas.create(ctx, AREA);
  await repos.watchlists.create(ctx, { source: "fake", accounts: [account] });
  return ctx;
}

describe("runDueSweeps", () => {
  it("sweeps every due tenant, marks the SAME passed clock, and leaves the not-yet-due alone", async () => {
    handle = await openTestDb();
    const { repos } = handle;
    storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-sched-"));
    const objectStore = new LocalObjectStore(storeRoot);
    const embedder = createFakeEmbeddingDriver(1536);

    const ctxA = await setupTenant(repos, "alpha", "alpha");
    const ctxB = await setupTenant(repos, "beta", "beta");
    const ctxC = await setupTenant(repos, "gamma", "gamma");
    await repos.sweepSchedules.upsert(ctxA, { enabled: true, cadenceMinutes: 60 });
    await repos.sweepSchedules.upsert(ctxB, { enabled: true, cadenceMinutes: 240 });
    // gamma configured but disabled — never due.
    await repos.sweepSchedules.upsert(ctxC, { enabled: false, cadenceMinutes: 60 });
    // beta swept recently — not yet due.
    await repos.sweepSchedules.markSwept(ctxB, new Date(NOW.getTime() - 30 * MINUTE));

    const all = [...items("alpha"), ...items("beta"), ...items("gamma")];
    const sweepDeps = {
      source: faultySource(all, "nobody"),
      embedder,
      objectStore,
      capTokens: 1_000_000,
    };

    const result = await runDueSweeps({ repos, sweepDeps }, NOW);
    expect(result.checked).toBe(3);
    expect(result.due).toEqual([ctxA.tenantId]);
    expect(result.failures).toEqual([]);
    expect(result.swept).toEqual([{ tenantId: ctxA.tenantId, cards: 1, polled: 1 }]);
    expect(result.minEnabledCadenceMinutes).toBe(60);

    // The honest clock: last_sweep_at is EXACTLY the passed `now`.
    const rowA = await repos.sweepSchedules.get(ctxA);
    expect(rowA?.lastSweepAt?.getTime()).toBe(NOW.getTime());
    // ...and the durable record surfaces can show landed with it.
    const eventsA = await repos.events.list(ctxA, { entityType: "sweep_schedule" });
    expect(eventsA.map((e) => e.event)).toContain("sweep.schedule_swept");

    // The bundle persisted through the existing sweep path with the schedule's cadence.
    const bundle = await readSweepBundle(ctxA.tenantId, objectStore);
    expect(bundle?.sweptAtMs).toBe(NOW.getTime());
    expect(bundle?.intervalMs).toBe(60 * MINUTE);

    // Idempotent against `now`: a second pass at the same clock finds nobody due.
    const again = await runDueSweeps({ repos, sweepDeps }, NOW);
    expect(again.due).toEqual([]);
    expect(again.swept).toEqual([]);
  });

  it("one tenant's failure never blocks the others and stays honestly reported + retryable", async () => {
    handle = await openTestDb();
    const { repos } = handle;
    storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-sched-"));
    const objectStore = new LocalObjectStore(storeRoot);
    const embedder = createFakeEmbeddingDriver(1536);

    const ctxBad = await setupTenant(repos, "bad", "boom");
    const ctxGood = await setupTenant(repos, "good", "steady");
    await repos.sweepSchedules.upsert(ctxBad, { enabled: true, cadenceMinutes: 60 });
    await repos.sweepSchedules.upsert(ctxGood, { enabled: true, cadenceMinutes: 60 });

    const all = [...items("boom"), ...items("steady")];
    const sweepDeps = {
      source: faultySource(all, "boom"),
      embedder,
      objectStore,
      capTokens: 1_000_000,
    };

    const result = await runDueSweeps({ repos, sweepDeps }, NOW);
    expect(result.due).toEqual([ctxBad.tenantId, ctxGood.tenantId]);
    // The failure is verbatim, and the good tenant swept anyway.
    expect(result.failures).toEqual([
      { tenantId: ctxBad.tenantId, reason: "driver refused: boom credentials missing" },
    ]);
    expect(result.swept).toEqual([{ tenantId: ctxGood.tenantId, cards: 1, polled: 1 }]);

    // The failed tenant's clock is untouched — it stays due and retries next tick.
    expect((await repos.sweepSchedules.get(ctxBad))?.lastSweepAt).toBeNull();

    // Sprint-8 window 2: the failure is DURABLE — markFailed appended the
    // event with the reason verbatim, so the Runs/activity surfaces can show it.
    const badEvents = await repos.events.list(ctxBad, { entityType: "sweep_schedule" });
    const failed = badEvents.filter((e) => e.event === "sweep.schedule_failed");
    expect(failed).toHaveLength(1);
    expect((failed[0].payload as { reason: string }).reason).toBe(
      "driver refused: boom credentials missing",
    );

    const retry = await runDueSweeps({ repos, sweepDeps }, new Date(NOW.getTime() + MINUTE));
    expect(retry.due).toEqual([ctxBad.tenantId]);
  });
});
