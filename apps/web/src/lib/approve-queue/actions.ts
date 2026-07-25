import type { SocialPlatform, TenantCtx } from "@thalon/contracts";
import type { Approval, Draft, Repos } from "@thalon/db";
import {
  publishApprovedDraft,
  publishWebPageToSite,
  vaultSocialPublisherResolver,
  type PublishApprovedDraftResult,
  type PublishWebPageDeps,
  type PublishWebPageResult,
  type SocialPublisher,
} from "@thalon/engine";
import { readEnv } from "@thalon/platform";
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

/**
 * B6.7: the queue's post-approval publish touch for `web_page` drafts — the
 * own-site door (engine `publishWebPageToSite`: approved-only gate,
 * content-address-verified artifact read, posts-bundle upsert). Not an
 * approval action — the draft stays `approved` (republishable) and the
 * deploy truth lives in its meta (`deployStatus`/`deployRef`), so this never
 * rides `approvals.record`. A target failure is recorded on the draft by the
 * engine and returned as `status:"failed"` — the route surfaces it loudly.
 */
export async function publishApprovedPage(
  repos: Repos,
  ctx: TenantCtx,
  draftId: string,
  nowMs: number,
  tags?: string[],
  deps: PublishWebPageDeps = {},
): Promise<PublishWebPageResult> {
  return publishWebPageToSite(ctx, repos, { draftId, nowMs, tags }, deps);
}

/**
 * s67: the post loop's PRODUCTION CALLER — the one wiring of the assembled
 * platform drivers + the per-platform arming ratchet into the engine
 * publish door. Every rung stays engine-side and typed (B-pub.1 ladder:
 * approved-only draft, armed publisher, tenant social block, ≤cap/day,
 * platform-scoped duplicate refusal); this seam adds NOTHING to it. The
 * default resolver is VAULT-FIRST and, since B-int.3, ARMED BY TENANT
 * DATA (ADR 0011 decision 3): token material comes from the tenant's
 * connected vault rows, arming reads the platform's presence in the social
 * config block plus that connected credential, and the env pairs
 * (`SOCIAL_<P>_ACCESS_TOKEN` / `SOCIAL_<P>_ARMED`) are the emergency
 * override — set, they win. Tests inject a fake resolver and stay
 * keyless/offline.
 */
export async function publishApprovedSocial(
  repos: Repos,
  ctx: TenantCtx,
  draftId: string,
  platform: SocialPlatform,
  now: Date,
  resolvePublisher?: (platform: SocialPlatform) => SocialPublisher,
): Promise<PublishApprovedDraftResult> {
  const resolve =
    resolvePublisher ?? (await vaultSocialPublisherResolver({ repos, ctx, env: readEnv() }));
  return publishApprovedDraft({ ctx, repos, resolvePublisher: resolve }, { draftId, platform }, now);
}
