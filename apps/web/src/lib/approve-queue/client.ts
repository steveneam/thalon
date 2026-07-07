import type { ActionResult, DraftDetail, FeedRun, GridDraft, PublishResult, ReJudgeResult } from "./types";

/** On failure, surfaces the route's own `{ error }` message (toErrorResponse) rather than a bare status code — judge/transition failures must fail LOUDLY and legibly for the operator. Shared with the staged-flow client (same convention, same seam). */
export async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const message =
      body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string"
        ? (body as { error: string }).error
        : `request failed: ${res.status}`;
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export async function fetchRunsFeed(): Promise<FeedRun[]> {
  const res = await fetch("/api/runs");
  const body = await asJson<{ runs: FeedRun[] }>(res);
  return body.runs;
}

export async function fetchRunDrafts(runId: string): Promise<GridDraft[]> {
  const res = await fetch(`/api/runs/${runId}/drafts`);
  const body = await asJson<{ drafts: GridDraft[] }>(res);
  return body.drafts;
}

export async function fetchDraftDetail(draftId: string): Promise<DraftDetail | null> {
  const res = await fetch(`/api/drafts/${draftId}`);
  if (res.status === 404) return null;
  return asJson<DraftDetail>(res);
}

export async function approveDraft(draftId: string): Promise<ActionResult> {
  const res = await fetch(`/api/drafts/${draftId}/approve`, { method: "POST" });
  return asJson<ActionResult>(res);
}

export async function rejectDraft(draftId: string): Promise<ActionResult> {
  const res = await fetch(`/api/drafts/${draftId}/reject`, { method: "POST" });
  return asJson<ActionResult>(res);
}

export async function editDraft(draftId: string, editedBody: string): Promise<ActionResult> {
  const res = await fetch(`/api/drafts/${draftId}/edit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ editedBody }),
  });
  return asJson<ActionResult>(res);
}

export async function reJudgeDraft(draftId: string): Promise<ReJudgeResult> {
  const res = await fetch(`/api/drafts/${draftId}/rejudge`, { method: "POST" });
  return asJson<ReJudgeResult>(res);
}

export async function publishDraft(draftId: string): Promise<PublishResult> {
  const res = await fetch(`/api/drafts/${draftId}/publish`, { method: "POST" });
  return asJson<PublishResult>(res);
}
