import type { TenantCtx } from "@thalon/contracts";
import { NotFoundError, type Draft, type FanoutRun, type JudgeResult, type Repos } from "@thalon/db";

/**
 * @thalon/db exposes fanoutRuns.get / drafts.get by id only — there is no
 * bulk "list runs" or "list drafts for a run" repo query yet (a repo-surface
 * gap; see the B1.4 handoff notes). This hydrates both lists from the
 * append-only events spine (invariant I4: every create appends exactly one
 * event), which keeps apps/web entirely inside the repos surface with no
 * direct DB access. Fine at Sprint-1 scale; a real list query would replace
 * this outright.
 */
const FEED_EVENTS_LIMIT = 200;
const DRAFT_EVENTS_LIMIT = 500;

export async function listRunsFeed(repos: Repos, ctx: TenantCtx, limit = 50): Promise<FanoutRun[]> {
  const created = await repos.events.list(ctx, { entityType: "fanout_run", limit: FEED_EVENTS_LIMIT });
  const runIds = created.filter((e) => e.event === "fanout_run.created").map((e) => e.entityId);
  const runs = await Promise.all(runIds.map((id) => repos.fanoutRuns.get(ctx, id)));
  return runs
    .filter((r): r is FanoutRun => r !== null)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

export async function listRunDrafts(repos: Repos, ctx: TenantCtx, runId: string): Promise<Draft[]> {
  const created = await repos.events.list(ctx, { entityType: "draft", limit: DRAFT_EVENTS_LIMIT });
  const draftIds = created.filter((e) => e.event === "draft.created").map((e) => e.entityId);
  const drafts = await Promise.all(draftIds.map((id) => getDraftOrNull(repos, ctx, id)));
  return drafts
    .filter((d): d is Draft => d !== null && d.fanoutRunId === runId)
    .sort((a, b) => a.platform.localeCompare(b.platform) || a.createdAt.getTime() - b.createdAt.getTime());
}

export async function getDraftDetail(
  repos: Repos,
  ctx: TenantCtx,
  draftId: string,
): Promise<{ draft: Draft; judgeResults: JudgeResult[] } | null> {
  const draft = await getDraftOrNull(repos, ctx, draftId);
  if (!draft) return null;
  const judgeResults = await repos.judgeResults.listForDraft(ctx, draftId);
  return { draft, judgeResults };
}

async function getDraftOrNull(repos: Repos, ctx: TenantCtx, draftId: string): Promise<Draft | null> {
  try {
    return await repos.drafts.get(ctx, draftId);
  } catch (err) {
    if (err instanceof NotFoundError) return null;
    throw err;
  }
}
