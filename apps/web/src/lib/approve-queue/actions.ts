import type { TenantCtx } from "@thalon/contracts";
import type { Approval, Draft, Repos } from "@thalon/db";

export interface ActionResult {
  approval: Approval;
  draft: Draft;
}

const DEFAULT_ACTOR = "operator";

/** Every operator touch flows through approvalsRepo.record (packages/db) — one transaction, capture included; these are the thin, testable seam the routes call. */
export async function approveDraft(
  repos: Repos,
  ctx: TenantCtx,
  draftId: string,
  actor: string = DEFAULT_ACTOR,
): Promise<ActionResult> {
  return repos.approvals.record(ctx, { draftId, actor, action: "approve" });
}

export async function rejectDraft(
  repos: Repos,
  ctx: TenantCtx,
  draftId: string,
  actor: string = DEFAULT_ACTOR,
): Promise<ActionResult> {
  return repos.approvals.record(ctx, { draftId, actor, action: "reject" });
}

/** Edited body = new content -> the repo sends the draft back to `judging` in the same transaction as the edit_diffs/eval_cases rows (invariant I1). */
export async function editDraft(
  repos: Repos,
  ctx: TenantCtx,
  draftId: string,
  editedBody: string,
  actor: string = DEFAULT_ACTOR,
): Promise<ActionResult> {
  return repos.approvals.record(ctx, { draftId, actor, action: "edit", editedBody });
}

/**
 * Operator re-judge: re-runs judging on the UNMODIFIED draft — the escape
 * hatch for a draft an operational halt (e.g. BudgetExceededError, a hard
 * stop, not a verdict) stranded in `judging`, or a verdict-`blocked` draft
 * the operator wants retried as-is. Goes through repos.drafts.reJudge, which
 * composes ONLY the one transition fn (transitionInTx) — never a new side
 * door — and can never itself land a draft on `queued` (only a fresh judge
 * pass's own I1-checked transition can).
 */
export async function reJudgeDraft(
  repos: Repos,
  ctx: TenantCtx,
  draftId: string,
  actor: string = DEFAULT_ACTOR,
): Promise<{ draft: Draft }> {
  const draft = await repos.drafts.reJudge(ctx, draftId, { actor });
  return { draft };
}
