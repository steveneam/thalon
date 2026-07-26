"use client";

import { LEAD_BOARD_COLUMNS, leadColumnLabel } from "@/components/leads/leads-model";

/**
 * The Leads pipeline board — STEP 1 of the two-step rebuild.
 *
 * Founder-directed s75: *"crete the lead based on the mock, and plan to have
 * it wired/working next session"*, with *"also have placeholder until bmedia
 * ready"*. So this is the STRUCTURAL verdict point, exactly as the wave-1 and
 * wave-2 lanes shipped theirs: the sheet's own column grammar, the sheet's
 * placeholder content, and ZERO wiring. Step 2 next session swaps the
 * placeholder cards for the real ranked leads and deletes the legacy
 * `components/board/leads-board.tsx` in the same change (DOCTRINE 0 — the old
 * implementation dies with the change that replaces it, not before).
 *
 * WHICH MOCK: `Board.dc.html` is the CONTENT pipeline board drawn under Home,
 * not a leads board — that is exactly the gap the s75 merge gate surfaced. So
 * this is built in that sheet's LANGUAGE (`.cols` / `.col` / `.col-hd` /
 * `.col-bd` / card), re-cut for the lead lifecycle, per the founder's "based
 * on the mock". Its classes are scoped under `.leads-surface` (README rule 6):
 * the two boards deliberately share class NAMES with different values — the
 * content board is six columns, this one is three.
 *
 * Columns are contract-derived (`LEAD_BOARD_COLUMNS`), never hand-listed.
 *
 * HONEST LIMIT, carried forward from the legacy board and stated in the UI:
 * drag-between-columns is not offered. Today's lifecycle is engine-owned —
 * scoring and the send door set it — so a drop target would fake an agency
 * the operator does not have. It arrives with the operator-owned stage field.
 */
export function LeadsBoard() {
  return (
    <div className="lead-board">
      <div className="cols">
        {LEAD_BOARD_COLUMNS.map((status) => (
          <div className="col" key={status}>
            <div className="col-hd">
              <span>{leadColumnLabel(status)}</span>
              <span className="col-ct">–</span>
            </div>
            <div className="col-bd">
              {/* Placeholder cards: the shape the founder verdicts, not data.
                  Step 2 replaces these with the real ranked leads. */}
              {[0, 1].map((slot) => (
                <div className="l-card" key={slot} aria-hidden="true">
                  <div className="l-card-top">
                    <span className="l-badge">··</span>
                    <span className="l-name">Lead name · Company</span>
                  </div>
                  <div className="l-meta">
                    <span className="l-bar">
                      <span className="l-bar-fill" />
                    </span>
                    <span className="t-data">–.––</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="lead-board-foot">
        <span className="t-label">
          Structure only — this board isn’t wired yet, so the cards above are placeholders and the
          counts read “–”. The list tab has every real lead, best fit first.
        </span>
        <span className="t-label">
          Columns are the lead lifecycle itself · dragging between them waits for the
          operator-owned stage field — today the engine sets the stage, so a drop target would fake
          a control you don’t have.
        </span>
      </div>
    </div>
  );
}
