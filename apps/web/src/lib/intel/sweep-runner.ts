import type { TenantCtx } from "@thalon/contracts";
import type { Repos } from "@thalon/db";
import {
  runTrendSweep,
  tenantTrendSource,
  type TrendSweepDeps,
  type TrendSweepResult,
} from "@thalon/engine";
import { readEnv } from "@thalon/platform";

/**
 * Sweep-now (B6.5): runs ONE live sweep for the operated tenant — the same
 * `runTrendSweep` the B-arm.1 scheduler ticks. The judge-runner pattern:
 * deps injectable so tests stay keyless (fake source + fake embedder);
 * production resolves the driver per tenant, VAULT-FIRST (B-int.3
 * `tenantTrendSource`: connected intel credentials fill the seats env left
 * silent, env wins where set, TREND_SOURCE still selects) — the identical
 * resolution the scheduler uses, one precedence table. Driver refusals
 * (over-budget sweep, missing Bluesky credentials) rethrow unchanged — the
 * route surfaces them VERBATIM; an honest error beats a fake spinner.
 */
export async function runIntelSweep(
  repos: Repos,
  ctx: TenantCtx,
  deps: TrendSweepDeps = {},
): Promise<TrendSweepResult> {
  const source = deps.source ?? (await tenantTrendSource({ repos, ctx, env: readEnv() }));
  return runTrendSweep(ctx, repos, { nowMs: Date.now() }, { ...deps, source });
}
