import type { TenantCtx } from "@thalon/contracts";
import type { Draft, Repos } from "@thalon/db";
import { readEnv } from "@thalon/platform";
import { gatewayJudgeDriver, runJudgePipeline, type JudgeModelDriver, type PipelineOutcome } from "@thalon/judge";

export interface JudgeRunnerDeps {
  /** Test-only: inject scripted drivers so this stays keyless. Defaults to the real gateway driver — the exact wiring eval/src/dogfood.ts's CLI entrypoint uses. */
  screenDriver?: JudgeModelDriver;
  finalDriver?: JudgeModelDriver;
  /** Test-only: overrides the tenant daily token budget cap. Production reads TENANT_DAILY_TOKEN_BUDGET. */
  capTokens?: number;
}

/**
 * Runs the SAME judge pipeline eval/src/dogfood.ts uses (`runJudgePipeline`),
 * wired identically: grounding chunks from the draft's own source, the
 * tenant's daily token budget, and — by default — the real gateway driver
 * for both G3 tiers. Every gateway attempt is metered through
 * `withGatewayGuard` INSIDE `runJudgePipeline` itself (the B1.3 merge
 * lesson); this helper only supplies drivers, it never calls them directly,
 * so it cannot bypass that choke point.
 *
 * apps/web's edit and re-judge actions call this AFTER transitioning a draft
 * to `judging`, so their response reflects the fully-judged outcome (queued
 * or blocked) rather than the transient `judging` state. If the pipeline
 * itself throws (no gateway key, a budget halt, a malformed shell output
 * past every repair retry), this rethrows unchanged — the caller's route
 * surfaces it as a loud HTTP error, and the draft honestly stays `judging`
 * (nothing here catches or downgrades that failure).
 */
export async function runJudgeOnDraft(
  repos: Repos,
  ctx: TenantCtx,
  draft: Draft,
  deps: JudgeRunnerDeps = {},
): Promise<PipelineOutcome> {
  const chunks = (await repos.sourceChunks.listBySource(ctx, draft.sourceId)).map((chunk) => ({
    ref: chunk.id,
    text: chunk.text,
  }));
  return runJudgePipeline(repos, {
    ctx,
    draftId: draft.id,
    chunks,
    screenDriver: deps.screenDriver ?? gatewayJudgeDriver(),
    finalDriver: deps.finalDriver ?? gatewayJudgeDriver(),
    capTokens: deps.capTokens ?? readEnv().TENANT_DAILY_TOKEN_BUDGET,
  });
}
