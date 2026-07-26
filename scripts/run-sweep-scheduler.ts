/**
 * run-sweep-scheduler.ts — the B-arm.1 sweep-scheduler driver.
 *
 * The smallest honest timer over the deterministic core: each tick calls
 * `runDueSweeps` (packages/engine trend/sweep-scheduler) with a fresh
 * clock, logs one line per pass, and prints every per-tenant failure
 * VERBATIM (one tenant's failure never blocks another; a failed tenant
 * stays due and retries next tick). The repo has no other periodic-work
 * runner — dev/staging run this as a long-lived process beside the app;
 * production cron is deploy wiring, not this script's job.
 *
 * The tick interval is read FROM the schedule cadences each pass: the
 * smallest enabled cadence, clamped between 1 minute and the contract's
 * 15-minute cadence floor (so a due sweep is never more than one floor
 * late, and an idle box never spins). No enabled schedules = idle ticks at
 * the clamp ceiling, waiting for the config door to arm one.
 *
 * Usage (from repo root, same process env/seams as the app — DATABASE_URL
 * or the PGlite dev seam, TREND_SOURCE for the live driver):
 *   npx tsx scripts/run-sweep-scheduler.ts          # tick loop, Ctrl-C to stop
 *   npx tsx scripts/run-sweep-scheduler.ts --once   # one deterministic pass;
 *                                                   # exit 1 if any tenant failed
 */
// Relative into the packages' public surfaces (not "@thalon/*"): worktree
// lanes junction node_modules to the main checkout, so the package name would
// resolve to main's copy — the relative path always runs THIS checkout's code.
import { pathToFileURL } from "node:url";
import { openDb } from "../packages/db/src/index";
import { runDueSweeps } from "../packages/engine/src/index";

const MINUTE_MS = 60_000;
const MIN_TICK_MS = 1 * MINUTE_MS;
/** The contract's cadence floor (contracts SWEEP_CADENCE_MIN_MINUTES) — the largest useful tick. */
const MAX_TICK_MS = 15 * MINUTE_MS;

/**
 * FAILURE BACKOFF (s75) — the fix for a real, expensive incident.
 *
 * A failed sweep deliberately leaves `last_sweep_at` untouched (see the
 * sweep-schedules repo), so the tenant stays DUE and retries on the next
 * tick. That is right for a transient DB blip, but the tick floor is 15
 * minutes while a real cadence is hours — and a retry is not free. The
 * YouTube driver spends ~100 quota units per `search.list`, so one retry of
 * a 9-query watchlist costs ~900 of a 10,000-unit daily allowance.
 *
 * What happened on 2026-07-25: a sweep started failing for an unrelated
 * reason (the tenant's token budget), retried every 15 minutes, and burned
 * the entire day's YouTube quota in about eleven retries. The 429 that
 * followed was itself a failure, so it retried all day and admitted nothing.
 * The steady state was never the problem — at a 4-hour cadence a healthy day
 * spends ~5,400 of 10,000 units. The RETRY STORM was.
 *
 * So consecutive failing passes back the tick off geometrically, capped at
 * the smallest enabled cadence (never slower than the schedule itself asks
 * for) and reset the moment a pass comes back clean. Failures stay loud and
 * stay due; they simply stop billing an external quota every 15 minutes.
 */
const BACKOFF_CAP_MS = 4 * 60 * MINUTE_MS;

/** tick = base × 2^failures, capped by the schedule's own cadence (and a hard ceiling). */
export function backoffTickMs(baseTickMs: number, cadenceMs: number, consecutiveFailures: number): number {
  if (consecutiveFailures <= 0) return baseTickMs;
  const grown = baseTickMs * 2 ** Math.min(consecutiveFailures, 10);
  return Math.min(grown, Math.max(baseTickMs, cadenceMs), BACKOFF_CAP_MS);
}

function stamp(): string {
  return new Date().toISOString();
}

async function pass(repos: Awaited<ReturnType<typeof openDb>>["repos"]): Promise<{
  failed: number;
  tickMs: number;
  cadenceMs: number;
}> {
  const result = await runDueSweeps({ repos }, new Date());
  const sweptNote = result.swept
    .map((s) => `${s.tenantId} (${s.cards} cards / ${s.polled} polled / ${s.admitted} admitted)`)
    .join(", ");
  console.log(
    `[${stamp()}] pass: ${result.checked} schedule(s) checked, ${result.due.length} due, ` +
      `${result.swept.length} swept${sweptNote ? ` — ${sweptNote}` : ""}, ${result.failures.length} failed`,
  );
  for (const failure of result.failures) {
    console.error(`[${stamp()}] SWEEP FAILED tenant=${failure.tenantId}: ${failure.reason}`);
  }
  const cadenceMs =
    result.minEnabledCadenceMinutes !== null
      ? result.minEnabledCadenceMinutes * MINUTE_MS
      : MAX_TICK_MS;
  return {
    failed: result.failures.length,
    tickMs: Math.min(MAX_TICK_MS, Math.max(MIN_TICK_MS, cadenceMs)),
    cadenceMs,
  };
}

async function main(): Promise<void> {
  const once = process.argv.includes("--once");
  const handle = await openDb();

  if (once) {
    const { failed } = await pass(handle.repos);
    await handle.close();
    process.exit(failed > 0 ? 1 : 0);
  }

  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  const stop = () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    console.log(`[${stamp()}] scheduler stopping`);
    void handle.close().then(() => process.exit(0));
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  console.log(`[${stamp()}] sweep scheduler up (tick = min enabled cadence, clamped 1–15m)`);
  let consecutiveFailures = 0;
  const tick = async (): Promise<void> => {
    if (stopped) return;
    // Assigned on BOTH paths below — no dead initializer (no-useless-assignment).
    let tickMs: number;
    try {
      const result = await pass(handle.repos);
      consecutiveFailures = result.failed > 0 ? consecutiveFailures + 1 : 0;
      tickMs = backoffTickMs(result.tickMs, result.cadenceMs, consecutiveFailures);
    } catch (err) {
      // A pass-level failure (db down, seam mismatch) is loud but non-fatal —
      // the loop keeps ticking so recovery needs no operator restart.
      consecutiveFailures += 1;
      tickMs = backoffTickMs(MAX_TICK_MS, MAX_TICK_MS, consecutiveFailures);
      console.error(`[${stamp()}] PASS FAILED: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (consecutiveFailures > 0) {
      console.error(
        `[${stamp()}] backing off — ${consecutiveFailures} consecutive failing pass(es), next tick in ${Math.round(tickMs / MINUTE_MS)}m ` +
          `(retries are not free: a YouTube sweep spends ~100 quota units per query)`,
      );
    }
    if (!stopped) timer = setTimeout(() => void tick(), tickMs);
  };
  await tick();
}

// Run ONLY when executed as the entry point. Without this guard, importing
// this module (the backoff ratchet in tests/sweep-backoff.test.ts does) would
// open a database connection and start a live tick loop inside the importer.
const invokedDirectly =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) void main();
