import type { Approval, Draft, FanoutRun, JudgeResult } from "@thalon/db";

/** Dates cross the wire as ISO strings (NextResponse.json/JSON.stringify) — these mirror the db/contract row shapes but keep that honest. */
type Iso<T, K extends keyof T> = Omit<T, K> & { [P in K]: string };

/** `draftsComplete` + `waiting` are derived server-side (see lib/approve-queue/queries.ts `RunFeedItem`) — the first flags a run with fewer distinct draft platforms than it requested (an aborted or partial fan-out); the second counts this run's queued+blocked drafts so the feed shows WHICH runs hold the operator's waiting work (critique P1, s39). */
export type FeedRun = Iso<FanoutRun, "createdAt"> & { draftsComplete: boolean; waiting: number };
export type GridDraft = Iso<Draft, "createdAt" | "updatedAt">;
export type PanelJudgeResult = Iso<JudgeResult, "createdAt">;
export type PanelApproval = Iso<Approval, "createdAt">;

export interface DraftDetail {
  draft: GridDraft;
  judgeResults: PanelJudgeResult[];
}

export interface ActionResult {
  approval: PanelApproval;
  draft: GridDraft;
}

/** Re-judge doesn't touch the approvals table (it's not approve/reject/edit) — just the resulting draft. */
export interface ReJudgeResult {
  draft: GridDraft;
}

/** Publish (B6.7, web_page only) doesn't touch the approvals table either — the draft stays `approved`; deploy truth lands in its meta. */
export interface PublishResult {
  slug: string;
  url: string;
  draft: GridDraft;
}
