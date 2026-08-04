"use client";

import { formatMsAsClock } from "@/lib/approve-queue/formats/clip-plan";
import type { StageCandidate } from "@/lib/staged-flow/types";

interface CandidatePickerProps {
  stageTitle: string;
  candidates: StageCandidate[];
  busy: boolean;
  onPick: (candidateId: string) => void;
}

/**
 * Pick-from-2-3-takes per stage (rebuilt s101 to `Staged.dc.html`): the
 * operator reacts to visible, summarised takes — never a blank prompt box.
 *
 * One column, not `md:grid-cols-2 xl:grid-cols-3`. The old grid used VIEWPORT
 * breakpoints inside a 560px pane, so on a 1440px screen three take cards
 * split ~170px each and every fact on them wrapped. The take's facts and its
 * verb are what the operator reads; at this width they read as rows.
 */
export function CandidatePicker({ stageTitle, candidates, busy, onPick }: CandidatePickerProps) {
  return (
    <div aria-label={`${stageTitle} candidates`} role="group" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      <p className="t-label">
        {candidates.length} takes for <b style={{ color: "var(--n-1000)" }}>{stageTitle}</b> — pick one to
        continue. Every pick is captured; it trains one-prompt mode&rsquo;s defaults.
      </p>
      <div className="takes">
        {candidates.map((candidate, i) => {
          const doc = candidate.doc;
          const scenes = doc?.scenes ?? candidate.storyboard?.scenes ?? [];
          const totalMs = doc ? doc.scenes.reduce((sum, s) => sum + s.durationMs, 0) : null;
          const firstVisual = doc?.scenes[0]?.visual;
          const motion = doc?.scenes[0]?.motion;
          return (
            <div key={candidate.id} className={`take${i === 0 ? " pick" : ""}`}>
              <div className="hd">
                <span className="ti">{candidate.label}</span>
                {motion && <span className="pill pill-idle">{motion}</span>}
                <div style={{ flex: 1 }} />
                <button
                  type="button"
                  className={`btn btn-sm ${i === 0 ? "btn-primary" : "btn-ghost"}`}
                  aria-label={`Pick candidate ${candidate.label}`}
                  aria-disabled={busy}
                  onClick={() => {
                    if (busy) return;
                    onPick(candidate.id);
                  }}
                >
                  Use this take
                </button>
              </div>
              <p className="t-label">
                {scenes.length} scenes
                {totalMs !== null && ` · ${formatMsAsClock(totalMs)}`}
                {doc && ` · ${doc.aspect} · ${doc.pacing} pacing`}
              </p>
              <p className="t-label" style={{ color: "var(--n-900)" }}>
                {candidate.summary}
              </p>
              {firstVisual && (
                <p className="dir vis">
                  <span className="tag">Scene 1</span>
                  <span className="txt">{firstVisual}</span>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
