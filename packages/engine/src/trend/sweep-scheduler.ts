import { tenantCtx } from "@thalon/contracts";
import type { Repos } from "@thalon/db";
import { readEnv, type ThalonEnv } from "@thalon/platform";
import { vaultIntelEnvView } from "../integrations/env-view";
import type { VaultDeps } from "../integrations/vault";
import { admissionConfigSchema, type AdmissionConfigInput } from "./admission";
import { getTrendSources, type TrendSourceDeps } from "./source-registry";
import { runTrendSweep, type TrendSweepDeps } from "./sweep";
import type { TrendSource } from "./trend-source";

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
 * tick retries. Success is durably recorded through `markSwept`
 * (`sweep.schedule_swept`), failure through `markFailed`
 * (`sweep.schedule_failed`, Sprint-8 window 2 — the door the B-arm.1 wrap
 * flagged) — both events the activity/Runs surfaces can show. markFailed
 * is best-effort: if the failure ledger itself throws (the DB is the thing
 * that's down), the returned `failures` entry still reports verbatim.
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

/**
 * B-int.3: the scheduler's per-tenant driver resolution — every credentialed
 * seam resolves vault-first by tenant. ONE tenant's merged intel view
 * (`vaultIntelEnvView`: connected `intel_youtube`/`intel_bluesky` rows fill
 * the credential seats env left silent, env wins where set) feeds the
 * env-selected registry sources. Exported so the manual Sweep-now caller
 * wires the identical resolution — one precedence table, one wiring.
 * Plural since s72: `TREND_SOURCE` accepts a comma-list; each resolved
 * driver sweeps in listed order (see `getTrendSources` on bundle ownership).
 */
export async function tenantTrendSources(
  deps: VaultDeps,
  sourceDeps?: TrendSourceDeps,
): Promise<TrendSource[]> {
  return getTrendSources(undefined, await vaultIntelEnvView(deps), sourceDeps);
}

/**
 * The soak's admission-knob channel (s72, the founder's "both" unlock):
 * `TREND_ADMISSION_CONFIG` carries the tenant-DEFAULT `admissionConfig` as
 * env JSON — since the B-learn L0 window homed per-area knobs on the
 * monitored-area row (`config.admission`), this channel carries defaults
 * ONLY. Validated HERE, once per pass — a malformed value throws with the
 * env var named, and a leftover per-area `areas` map (the removed
 * transitional shape) gets the targeted migration message (the driver logs
 * PASS FAILED loudly every tick until the operator fixes it; fail loud
 * beats sweeping with silently-dropped floors).
 */
export function envAdmissionConfig(env: ThalonEnv): AdmissionConfigInput | undefined {
  const raw = env.TREND_ADMISSION_CONFIG;
  if (!raw || raw.trim() === "") return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `TREND_ADMISSION_CONFIG is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }
  if (parsed !== null && typeof parsed === "object" && "areas" in parsed) {
    throw new Error(
      'TREND_ADMISSION_CONFIG carries tenant DEFAULTS only — the per-area "areas" override map moved to each monitored-area row\'s config.admission (B-learn L0); update the row config and remove the key',
    );
  }
  const result = admissionConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`TREND_ADMISSION_CONFIG does not match admissionConfigSchema: ${result.error.message}`);
  }
  return result.data;
}

export interface RunDueSweepsDeps {
  repos: Repos;
  /** Sweep-path overrides (tests: fake source/embedder/object store) — production defaults per `runTrendSweep`. An injected `source` skips the per-tenant vault resolution entirely. */
  sweepDeps?: TrendSweepDeps;
  /** Multi-source override (tests) — the full resolved driver LIST; wins over `sweepDeps.source`. Production resolves per tenant via `tenantTrendSources`. */
  sources?: TrendSource[];
  /** The validated env the vault-first driver resolution merges over — defaults to the process env choke point. */
  env?: ThalonEnv;
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
  /** Sweeps that ran AND were marked — `markSwept(now)` succeeded. `admitted` = exemplars the B-learn L1 admission pass created this sweep. */
  swept: Array<{ tenantId: string; cards: number; polled: number; admitted: number }>;
  /** Per-tenant failures, verbatim (reported, never silent) — these tenants stay due and retry next tick. */
  failures: DueSweepFailure[];
  /** Tick hint for drivers: the smallest enabled cadence, or null when nothing is enabled. */
  minEnabledCadenceMinutes: number | null;
}

/**
 * One scheduler pass: enumerate every tenant's schedule in one system-level
 * read (`sweepSchedules.listAll`, Sprint-8 window 2 — due-ness is a
 * cross-tenant question, the `tenants.list` B4.6 precedent), run the
 * existing sweep path for each due tenant with the schedule's own cadence
 * as the bundle's advisory interval, and mark the honest clock. Idempotent
 * against `now`: a second pass at the same `now` finds the swept tenants no
 * longer due.
 */
export async function runDueSweeps(
  deps: RunDueSweepsDeps,
  now: Date,
): Promise<RunDueSweepsResult> {
  const { repos } = deps;
  const schedules: SweepScheduleLike[] = await repos.sweepSchedules.listAll();

  const due = findDueTenants(schedules, now);
  const byTenant = new Map(schedules.map((s) => [s.tenantId, s]));
  const swept: RunDueSweepsResult["swept"] = [];
  const failures: DueSweepFailure[] = [];

  const sweepDeps = deps.sweepDeps ?? {};
  const env = deps.env ?? readEnv();
  // Validated once per pass — malformed config fails the WHOLE pass loudly
  // (a box-level knob, not a tenant's), before any tenant sweeps half-armed.
  const admissionConfig = envAdmissionConfig(env);

  for (const tenantId of due) {
    const schedule = byTenant.get(tenantId);
    if (!schedule) continue; // unreachable: due ids come from `schedules`
    const ctx = tenantCtx(tenantId);
    try {
      // B-int.3: driver resolution is per-tenant and vault-first — inside
      // the try, so a vault misconfiguration (rows without a master key)
      // reports verbatim for THIS tenant and never blocks the others.
      const sources =
        deps.sources ??
        (sweepDeps.source ? [sweepDeps.source] : await tenantTrendSources({ repos, ctx, env }));
      // Each listed driver runs the FULL sweep path in order (intake +
      // admissions all persist per source; the last source's bundle owns the
      // trends surface — getTrendSources documents the interim). Any driver's
      // failure fails the tenant verbatim and skips markSwept, so the whole
      // list retries next tick — sweeps are idempotent against re-polling
      // (content-hash dedup, append-only snapshots).
      const totals = { cards: 0, polled: 0, admitted: 0 };
      for (const source of sources) {
        try {
          const result = await runTrendSweep(
            ctx,
            repos,
            { nowMs: now.getTime(), intervalMs: schedule.cadenceMinutes * 60_000, admissionConfig },
            { ...sweepDeps, source },
          );
          totals.cards += result.bundle.cards.length;
          totals.polled += result.bundle.polled;
          totals.admitted += result.intake.admissions.admitted.length;
        } catch (err) {
          // Name the failing driver only when there IS a list to disambiguate
          // — the single-source reason stays verbatim (the pinned contract).
          if (sources.length > 1) {
            const reason = err instanceof Error ? err.message : String(err);
            throw new Error(`[${source.name}] ${reason}`, { cause: err });
          }
          throw err;
        }
      }
      await repos.sweepSchedules.markSwept(ctx, now);
      swept.push({ tenantId, ...totals });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      failures.push({ tenantId, reason });
      try {
        await repos.sweepSchedules.markFailed(ctx, { at: now, reason });
      } catch {
        // The failure ledger itself failed (likely the same outage) — the
        // returned failures entry above still reports the reason verbatim.
      }
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
