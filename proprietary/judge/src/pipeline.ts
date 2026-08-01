import type { TenantCtx } from "@thalon/contracts";
import type { Draft, Repos } from "@thalon/db";
import { readEnv } from "@thalon/platform";
import {
  GATE_FOR_TIER,
  assembleLadderEvidence,
  meteredTierDriver,
  runGateLadder,
} from "./gate-ladder";
import type { JudgeModelDriver, SourceChunkInput } from "./shell/driver";

export interface RunJudgePipelineInput {
  ctx: TenantCtx;
  draftId: string;
  /**
   * Grounding-evidence OVERRIDE (tests / callers with pre-assembled
   * evidence). Omitted — the production default — the pipeline assembles it
   * itself via `collectGroundingChunks`: every source in the draft's
   * `meta.groundingSourceIds` (B3.9 multi-source drafts), else the draft's
   * own source. Assembling inside the pipeline means no caller can
   * under-ground a multi-source draft.
   */
  chunks?: SourceChunkInput[];
  screenDriver: JudgeModelDriver;
  finalDriver: JudgeModelDriver;
  /** Overrides the tenant daily token budget cap for this run (tests only; production reads TENANT_DAILY_TOKEN_BUDGET). */
  capTokens?: number;
}

export type PipelineOutcome =
  | { status: "queued"; draft: Draft }
  | { status: "blocked"; draft: Draft; reason: string };

/**
 * The judge OF RECORD: the persist-and-transition wrapper around the shared
 * gate ladder (`gate-ladder.ts` — one ladder, two entry points; the other is
 * `judgeCandidate`, which persists nothing). This wrapper resolves the
 * draft, transitions it to `judging`, assembles evidence through the shared
 * assembly, appends every rung's verdict via `repos.judgeResults` (bound to
 * the draft's CURRENT body hash), and transitions on the outcome.
 * The `→ queued` transition below re-checks for itself that a passing
 * g3_final row exists for the CURRENT body hash (I1, enforced in
 * `@thalon/db` `repos/drafts.ts`) — this orchestration cannot bypass that
 * gate even if it tried to.
 */
export async function runJudgePipeline(
  repos: Repos,
  input: RunJudgePipelineInput,
): Promise<PipelineOutcome> {
  const draft = await repos.drafts.get(input.ctx, input.draftId);
  const judging =
    draft.status === "judging"
      ? draft
      : await repos.drafts.transition(input.ctx, draft.id, "judging");

  const { denylist, chunks, cadence } = await assembleLadderEvidence(
    input.ctx,
    repos,
    judging,
    input.chunks,
  );
  const capTokens = input.capTokens ?? readEnv().TENANT_DAILY_TOKEN_BUDGET;
  const metered = (tier: "screen" | "final", driver: JudgeModelDriver) =>
    meteredTierDriver({
      ctx: input.ctx,
      repos,
      capTokens,
      tier,
      operation: `judge.${GATE_FOR_TIER[tier]}`,
      driver,
    });

  const outcome = await runGateLadder({
    body: judging.body,
    platform: judging.platform,
    format: judging.format,
    meta: judging.meta,
    denylist,
    chunks,
    ...(cadence ? { cadence } : {}),
    screenDriver: metered("screen", input.screenDriver),
    finalDriver: metered("final", input.finalDriver),
    // Persisting is THIS entry point's job: each rung's verdict lands as a
    // judge_results row the moment the rung completes, hash-bound by
    // `append`'s default to the body the ladder actually read.
    onGate: async (row) => {
      await repos.judgeResults.append(input.ctx, { draftId: judging.id, ...row });
    },
  });

  if (outcome.verdict === "pass") {
    const queued = await repos.drafts.transition(input.ctx, judging.id, "queued");
    return { status: "queued", draft: queued };
  }
  const blocked = await repos.drafts.transition(input.ctx, judging.id, "blocked", {
    reason: outcome.reason,
  });
  return { status: "blocked", draft: blocked, reason: outcome.reason };
}
