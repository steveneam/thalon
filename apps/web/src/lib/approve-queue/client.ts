import type { ActionResult, DraftDetail, FeedRun, GridDraft } from "./types";

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`request failed: ${res.status}`);
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
