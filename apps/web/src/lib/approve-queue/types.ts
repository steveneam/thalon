import type { Approval, Draft, FanoutRun, JudgeResult } from "@thalon/db";

/** Dates cross the wire as ISO strings (NextResponse.json/JSON.stringify) — these mirror the db/contract row shapes but keep that honest. */
type Iso<T, K extends keyof T> = Omit<T, K> & { [P in K]: string };

export type FeedRun = Iso<FanoutRun, "createdAt">;
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
