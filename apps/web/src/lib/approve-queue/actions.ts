import type { TenantCtx } from "@thalon/contracts";
import type { Approval, Draft, Repos } from "@thalon/db";
import { runJudgeOnDraft, type JudgeRunnerDeps } from "./judge-runner";

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

/**
 * Edited body = new content -> the repo sends the draft back to `judging` in
 * the same transaction as the edit_diffs/eval_cases rows (invariant I1).
 * That alone would leave the draft parked at `judging` with no application
 * caller ever running the judge lane — this runs it in the SAME request
 * (`judge-runner.ts`, wired exactly like eval/src/dogfood.ts), so the
 * response reflects the fully-judged outcome (queued or blocked). If judging
 * throws (no gateway key, a budget halt), this rethrows — the route surfaces
 * it as a loud error and the draft honestly stays `judging`.
 */
export async function editDraft(
  repos: Repos,
  ctx: TenantCtx,
  draftId: string,
  editedBody: string,
  actor: string = DEFAULT_ACTOR,
  judgeDeps: JudgeRunnerDeps = {},
): Promise<ActionResult> {
  const { approval, draft: judging } = await repos.approvals.record(ctx, {
    draftId,
    actor,
    action: "edit",
    editedBody,
  });
  const outcome = await runJudgeOnDraft(repos, ctx, judging, judgeDeps);
  return { approval, draft: outcome.draft };
}

/**
 * Operator re-judge: re-runs judging on the UNMODIFIED draft — the escape
 * hatch for a draft an operational halt (e.g. BudgetExceededError, a hard
 * stop, not a verdict) stranded in `judging`, or a verdict-`blocked` draft
 * the operator wants retried as-is. `repos.drafts.reJudge` composes ONLY the
 * one transition fn (transitionInTx) — never a new side door — and can never
 * itself land a draft on `queued`; THIS runs the judge lane in the same
 * request right after, so `queued` only ever happens behind a fresh,
 * I1-checked passing verdict. A double-fired re-judge whose second attempt
 * finds the draft already moved past `blocked`/`judging` surfaces as the
 * same clean, existing "re-judge requires..." error — not a crash. If
 * judging throws, this rethrows — the route surfaces it as a loud error and
 * the draft honestly stays `judging` (it never reached `queued` or `blocked`
 * from this call).
 */
export async function reJudgeDraft(
  repos: Repos,
  ctx: TenantCtx,
  draftId: string,
  actor: string = DEFAULT_ACTOR,
  judgeDeps: JudgeRunnerDeps = {},
): Promise<{ draft: Draft }> {
  const judging = await repos.drafts.reJudge(ctx, draftId, { actor });
  const outcome = await runJudgeOnDraft(repos, ctx, judging, judgeDeps);
  return { draft: outcome.draft };
}
