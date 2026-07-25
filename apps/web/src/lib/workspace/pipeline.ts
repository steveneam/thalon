import type { PipelineAsset } from "./types";

/**
 * Pure lens math over PipelineAsset rows (§10 item 3): the same lineage data
 * rendered two ways — a per-asset stage rail (stepper) and a stage-grouped
 * board (kanban). No second query, no second truth: both lenses read the one
 * plan payload.
 */

export type StageKey = "captured" | "generated" | "judged" | "decided" | "published";

export type StageState = "done" | "attention" | "pending";

export interface StageView {
  key: StageKey;
  label: string;
  /** ISO instant the stage was reached; null = honestly not reached. */
  at: string | null;
  state: StageState;
  /** Where this stage's artifact lives (null = no artifact to open). */
  href: string | null;
  /** One-line detail (gate verdicts, decision, live URL). */
  detail: string | null;
}

const STAGE_LABELS: Record<StageKey, string> = {
  captured: "Captured",
  generated: "Generated",
  judged: "Judged",
  decided: "Decided",
  published: "Published",
};

/** The decided stage's operator-readable word per terminal status. */
function decisionWord(status: string): string {
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  if (status === "published") return "approved";
  return status;
}

/**
 * Lineage → five stages with an honest state each. `attention` marks the one
 * stage waiting on the operator: the judge stage on a blocked draft (edit +
 * re-judge), the decided stage on a queued draft (approve/reject) — the
 * signal channel, never a fake progress bar.
 */
export function assetStages(asset: PipelineAsset): StageView[] {
  const approveHref = `/app/approve?run=${encodeURIComponent(asset.runId)}&draft=${encodeURIComponent(asset.draftId)}`;
  const gatesDetail =
    asset.gates.length > 0 ? asset.gates.map((g) => `${g.gate} ${g.verdict}`).join(" · ") : null;

  const blocked = asset.status === "blocked";
  const queued = asset.status === "queued";

  return [
    {
      key: "captured",
      label: STAGE_LABELS.captured,
      at: asset.capturedAt,
      state: asset.capturedAt ? "done" : "pending",
      href: asset.capturedAt ? "/app/transcription" : null,
      detail: asset.sourceKind,
    },
    {
      key: "generated",
      label: STAGE_LABELS.generated,
      at: asset.generatedAt,
      state: "done",
      href: `/app/runs?run=${encodeURIComponent(asset.runId)}`,
      detail: asset.format ?? asset.platform,
    },
    {
      key: "judged",
      label: STAGE_LABELS.judged,
      at: asset.judgedAt,
      state: blocked ? "attention" : asset.judgedAt ? "done" : "pending",
      href: asset.judgedAt ? approveHref : null,
      detail: blocked ? (asset.reasons[0] ?? gatesDetail) : gatesDetail,
    },
    {
      key: "decided",
      // The word must match the state: "Decided" on a stage still waiting
      // for the decision says done while the color says waiting (critique s39).
      label: asset.decidedAt ? STAGE_LABELS.decided : "Decide",
      at: asset.decidedAt,
      state: asset.decidedAt ? "done" : queued ? "attention" : "pending",
      href: asset.decidedAt !== null || queued ? approveHref : null,
      detail: asset.decidedAt ? decisionWord(asset.status) : queued ? "waits on you" : null,
    },
    {
      key: "published",
      label: STAGE_LABELS.published,
      at: asset.publishedAt,
      state: asset.publishedAt ? "done" : "pending",
      href: asset.deployRef,
      detail: asset.publishedAt ? "live on site" : null,
    },
  ];
}

export interface KanbanColumn {
  key: "drafting" | "blocked" | "queued" | "done";
  label: string;
  /** True when the column's contents wait on the operator (signal channel). */
  needsYou: boolean;
  assets: PipelineAsset[];
}

/**
 * The kanban lens: stage-grouped columns over the same rows. Rejected drafts
 * are terminal noise for a work board — they demote to a count the board's
 * footer reports rather than a column of dead cards.
 */
export function kanbanColumns(assets: PipelineAsset[]): { columns: KanbanColumn[]; rejected: number } {
  const by = (statuses: string[]) => assets.filter((a) => statuses.includes(a.status));
  return {
    columns: [
      { key: "drafting", label: "Drafting", needsYou: false, assets: by(["generated", "judging"]) },
      { key: "blocked", label: "Needs your edit", needsYou: true, assets: by(["blocked"]) },
      { key: "queued", label: "Your review", needsYou: true, assets: by(["queued"]) },
      { key: "done", label: "Approved", needsYou: false, assets: by(["approved", "scheduled", "published"]) },
    ],
    rejected: assets.filter((a) => a.status === "rejected").length,
  };
}
