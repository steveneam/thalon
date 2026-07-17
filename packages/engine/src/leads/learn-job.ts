import { icpSchema, type Icp, type LeadWeightMultipliers, type TenantCtx } from "@thalon/contracts";
import { sha256Hex, stableStringify, type Repos } from "@thalon/db";
import {
  learnLeadWeights,
  leadTriageEvalPayloadSchema,
  type LeadLearnConfigInput,
  type LeadTriageVerdict,
} from "./learn";

/**
 * B-crm.5 learn job — deterministic, idempotent, zero LLM calls (the
 * scoring-job discipline). Reads the tenant's lead_triage eval rows, runs
 * the pure Beta-posterior/Wilson core, and lands the result as an
 * append-only lead_weight_states version. Replaying over the same verdicts
 * appends nothing — the (tenant, profile_hash, evidence_hash) structural
 * key does the work. The state binds to the ICP hash it was computed
 * against; the scoring job applies it only while that hash is current, so
 * a profile edit disarms learned weights until this job re-runs.
 */

export interface LeadWeightLearningRequest {
  /** The job's clock, ms epoch — deterministic, never read in core (SPINE §1). */
  nowMs: number;
  config?: LeadLearnConfigInput;
  /** Ceiling on eval rows read per pass (default 10_000 — far above any real tenant today). */
  evalRowLimit?: number;
}

export interface LeadWeightLearningResult {
  /** false = no active profile or no ICP block — the learn loop is not armed for this tenant. */
  armed: boolean;
  reason?: string;
  /** lead_triage eval rows read / final per-lead verdicts consumed. */
  rows: number;
  verdicts: number;
  /** The state version this run's evidence lives in (null = nothing to learn from). */
  stateId: string | null;
  /** true = this run appended a NEW version; false = replay of an existing one (or no state). */
  created: boolean;
  multipliers: LeadWeightMultipliers | null;
  /** The learn core's readable lines — why each weight moved or held. */
  reasons: string[];
  /** Hash of the ICP block this run learned against. */
  profileHash: string | null;
}

export async function runLeadWeightLearning(
  ctx: TenantCtx,
  repos: Repos,
  request: LeadWeightLearningRequest,
): Promise<LeadWeightLearningResult> {
  const profile = await repos.brandProfiles.getActive(ctx);
  if (!profile?.icp) {
    return {
      armed: false,
      reason: profile
        ? "the active profile has no ICP block — lead scoring is not armed"
        : "no active brand profile",
      rows: 0,
      verdicts: 0,
      stateId: null,
      created: false,
      multipliers: null,
      reasons: [],
      profileHash: null,
    };
  }
  const icp: Icp = icpSchema.parse(profile.icp);
  const profileHash = sha256Hex(stableStringify(icp));

  // Every row is mechanism-written (evalCases.recordLeadTriage is the one
  // door), so payload-shape failures should be zero; any that appear are
  // dropped here and still visible as the rows/verdicts gap.
  const evalRows = await repos.evalCases.list(ctx, {
    origin: "lead_triage",
    limit: request.evalRowLimit ?? 10_000,
  });
  const verdicts: LeadTriageVerdict[] = [];
  for (const row of evalRows) {
    const payload = leadTriageEvalPayloadSchema.safeParse({
      input: row.input,
      expected: row.expected,
    });
    if (!payload.success) continue;
    verdicts.push({
      leadId: payload.data.input.leadId,
      reasons: payload.data.input.reasons,
      profileHash: payload.data.input.profileHash ?? null,
      action: payload.data.expected.operatorAction,
      recordedAtMs: row.createdAt.getTime(),
    });
  }

  const learning = learnLeadWeights(verdicts, profileHash, request.config ?? {});
  if (learning.evidence.verdicts === 0) {
    return {
      armed: true,
      rows: evalRows.length,
      verdicts: 0,
      stateId: null,
      created: false,
      multipliers: null,
      reasons: learning.reasons,
      profileHash,
    };
  }

  const evidenceHash = sha256Hex(
    stableStringify({ multipliers: learning.multipliers, evidence: learning.evidence }),
  );
  const { state, created } = await repos.leadWeightStates.append(ctx, {
    multipliers: learning.multipliers,
    reasons: learning.reasons,
    evidence: learning.evidence,
    profileHash,
    evidenceHash,
    computedAt: new Date(request.nowMs),
  });

  return {
    armed: true,
    rows: evalRows.length,
    verdicts: learning.evidence.verdicts,
    stateId: state.id,
    created,
    multipliers: learning.multipliers,
    reasons: learning.reasons,
    profileHash,
  };
}
