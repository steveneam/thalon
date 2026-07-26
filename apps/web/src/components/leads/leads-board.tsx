"use client";

import {
  heatColor,
  leadBoardColumns,
  leadInitials,
  leadTitle,
  terminalLeadCounts,
} from "@/components/leads/leads-model";
import type { LeadCard } from "@/lib/leads/types";

/**
 * The Leads pipeline board — STEP 2 of the two-step rebuild: the real ranked
 * queue in the sheet's column grammar, and the legacy `components/board/
 * leads-board.tsx` deleted in the same change (DOCTRINE 0 — the old
 * implementation dies with the change that replaces it, not before).
 *
 * WHICH MOCK: `Board.dc.html` is the CONTENT pipeline board drawn under Home,
 * not a leads board — that is the gap the s75 merge gate surfaced. So this is
 * built in that sheet's LANGUAGE (`.cols` / `.col` / `.col-hd` / `.col-bd` /
 * card), re-cut for the lead lifecycle, per the founder's "based on the mock".
 * Its classes are scoped under `.leads-surface` (README rule 6): the two
 * boards deliberately share class NAMES with different values — the content
 * board is six columns, this one is three.
 *
 * What this layer decides is only what is TRUE to render:
 *  - columns are contract-derived (`LEAD_BOARD_COLUMNS`), never hand-listed,
 *    and a column's leads are ordered by the SAME `compareLeadCards` the list
 *    ranks by, so the two views agree about who is at the top;
 *  - a count is the column's real total; while the queue is unread it is "–",
 *    never a real-looking zero, and an empty column says what would put a lead
 *    in it rather than showing a bare 0;
 *  - a card is a LEAD card — identity badge, name · company, and the score bar
 *    painted by the same thermal band the list grades by; an unscored lead
 *    reads "–" with an empty trough rather than an invented grade;
 *  - a card is a DOOR: it opens that lead in the List tab, where its dossier
 *    (reasons, activity, drafted outreach) already lives. The board carries no
 *    second dossier and no dead cards.
 *
 * NO KEYBOARD GRAMMAR HERE, deliberately. The legacy board's 2D extension
 * (j/k within a column, h/l across) cannot re-enter without giving one key two
 * meanings on one surface: `h` is already this surface's "mark hot" verb in
 * the list. The re-entry rule allows a keeper back only behind byte-true
 * resting chrome, and teaching a second grammar would need a legend band the
 * sheet does not draw. So the cards are real buttons and reach the keyboard
 * the way every other control does — native focus order, ↵ to open.
 *
 * HONEST LIMIT, carried forward from the legacy board and stated in the UI:
 * drag-between-columns is not offered. Today's lifecycle is engine-owned —
 * scoring and the send door set it — so a drop target would fake an agency the
 * operator does not have. It arrives with the operator-owned stage field.
 */
export function LeadsBoard({
  status,
  leads,
  selectedId,
  onOpen,
  onRetry,
}: {
  status: "loading" | "error" | "success";
  /** The whole queue: terminal leads have no column, and the foot counts them. */
  leads: LeadCard[];
  selectedId: string | null;
  onOpen: (id: string) => void;
  onRetry: () => void;
}) {
  const columns = leadBoardColumns(leads);
  const terminal = Object.entries(terminalLeadCounts(leads)).filter(([, count]) => count > 0);

  return (
    <div className="lead-board">
      {status === "error" && (
        <div className="card read-error" role="alert">
          <span className="t-label">
            Couldn’t read your leads — this is a read failure, not an empty pipeline.
          </span>
          <div style={{ flex: 1 }} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}
      <div className="cols">
        {columns.map((column) => (
          <div className="col" key={column.status}>
            <div className="col-hd">
              <span>{column.label}</span>
              <span className="col-ct">{status === "success" ? column.leads.length : "–"}</span>
            </div>
            <div className="col-bd">
              {status === "loading" && <span className="col-note">reading your leads…</span>}
              {status === "error" && (
                <span className="col-note col-note-err">couldn’t read this column</span>
              )}
              {status === "success" && column.leads.length === 0 && (
                <span className="col-note">{column.empty}</span>
              )}
              {status === "success" &&
                column.leads.map((lead) => (
                  <button
                    type="button"
                    key={lead.id}
                    data-testid={`lead-card-${lead.id}`}
                    className={lead.id === selectedId ? "l-card sel" : "l-card"}
                    title={`Open ${leadTitle(lead)} in the list`}
                    aria-label={`Open ${leadTitle(lead)} in the list`}
                    onClick={() => onOpen(lead.id)}
                  >
                    <div className="l-card-top">
                      <span className="l-badge">{leadInitials(lead)}</span>
                      <span className="l-name">{leadTitle(lead)}</span>
                    </div>
                    <div className="l-meta">
                      {lead.pinned && <span className="pill pill-warn">hot</span>}
                      <span className="l-bar">
                        {lead.score !== null && (
                          <span
                            className="l-bar-fill"
                            style={{
                              width: `${Math.round(lead.score * 100)}%`,
                              background: heatColor(lead.score),
                            }}
                          />
                        )}
                      </span>
                      <span
                        className="t-data"
                        title={lead.score === null ? "not scored yet" : `score ${lead.score} of 1`}
                      >
                        {lead.score === null ? "–" : lead.score.toFixed(2)}
                      </span>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
      <div className="lead-board-foot">
        <span className="t-label">
          Columns are the lead lifecycle itself · dragging between them waits for the
          operator-owned stage field — today the engine sets the stage, so a drop target would fake
          a control you don’t have.
        </span>
        <span className="t-label">
          Best fit first inside each column, the same ranking the list uses · a card opens that lead
          in the list, where its reasons, activity and drafted outreach are.
          {status === "success" &&
            terminal.length > 0 &&
            ` · ${terminal.map(([state, count]) => `${count} ${state}`).join(" · ")} — terminal, so they have no column here.`}
        </span>
      </div>
    </div>
  );
}
