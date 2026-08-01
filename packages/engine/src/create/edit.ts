import {
  PLATFORM_CAPABILITIES,
  createPlanSchema,
  socialPlatformSchema,
  type TenantCtx,
} from "@thalon/contracts";
import { InvalidStateError, type Draft, type Repos } from "@thalon/db";
import { judgeCandidate, runJudgePipeline, type JudgeModelDriver } from "@thalon/judge";
import { modelTiers, readEnv, withGatewayGuard } from "@thalon/platform";
import { CREATE_VARIANT_PLAN_KEY, createVariantPlanSchema, type CreateVariantPlan } from "./plan";
import { createFakeAiEditDriver, gatewayAiEditDriver, type AiEditDriver } from "./shell/ai-edit";

/**
 * B-create.2 follow-through: **the R8 AI-edit verb** — instruction →
 * regenerate this variant. Charter `docs/create-engine/spec.md` (APPROVED)
 * R8 and its Error Behavior clause: *"AI-edit judge rejection: the variant
 * keeps its prior body; the refusal shows at the control."* Met exactly
 * since s89 (lane `judge-candidate`): the s88 deviation — a judge refusal at
 * apply left the applied body on a `blocked` draft — is CLOSED by judging
 * the candidate BEFORE it can land.
 *
 * ## The shape: propose (judged, writes nothing) / apply (lands, re-judged)
 *
 *   `aiEditDraft`  → shell rewrite → **candidate judge** (`judgeCandidate`,
 *                    `proprietary/judge` — the SAME gate ladder, denylist and
 *                    grounding assembly as the judge of record, persisting
 *                    nothing) → refuse with the verbatim reason on fail,
 *                    propose on pass. **Writes nothing**: the draft's body
 *                    and body hash are untouched on EVERY path, refusal or
 *                    not — machine-written text the judge refused can never
 *                    replace an operator's known-good text.
 *   `applyAiEdit`  → lands the proposal through the existing edit door
 *                    (`approvals.record`, which is the only thing that
 *                    writes `edit_diffs` + `eval_cases` + the body swap +
 *                    `→ judging`) and re-judges through `runJudgePipeline`
 *                    with the caller's own drivers.
 *
 * ## The DOUBLE judge on a passing edit is deliberate — do not collapse it
 *
 * A passing candidate is judged twice: once as a candidate (advisory,
 * unwritten — its outcome type says `ofRecord: false` for a reason) and once
 * after landing (the I1 record). Verdict rows bind to `body_hash`
 * (`judgeResults.append` defaults to the draft's current hash;
 * `transitionInTx`'s I1 check requires a passing `g3_final` row for that
 * hash before `→ queued`), so only the post-land judge's verdict — bound to
 * the NEW hash — is one I1 can honestly accept. Reusing the candidate
 * verdict for the landed body (passing it through, back-dating it, or
 * appending it against the new hash) would mint an I1-valid PASSING VERDICT
 * FOR CONTENT THE JUDGE NEVER READ — exactly the hole I1 exists to close.
 * Derivation: `agent_handoff/lanes/WRAP-create-shells.md` §1b, closed by
 * `WRAP-judge-candidate.md`.
 *
 * **This module makes no judge call of its own.** Every gate runs inside the
 * shared harness (`judgeCandidate` at propose, `runJudgePipeline` at apply)
 * with the caller's drivers threaded through untouched — pinned by tests
 * that hand over recording fakes and assert they arrived.
 */

/* ------------------------------------------------------------------ */
/* Propose — the half that never writes.                                */
/* ------------------------------------------------------------------ */

/**
 * The statuses an AI edit may start from — deliberately the SAME two
 * `approvalsRepo.record` accepts for an operator edit. Checked here, before
 * any spend, so a proposal can never be produced for a draft the apply door
 * would then refuse. (`generated` is excluded for the reason the repo's own
 * guard excludes it: `generated → judging` is legal, so an edit there would
 * touch a draft the judge has never seen.)
 */
export const AI_EDIT_STATUSES = ["queued", "blocked"] as const;

export interface AiEditRequestInput {
  draftId: string;
  /** The operator's instruction, verbatim. */
  instruction: string;
}

export interface AiEditDeps {
  /** The rewrite driver. Absent = the live gateway one is built. Tests always inject. */
  driver?: AiEditDriver;
  /**
   * The candidate judge's tier drivers — REQUIRED, same discipline as
   * `ApplyAiEditDeps`: a propose path that judged with drivers of its own
   * would be a second gate nobody configured.
   */
  screenDriver: JudgeModelDriver;
  finalDriver: JudgeModelDriver;
  /** Overrides the tenant daily token budget cap (tests only). */
  capTokens?: number;
}

/**
 * A proposal: the candidate body, plus the hash of the body it was written
 * against. The hash is not decoration — `applyAiEdit` refuses when the draft
 * has moved underneath it, so a proposal left open in one tab can never
 * clobber an edit made in another.
 */
export interface AiEditProposal {
  draftId: string;
  instruction: string;
  priorBody: string;
  priorBodyHash: string;
  proposedBody: string;
}

export type AiEditProposalResult =
  | { status: "proposed"; proposal: AiEditProposal }
  | { status: "refused"; reason: string };

/**
 * Propose an AI edit. **Writes nothing** — not the draft, not a row, not an
 * event. Every return path leaves `drafts.body`/`drafts.body_hash` exactly
 * as they were, which is what the accompanying test asserts unconditionally
 * rather than only on the refusal branch.
 *
 * Refuses, with the reason in words (R10), when: the instruction is empty ·
 * the draft is not in an editable status · the shell returned the body
 * unchanged (the prompt file's own refusal convention — an instruction it
 * could not carry out honestly) · the shell returned only whitespace · **the
 * candidate judge refused the rewrite** (the spec's Error Behavior: the
 * refusal carries the judge's reason verbatim, and the operator's known-good
 * text was never touched).
 */
export async function aiEditDraft(
  ctx: TenantCtx,
  repos: Repos,
  input: AiEditRequestInput,
  deps: AiEditDeps,
): Promise<AiEditProposalResult> {
  const instruction = input.instruction.trim();
  if (!instruction) {
    return { status: "refused", reason: "an AI edit needs an instruction — none was given" };
  }

  const draft = await repos.drafts.get(ctx, input.draftId);
  if (!isEditableStatus(draft.status)) {
    return {
      status: "refused",
      reason: `an AI edit needs a ${AI_EDIT_STATUSES.join(" or ")} draft, got "${draft.status}" — the same door an operator edit uses`,
    };
  }

  const proposedBody = (await runEditShell(ctx, repos, draft, instruction, deps)).trim();
  if (!proposedBody) {
    return { status: "refused", reason: "the rewrite came back empty — the draft is unchanged" };
  }
  if (proposedBody === draft.body.trim()) {
    // The prompt file tells the shell to return the body unchanged when the
    // instruction cannot be carried out honestly (an unsourced claim, a
    // disclosure removal, an instruction too vague to act on). Detecting it
    // HERE is what turns that convention into an operator-visible refusal
    // instead of a no-op edit that costs an approval row and a judge run.
    return {
      status: "refused",
      reason: `the rewrite came back identical to the current body — the instruction ("${instruction}") could not be carried out without inventing something, so nothing was changed`,
    };
  }

  // The spec's Error Behavior, met exactly (s89): the candidate is judged
  // BEFORE it can become a proposal — same ladder, same denylist, same
  // grounding as the judge that will meet it again at landing. The verdict
  // is `ofRecord: false`: nothing is appended, nothing transitions, and a
  // pass here confers no I1 standing — `applyAiEdit`'s re-judge remains the
  // verdict of record for the landed hash (the double judge is deliberate).
  const candidate = await judgeCandidate(repos, {
    ctx,
    draft,
    candidateBody: proposedBody,
    screenDriver: deps.screenDriver,
    finalDriver: deps.finalDriver,
    ...(deps.capTokens === undefined ? {} : { capTokens: deps.capTokens }),
  });
  if (candidate.verdict === "fail") {
    return {
      status: "refused",
      reason: `the judge refused the rewrite — ${candidate.reason} — the draft keeps its current body`,
    };
  }

  return {
    status: "proposed",
    proposal: {
      draftId: draft.id,
      instruction,
      priorBody: draft.body,
      priorBodyHash: draft.bodyHash,
      proposedBody,
    },
  };
}

/**
 * The metered shell call — core meters the shell (SPINE §1; amendment A2),
 * under the operation label **`create.ai_edit`**.
 */
async function runEditShell(
  ctx: TenantCtx,
  repos: Repos,
  draft: Draft,
  instruction: string,
  deps: AiEditDeps,
): Promise<string> {
  const driver = deps.driver ?? gatewayAiEditDriver();
  const capTokens = deps.capTokens ?? readEnv().TENANT_DAILY_TOKEN_BUDGET;
  const model = modelTiers().draft;
  const maxChars = platformCeiling(draft.platform);
  return withGatewayGuard({
    usage: {
      assertWithinBudget: (o) => repos.usageLedger.assertWithinBudget(ctx, o),
      recordUsage: (o) => repos.usageLedger.record(ctx, o),
    },
    capTokens,
    model,
    operation: "create.ai_edit",
    call: async () => {
      const out = await driver({
        body: draft.body,
        instruction,
        platform: draft.platform,
        ...(maxChars === undefined ? {} : { maxChars }),
      });
      return { result: out.body, tokensIn: out.tokensIn, tokensOut: out.tokensOut };
    },
  });
}

/** The platform's HARD ceiling, when it has one. A `web`/`email` draft has no social capability row, and gets no ceiling rather than a made-up one. */
function platformCeiling(platform: string): number | undefined {
  const parsed = socialPlatformSchema.safeParse(platform);
  return parsed.success ? PLATFORM_CAPABILITIES[parsed.data]?.text.maxChars : undefined;
}

function isEditableStatus(status: string): boolean {
  return (AI_EDIT_STATUSES as readonly string[]).includes(status);
}

/* ------------------------------------------------------------------ */
/* Apply — the half that rides the existing edit door.                  */
/* ------------------------------------------------------------------ */

export interface ApplyAiEditInput {
  proposal: AiEditProposal;
  /** Recorded on the approvals/edit_diffs rows. Defaults to a name that says an AI edit made this. */
  actor?: string;
  /**
   * The `create_runs` row this draft's variant belongs to. Supplied → the
   * variant is marked diverged from its master (R13). Absent → nothing is
   * marked, because the mapping from a draft to its run is not one this
   * module can invent (`create_runs` has no by-child lookup verb).
   */
  runId?: string;
  /** The variant's platform key in the run plan. Defaults to the draft's own platform. */
  variantPlatform?: string;
}

export interface ApplyAiEditDeps {
  screenDriver: JudgeModelDriver;
  finalDriver: JudgeModelDriver;
  /** Overrides the tenant daily token budget cap (tests only). */
  capTokens?: number;
}

export type ApplyAiEditResult =
  | { status: "queued"; draft: Draft }
  | { status: "blocked"; draft: Draft; reason: string }
  | { status: "refused"; reason: string };

/** The actor an AI edit is recorded under when the caller names none — an edit_diffs row should never read as if a human typed it. */
export const AI_EDIT_ACTOR = "ai-edit";

/**
 * Land a proposal and re-judge it (R8: *both re-judge before the variant can
 * leave the Composer*).
 *
 * The landing is `approvals.record({action:"edit"})` — the existing edit
 * door, unchanged and unbypassed. That one transaction writes the approvals
 * row, the `edit_diffs` row, the `eval_cases` row (so an AI edit becomes an
 * eval row by the same mechanism a hand edit does — rule 6, as a mechanism
 * rather than a habit), swaps body + `body_hash`, and transitions
 * `→ judging`. The re-judge is `runJudgePipeline` with the CALLER's drivers.
 *
 * Refuses without writing when the draft moved since the proposal was made.
 */
export async function applyAiEdit(
  ctx: TenantCtx,
  repos: Repos,
  input: ApplyAiEditInput,
  deps: ApplyAiEditDeps,
): Promise<ApplyAiEditResult> {
  const { proposal } = input;
  const current = await repos.drafts.get(ctx, proposal.draftId);
  if (current.bodyHash !== proposal.priorBodyHash) {
    // Not a stale-read annoyance — applying here would silently discard
    // whatever edit landed in between, which is the one thing the Composer's
    // divergence model exists to make visible.
    return {
      status: "refused",
      reason:
        "the draft changed since this rewrite was proposed — re-run the AI edit against the current body rather than overwriting the newer one",
    };
  }
  if (!isEditableStatus(current.status)) {
    return {
      status: "refused",
      reason: `an AI edit needs a ${AI_EDIT_STATUSES.join(" or ")} draft, got "${current.status}"`,
    };
  }

  const { draft: judging } = await repos.approvals.record(ctx, {
    draftId: proposal.draftId,
    actor: input.actor ?? AI_EDIT_ACTOR,
    action: "edit",
    editedBody: proposal.proposedBody,
  });

  // R13 groundwork: the variant has now diverged from its master. Marked
  // BEFORE the judge runs, because divergence is a fact about the body, not
  // about whether the gate liked it — a blocked AI edit has still diverged.
  if (input.runId) {
    await markRunVariantDiverged(
      ctx,
      repos,
      input.runId,
      input.variantPlatform ?? judging.platform,
    );
  }

  const outcome = await runJudgePipeline(repos, {
    ctx,
    draftId: judging.id,
    screenDriver: deps.screenDriver,
    finalDriver: deps.finalDriver,
    ...(deps.capTokens === undefined ? {} : { capTokens: deps.capTokens }),
  });
  return outcome.status === "blocked"
    ? { status: "blocked", draft: outcome.draft, reason: outcome.reason }
    : { status: "queued", draft: outcome.draft };
}

/* ------------------------------------------------------------------ */
/* Variant provenance (R13) — one function, two future callers.         */
/* ------------------------------------------------------------------ */

/**
 * Mark one variant diverged from its master. PURE — the Composer's hand-edit
 * path and this module's AI-edit path both go through here rather than
 * hand-rolling the same mutation twice, which is the entire reason it is
 * exported before either surface exists.
 *
 * A platform that is not a variant of this run is left alone: derivation
 * only lists ADMITTED destinations, and inventing a variant row for a
 * refused one would put a destination in the plan that the run never ran.
 */
export function markVariantDiverged(
  plan: CreateVariantPlan,
  platform: string,
): CreateVariantPlan {
  return {
    ...plan,
    variants: plan.variants.map((v) => (v.platform === platform ? { ...v, diverged: true } : v)),
  };
}

/**
 * Read the run's plan, mark the variant, write it back through the existing
 * `recordPlan` verb. A run whose plan carries no variant block (a non-post
 * family) is a no-op, not an error.
 */
async function markRunVariantDiverged(
  ctx: TenantCtx,
  repos: Repos,
  runId: string,
  platform: string,
): Promise<void> {
  const run = await repos.createRuns.get(ctx, runId);
  if (!run) throw new InvalidStateError(`create run "${runId}" not found for this tenant`);
  const plan = createPlanSchema.safeParse(run.plan);
  if (!plan.success) return;
  const variants = createVariantPlanSchema.safeParse(plan.data.family[CREATE_VARIANT_PLAN_KEY]);
  if (!variants.success) return;
  await repos.createRuns.recordPlan(ctx, runId, {
    ...plan.data,
    family: {
      ...plan.data.family,
      [CREATE_VARIANT_PLAN_KEY]: markVariantDiverged(variants.data, platform),
    },
  });
}

/** Re-exported so a caller wiring the verb keeps one import. */
export { createFakeAiEditDriver, gatewayAiEditDriver };
export type { AiEditDriver };
