import { tenantCtx } from "@thalon/contracts";
import type { Repos } from "@thalon/db";
import { runTrendSweep, type TrendSweepDeps } from "./sweep";

/**
 * B-arm.1: the sweep scheduler's deterministic core — the plumbing between
 * "Sweep now" and live pollers. Today sweeps run only on the operator's
 * click; this module decides WHO is due and runs the existing sweep path
 * (`runTrendSweep`) for each due tenant, so a thin driver (see
 * `scripts/run-sweep-scheduler.ts`) can tick it on a timer.
 *
 * Doctrine (SPINE §1): the clock is ALWAYS an argument — `now` is passed
 * in, never read here, so every decision this file makes is replayable in
 * tests. `markSwept` receives the SAME `now` the due-math used, keeping
 * `last_sweep_at` the honest clock the schema promises ("set only when a
 * sweep actually ran").
 *
 * Failure honesty: one tenant's failure never blocks the others — each due
 * sweep runs in its own try/catch and lands in `failures` with the reason
 * VERBATIM (the dossiersFailed convention: reported, never silent). A
 * failed tenant's `lastSweepAt` is untouched, so it stays due and the next
 * tick retries. Success is durably recorded through `markSwept`, which
 * appends the `sweep.schedule_swept` event the activity/Runs surfaces can
 * show. The frozen Sprint-8 contract has no failure-record door (no
 * `markFailed`, no public event append), so failure durability stops at
 * the returned result + the driver's log — flagged for the re-charter, not
 * worked around.
 */

/** The schedule fields the due-math reads — structurally the frozen `sweep_schedules` row. */
export interface SweepScheduleLike {
  tenantId: string;
  enabled: boolean;
  cadenceMinutes: number;
  lastSweepAt: Date | null;
}

/**
 * Pure due-math: a tenant is due when its schedule is enabled AND it has
 * never swept OR `lastSweepAt + cadence` has arrived (boundary inclusive —
 * exactly-due IS due). Input order is preserved; disabled rows never
 * surface, however stale.
 */
export function findDueTenants(schedules: readonly SweepScheduleLike[], now: Date): string[] {
  return schedules
    .filter(
      (s) =>
        s.enabled &&
        (s.lastSweepAt === null ||
          s.lastSweepAt.getTime() + s.cadenceMinutes * 60_000 <= now.getTime()),
    )
    .map((s) => s.tenantId);
}

export interface RunDueSweepsDeps {
  repos: Repos;
  /** Sweep-path overrides (tests: fake source/embedder/object store) — production defaults per `runTrendSweep`. */
  sweepDeps?: TrendSweepDeps;
}

export interface DueSweepFailure {
  tenantId: string;
  /** The thrown message, verbatim — the operator reads the actual knob to turn, never a euphemism. */
  reason: string;
}

export interface RunDueSweepsResult {
  /** Schedule rows examined this pass (tenants without a row are disabled by definition). */
  checked: number;
  /** Tenant ids the due-math selected at `now`. */
  due: string[];
  /** Sweeps that ran AND were marked — `markSwept(now)` succeeded. */
  swept: Array<{ tenantId: string; cards: number; polled: number }>;
  /** Per-tenant failures, verbatim (reported, never silent) — these tenants stay due and retry next tick. */
  failures: DueSweepFailure[];
  /** Tick hint for drivers: the smallest enabled cadence, or null when nothing is enabled. */
  minEnabledCadenceMinutes: number | null;
}

/**
 * One scheduler pass: enumerate every tenant's schedule (system-level
 * `tenants.list`, the B4.6 precedent — due-ness is a cross-tenant
 * question), run the existing sweep path for each due tenant with the
 * schedule's own cadence as the bundle's advisory interval, and mark the
 * honest clock. Idempotent against `now`: a second pass at the same `now`
 * finds the swept tenants no longer due.
 */
export async function runDueSweeps(
  deps: RunDueSweepsDeps,
  now: Date,
): Promise<RunDueSweepsResult> {
  const { repos } = deps;
  const tenants = await repos.tenants.list();
  const schedules: SweepScheduleLike[] = [];
  for (const tenant of tenants) {
    const row = await repos.sweepSchedules.get(tenantCtx(tenant.id));
    if (row) schedules.push(row);
  }

  const due = findDueTenants(schedules, now);
  const byTenant = new Map(schedules.map((s) => [s.tenantId, s]));
  const swept: RunDueSweepsResult["swept"] = [];
  const failures: DueSweepFailure[] = [];

  for (const tenantId of due) {
    const schedule = byTenant.get(tenantId);
    if (!schedule) continue; // unreachable: due ids come from `schedules`
    const ctx = tenantCtx(tenantId);
    try {
      const result = await runTrendSweep(
        ctx,
        repos,
        { nowMs: now.getTime(), intervalMs: schedule.cadenceMinutes * 60_000 },
        deps.sweepDeps ?? {},
      );
      await repos.sweepSchedules.markSwept(ctx, now);
      swept.push({
        tenantId,
        cards: result.bundle.cards.length,
        polled: result.bundle.polled,
      });
    } catch (err) {
      failures.push({ tenantId, reason: err instanceof Error ? err.message : String(err) });
    }
  }

  const enabledCadences = schedules.filter((s) => s.enabled).map((s) => s.cadenceMinutes);
  return {
    checked: schedules.length,
    due,
    swept,
    failures,
    minEnabledCadenceMinutes: enabledCadences.length > 0 ? Math.min(...enabledCadences) : null,
  };
}
