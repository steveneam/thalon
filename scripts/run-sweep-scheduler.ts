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
import { openDb } from "../packages/db/src/index";
import { runDueSweeps } from "../packages/engine/src/index";

const MINUTE_MS = 60_000;
const MIN_TICK_MS = 1 * MINUTE_MS;
/** The contract's cadence floor (contracts SWEEP_CADENCE_MIN_MINUTES) — the largest useful tick. */
const MAX_TICK_MS = 15 * MINUTE_MS;

function stamp(): string {
  return new Date().toISOString();
}

async function pass(repos: Awaited<ReturnType<typeof openDb>>["repos"]): Promise<{
  failed: number;
  tickMs: number;
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
  const tick = async (): Promise<void> => {
    if (stopped) return;
    let tickMs = MAX_TICK_MS;
    try {
      tickMs = (await pass(handle.repos)).tickMs;
    } catch (err) {
      // A pass-level failure (db down, seam mismatch) is loud but non-fatal —
      // the loop keeps ticking so recovery needs no operator restart.
      console.error(`[${stamp()}] PASS FAILED: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!stopped) timer = setTimeout(() => void tick(), tickMs);
  };
  await tick();
}

void main();
