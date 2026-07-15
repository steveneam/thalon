import type { TenantCtx } from "@thalon/contracts";
import { NotFoundError, type Draft, type FanoutRun, type JudgeResult, type Repos } from "@thalon/db";

/**
 * B2.6: reads the bulk `fanoutRuns.list` / `drafts.listByRun` repo queries
 * directly — closes the Sprint-1 follow-up noted in the B1.5 handoff (this
 * used to hydrate both lists from the events spine as a workaround for
 * neither existing yet).
 */
const FEED_LIMIT = 50;

export interface RunFeedItem extends FanoutRun {
  /**
   * false when this run has fewer distinct draft platforms than it requested
   * — either a total abort (zero drafts persisted before an irrecoverable
   * failure) or a partial one (some platforms generated, a later one threw
   * and nobody has replayed the fan-out to backfill the rest yet). Lets the
   * feed surface these distinctly instead of as an indistinguishable empty
   * row (Sprint-1 follow-up).
   */
  draftsComplete: boolean;
  /**
   * queued + blocked drafts on this run (critique P1, s39): the feed walk
   * already hydrates every run's drafts for draftsComplete, so the count is
   * free — it lets the queue's default selection and the run rows answer
   * WHICH runs actually hold the operator's waiting work.
   */
  waiting: number;
}

function isRunComplete(run: FanoutRun, drafts: Draft[]): boolean {
  const expected = Array.isArray(run.platforms) ? (run.platforms as unknown[]).filter((p): p is string => typeof p === "string") : [];
  if (expected.length === 0) return true;
  const withDrafts = new Set(drafts.map((d) => d.platform));
  return expected.every((platform) => withDrafts.has(platform));
}

export async function listRunsFeed(repos: Repos, ctx: TenantCtx, limit = FEED_LIMIT): Promise<RunFeedItem[]> {
  const runs = await repos.fanoutRuns.list(ctx, { limit });
  return Promise.all(
    runs.map(async (run) => {
      const drafts = await repos.drafts.listByRun(ctx, run.id);
      return {
        ...run,
        draftsComplete: isRunComplete(run, drafts),
        waiting: drafts.filter((d) => d.status === "queued" || d.status === "blocked").length,
      };
    }),
  );
}

export async function listRunDrafts(repos: Repos, ctx: TenantCtx, runId: string): Promise<Draft[]> {
  const drafts = await repos.drafts.listByRun(ctx, runId);
  return [...drafts].sort(
    (a, b) => a.platform.localeCompare(b.platform) || a.createdAt.getTime() - b.createdAt.getTime(),
  );
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
