import type { TenantCtx } from "@thalon/contracts";
import type { Draft, Repos } from "@thalon/db";
import { readEnv } from "@thalon/platform";
import {
  GATE_FOR_TIER,
  assembleLadderEvidence,
  meteredTierDriver,
  runGateLadder,
  type GateLadderRow,
} from "./gate-ladder";
import type { JudgeModelDriver, SourceChunkInput } from "./shell/driver";

/**
 * The candidate judge (s89, closing the s88 R8 deviation): grade a body that
 * is NOT on the draft — the same gate ladder, the same denylist, the same
 * grounding assembly as the judge of record — and persist NOTHING.
 *
 * No `judge_results` row is ever appended here, because a verdict about text
 * that is not on the draft has no honest `body_hash` to bind to, and an
 * unbound (or wrongly-bound) verdict would mint I1 standing for content the
 * landing judge never read — exactly the hole I1 exists to close. No
 * transition is made; the draft row is never written. The ONE write this
 * entry point still makes is usage metering (`meteredTierDriver`): an
 * unmetered model call would be a tenant-budget bypass, its own safety hole
 * (SPINE §1; amendment A2). Its spend is labeled `judge.candidate.g3_*` so
 * the ledger/traces never confuse advisory spend with the judge of record.
 *
 * A PASSING candidate verdict confers nothing. Landing the body must still
 * go through the existing edit door and `runJudgePipeline`, whose verdict —
 * bound to the NEW body hash — is the only one I1 can honestly accept. That
 * double judge is deliberate; reusing a candidate verdict for a landed body
 * re-opens the hole above.
 */

export interface JudgeCandidateInput {
  ctx: TenantCtx;
  /**
   * The draft whose body the candidate would replace — passed as the row,
   * not an id, because nothing here re-reads or writes it. Its platform,
   * format, meta and grounding sources define the judging context, so the
   * candidate is graded under EXACTLY the conditions the landing judge would
   * apply.
   */
  draft: Draft;
  /** The body under judgment — NOT the draft's persisted body. */
  candidateBody: string;
  /** Grounding-evidence OVERRIDE — same semantics as the pipeline's (tests; identity is still appended). */
  chunks?: SourceChunkInput[];
  screenDriver: JudgeModelDriver;
  finalDriver: JudgeModelDriver;
  /** Overrides the tenant daily token budget cap (tests only; production reads TENANT_DAILY_TOKEN_BUDGET). */
  capTokens?: number;
}

/**
 * NOT A VERDICT OF RECORD. `ofRecord: false` is a literal, not a flag — this
 * type exists so no call site can mistake an advisory candidate outcome for
 * a persisted `PipelineOutcome` (there is no draft here, no status, no row).
 * `gates` carries each rung's evidence for operator-facing refusal detail;
 * it lives only in this return value.
 */
export type CandidateOutcome =
  | { ofRecord: false; verdict: "pass"; gates: GateLadderRow[] }
  | { ofRecord: false; verdict: "fail"; reason: string; gates: GateLadderRow[] };

export async function judgeCandidate(
  repos: Repos,
  input: JudgeCandidateInput,
): Promise<CandidateOutcome> {
  const { denylist, chunks, cadence } = await assembleLadderEvidence(
    input.ctx,
    repos,
    input.draft,
    input.chunks,
  );
  const capTokens = input.capTokens ?? readEnv().TENANT_DAILY_TOKEN_BUDGET;
  const metered = (tier: "screen" | "final", driver: JudgeModelDriver) =>
    meteredTierDriver({
      ctx: input.ctx,
      repos,
      capTokens,
      tier,
      operation: `judge.candidate.${GATE_FOR_TIER[tier]}`,
      driver,
    });

  const gates: GateLadderRow[] = [];
  const outcome = await runGateLadder({
    body: input.candidateBody,
    platform: input.draft.platform,
    format: input.draft.format,
    meta: input.draft.meta,
    denylist,
    chunks,
    ...(cadence ? { cadence } : {}),
    screenDriver: metered("screen", input.screenDriver),
    finalDriver: metered("final", input.finalDriver),
    // Collecting is THIS entry point's whole persistence story: the rows go
    // into the return value and nowhere else.
    onGate: async (row) => {
      gates.push(row);
    },
  });

  return outcome.verdict === "pass"
    ? { ofRecord: false, verdict: "pass", gates }
    : { ofRecord: false, verdict: "fail", reason: outcome.reason, gates };
}
