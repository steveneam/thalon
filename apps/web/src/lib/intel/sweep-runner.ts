import type { TenantCtx } from "@thalon/contracts";
import type { Repos } from "@thalon/db";
import {
  envAdmissionConfig,
  runTrendSweep,
  tenantTrendSources,
  type TrendSource,
  type TrendSweepDeps,
  type TrendSweepResult,
} from "@thalon/engine";
import { readEnv } from "@thalon/platform";

export interface IntelSweepRun {
  /** One full sweep result per resolved driver, in swept order. */
  results: TrendSweepResult[];
  /** The LAST swept source's result — the freshest bundle, the route's summary line (the trends surface itself merges ALL sources since B-learn L2 slice 1). */
  primary: TrendSweepResult;
}

/**
 * Sweep-now (B6.5): runs ONE live sweep pass for the operated tenant — the
 * same path the B-arm.1 scheduler ticks. The judge-runner pattern: deps
 * injectable so tests stay keyless (fake source + fake embedder);
 * production resolves the drivers per tenant, VAULT-FIRST (B-int.3
 * `tenantTrendSources`: connected intel credentials fill the seats env left
 * silent, env wins where set, TREND_SOURCE still selects — comma-list = one
 * sweep per listed driver, the scheduler's identical resolution and loop,
 * one precedence table). `TREND_ADMISSION_CONFIG` rides every sweep the
 * same way it rides the soak's. Driver refusals (over-budget sweep, missing
 * Bluesky credentials) rethrow unchanged — the route surfaces them
 * VERBATIM; an honest error beats a fake spinner.
 */
export async function runIntelSweep(
  repos: Repos,
  ctx: TenantCtx,
  deps: TrendSweepDeps & { sources?: TrendSource[] } = {},
): Promise<IntelSweepRun> {
  const env = readEnv();
  const { sources: sourcesOverride, ...sweepDeps } = deps;
  const sources =
    sourcesOverride ??
    (sweepDeps.source ? [sweepDeps.source] : await tenantTrendSources({ repos, ctx, env }));
  const admissionConfig = envAdmissionConfig(env);
  const results: TrendSweepResult[] = [];
  for (const source of sources) {
    results.push(
      await runTrendSweep(ctx, repos, { nowMs: Date.now(), admissionConfig }, { ...sweepDeps, source }),
    );
  }
  return { results, primary: results[results.length - 1] };
}
