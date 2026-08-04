"use client";

import type { FlowStage } from "@/lib/staged-flow/types";

interface StageRailProps {
  stages: FlowStage[];
  viewIndex: number;
  onView: (index: number) => void;
  /** Per-stage "what it produced" line — the caller knows how to read each artifact. */
  made: (stage: FlowStage, index: number) => string;
  /** The current stage's draft is blocked: the chain stopped here, and the rail says so. */
  stoppedIndex?: number | null;
}

/**
 * The plan's ordered stages (count is CONFIG — this renders whatever the plan
 * carries, 3 today), rebuilt to `Staged.dc.html`.
 *
 * Two things changed and both were defects, not taste:
 *
 * 1. EVERY STEP CARRIES WHAT IT PRODUCED (the Elicit pattern from the s101
 *    research pass). It used to read "1 Structure · done · queued" — two
 *    status words, one of them the raw draft status, and nothing about the
 *    artifact. It now reads "9 scenes · passed": the operator learns the shape
 *    of the run from the rail instead of having to open each stage.
 *
 * 2. THE CONNECTOR IS A BORDER, NOT A TEXT ARROW. The old rail was a wrapping
 *    flex row of `→` spans, so at 560px it broke after stage 2 and line two
 *    began with an arrow pointing at nothing. A grid of equal columns cannot
 *    wrap, so it cannot produce that.
 */
export function StageRail({ stages, viewIndex, onView, made, stoppedIndex }: StageRailProps) {
  return (
    <ol
      aria-label="Stages"
      className="stage-rail"
      style={{ gridTemplateColumns: `repeat(${stages.length}, 1fr)` }}
    >
      {stages.map((stage, i) => {
        const locked = stage.status === "locked";
        const stopped = stoppedIndex === i;
        const cls = [
          "stage-step",
          stage.status === "done" ? "done" : "",
          i === viewIndex ? "on" : "",
          stopped ? "stopped" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <li key={stage.def.key} style={{ display: "contents" }}>
            <button
              type="button"
              className={cls}
              aria-label={`View stage ${i + 1}: ${stage.def.title}`}
              aria-pressed={i === viewIndex}
              disabled={locked}
              onClick={() => onView(i)}
            >
              <span className="hd">
                <span className="n">{i + 1}</span>
                <span className="ti">{stage.def.title}</span>
                {stopped ? (
                  <span className="tick bad" aria-hidden>
                    ✗
                  </span>
                ) : stage.status === "done" ? (
                  <span className="tick" aria-hidden>
                    ✓
                  </span>
                ) : null}
                {locked && (
                  <span className="lock" aria-hidden>
                    🔒
                  </span>
                )}
              </span>
              <span className="made">{made(stage, i)}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
