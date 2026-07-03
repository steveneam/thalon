import { FINAL_JUDGE_GATE, type TenantCtx } from "@thalon/contracts";
import type { Draft, Repos } from "@thalon/db";
import { modelTiers } from "@thalon/platform";
import { runG1Denylist } from "./g1-denylist";
import {
  promptVersionFor,
  type JudgeModelDriver,
  type JudgeTier,
  type SourceChunkInput,
} from "./shell/driver";
import { callTierJudge, type TierCallResult } from "./validate-shell-output";

const GATE_FOR_TIER: Record<JudgeTier, string> = {
  screen: "g3_screen",
  final: FINAL_JUDGE_GATE,
};

export interface RunJudgePipelineInput {
  ctx: TenantCtx;
  draftId: string;
  /** Grounding evidence: the provided source chunks both tiers judge claims against. */
  chunks: SourceChunkInput[];
  screenDriver: JudgeModelDriver;
  finalDriver: JudgeModelDriver;
}

export type PipelineOutcome =
  | { status: "queued"; draft: Draft }
  | { status: "blocked"; draft: Draft; reason: string };

/**
 * Deterministic core orchestration (SPINE §2.3 workflow 2; §1.1 state
 * machine). g1 fail ⇒ blocked, zero model calls. g1 pass ⇒ BOTH g3 tiers
 * always run — so a tier disagreement is observable rather than
 * short-circuited on the cheap tier — ⇒ pass/pass ⇒ queued; anything else
 * ⇒ blocked for operator triage (I3, ratified decision 2: a screen pass
 * never overrides a final fail, and vice versa — any disagreement blocks).
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

  const profile = await repos.brandProfiles.getActive(input.ctx);
  // Per-tenant denylist is DATA from brand_profiles — never hard-coded here.
  const denylist = (profile?.denylist as string[] | undefined) ?? [];
  const g1 = runG1Denylist({ body: judging.body, denylist });
  await repos.judgeResults.append(input.ctx, {
    draftId: judging.id,
    gate: "g1",
    verdict: g1.verdict,
    evidence: g1.evidence,
  });
  if (g1.verdict === "fail") {
    const blocked = await repos.drafts.transition(input.ctx, judging.id, "blocked", {
      reason: "g1 denylist fail",
    });
    return { status: "blocked", draft: blocked, reason: "g1 denylist fail" };
  }

  const screen = await runTier(repos, input, judging, "screen", input.screenDriver);
  const final = await runTier(repos, input, judging, "final", input.finalDriver);

  if (screen.verdict === "pass" && final.verdict === "pass") {
    const queued = await repos.drafts.transition(input.ctx, judging.id, "queued");
    return { status: "queued", draft: queued };
  }
  const reason =
    screen.verdict === final.verdict
      ? "both g3 tiers failed"
      : `g3 tier disagreement (screen=${screen.verdict}, final=${final.verdict})`;
  const blocked = await repos.drafts.transition(input.ctx, judging.id, "blocked", { reason });
  return { status: "blocked", draft: blocked, reason };
}

async function runTier(
  repos: Repos,
  input: RunJudgePipelineInput,
  draft: Draft,
  tier: JudgeTier,
  driver: JudgeModelDriver,
): Promise<TierCallResult> {
  const tiers = modelTiers();
  const model = tier === "screen" ? tiers.judgeScreen : tiers.judgeFinal;
  const promptVersion = promptVersionFor(tier);
  const startedAt = Date.now();
  const result = await callTierJudge(driver, { tier, body: draft.body, chunks: input.chunks });
  const latencyMs = Date.now() - startedAt;
  await repos.judgeResults.append(input.ctx, {
    draftId: draft.id,
    gate: GATE_FOR_TIER[tier],
    verdict: result.verdict,
    evidence: result.output
      ? {
          claims: result.output.claims.map((c) => ({
            claim: c.claim,
            verdict: c.supported ? ("pass" as const) : ("fail" as const),
            sourceRef: c.chunkRef,
          })),
          notes: result.output.notes,
        }
      : {
          claims: [],
          notes: `irrecoverable after ${result.attempts} attempt(s): malformed shell output`,
        },
    model,
    promptVersion,
    latencyMs,
  });
  return result;
}
