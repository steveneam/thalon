import type { TenantCtx } from "@thalon/contracts";
import type { Repos } from "@thalon/db";
import { runTrendSweep, type TrendSweepDeps, type TrendSweepResult } from "@thalon/engine";

/**
 * Sweep-now (B6.5): runs ONE live sweep for the operated tenant — the same
 * `runTrendSweep` a scheduled job will call once cron lands at B6.7. The
 * judge-runner pattern: deps injectable so tests stay keyless (fake source +
 * fake embedder); production defaults to the env-selected TrendSource
 * (TREND_SOURCE) and the metered gateway embedder. Driver refusals (over-
 * budget sweep, missing Bluesky credentials) rethrow unchanged — the route
 * surfaces them VERBATIM; an honest error beats a fake spinner.
 */
export async function runIntelSweep(
  repos: Repos,
  ctx: TenantCtx,
  deps: TrendSweepDeps = {},
): Promise<TrendSweepResult> {
  return runTrendSweep(ctx, repos, { nowMs: Date.now() }, deps);
}
