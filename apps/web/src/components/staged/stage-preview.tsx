"use client";

import { formatMsAsClock } from "@/lib/approve-queue/formats/clip-plan";

/**
 * THE PREVIEW SEAM (B5.4, rebuilt s101 to `Staged.dc.html`). This component's
 * PROPS are the stable contract; its internals are a deterministic composition
 * of the direction — an aspect-correct frame showing the selected scene's
 * on-screen text and visual direction, over a duration-proportional scrubber.
 *
 * WHAT THE REBUILD CHANGED, and why each was a defect:
 *
 * - IT NO LONGER CALLS ITSELF A STUB IN ITS OWN TITLE. The founder's report
 *   was "the scenes look like placeholder" over nine real, grounded, on-brand
 *   scenes; a header reading "PREVIEW (LOW-RES STUB)" is the surface agreeing
 *   with him about work that is genuinely finished. The honesty did not go
 *   away — it moved to one mono line under the frame, which says what this is
 *   (a composition of the direction) and what it is not (a render).
 *
 * - THE FRAME IS BOUNDED AND CENTRED (373×210 at 16:9), and the scrubber is
 *   exactly its width. It used to take a `minmax(280px,380px)` grid column
 *   beside a 182px editor — the preview was nearly TWICE the width of the
 *   thing the operator works in.
 *
 * - THE VISUAL DIRECTION IS A CAPTION BAR, not 10px italic grey absolutely-
 *   positioned prose. Measured before the rebuild: 562px of content in a
 *   298px box, `truncate`d — two thirds of every director's note invisible.
 *
 * - THE SCRUBBER IS CONTROLLED. Selection is the parent's, so clicking
 *   segment 4 and opening scene 4 in the index are the same act. It used to
 *   own private state, so the preview and the scene list disagreed silently.
 *
 * Follow-up unchanged (recorded in the lane wrap): once B5.1's render driver
 * emits real HTML compositions and `@hyperframes/player` lands in main, the
 * frame body swaps for the 3 KB `<hyperframes-player>` web component — live
 * in-queue playback with NO render. Nothing outside this file changes.
 */

export interface PreviewScene {
  heading: string;
  onScreenText: string | null;
  /** The visual direction line — null until the scenes/effects stage fills it. */
  visual: string | null;
  motion: string | null;
  durationMs: number;
}

interface StagePreviewProps {
  aspect: "16:9" | "9:16" | "1:1";
  scenes: PreviewScene[];
  /** Controlled: the parent owns which scene is current, so index and frame never disagree. */
  sceneIndex: number;
  onScene: (index: number) => void;
  /** Extra honesty appended to the standing note, e.g. a storyboard's aspect being set later. */
  note?: string;
  /** Replaces the standing note entirely (the stalled state points at the blocked scene). */
  noteOverride?: string;
}

const ASPECT_CLASS: Record<StagePreviewProps["aspect"], string> = {
  "16:9": "",
  "9:16": "p916",
  "1:1": "p11",
};

export function StagePreview({
  aspect,
  scenes,
  sceneIndex,
  onScene,
  note,
  noteOverride,
}: StagePreviewProps) {
  const index = Math.min(Math.max(sceneIndex, 0), scenes.length - 1);
  const selected = scenes[index];
  const totalMs = scenes.reduce((sum, scene) => sum + scene.durationMs, 0);

  if (!selected) return null;

  return (
    <section aria-label="Stage preview" className="prev">
      <div className="prev-head">
        <span className="lbl">Preview</span>
        <span className="t-label">
          scene {index + 1} of {scenes.length} · {selected.heading}
        </span>
        <div style={{ flex: 1 }} />
        <span className="t-data">
          {aspect} · {formatMsAsClock(totalMs)}
        </span>
      </div>
      <div className={`prev-stage ${ASPECT_CLASS[aspect]}`.trim()}>
        <div className="prev-frame">
          <span className="prev-slug">
            {selected.heading} · {formatMsAsClock(selected.durationMs)}
          </span>
          {selected.motion && <span className="pill pill-idle prev-mot">{selected.motion}</span>}
          {selected.onScreenText ? (
            <div className="prev-text">{selected.onScreenText}</div>
          ) : (
            <div className="prev-text none">no on-screen text in this scene</div>
          )}
          <div className={`prev-vis${selected.visual ? "" : " pending"}`}>
            <span className="tag">Visual</span>
            <span className="txt">
              {selected.visual ?? "no visual direction yet — the scenes stage fills it"}
            </span>
          </div>
        </div>
        <div className="prev-scrub" role="group" aria-label="Scene timeline">
          {scenes.map((scene, i) => (
            <button
              key={i}
              type="button"
              className={`scrub${i === index ? " on" : ""}`}
              aria-label={`Preview scene ${i + 1}: ${scene.heading}`}
              aria-pressed={i === index}
              title={`${scene.heading} (${formatMsAsClock(scene.durationMs)})`}
              onClick={() => onScene(i)}
              style={{ flexGrow: Math.max(scene.durationMs, 1) }}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
      <p className="prev-note">
        {noteOverride ??
          `composed from the direction — not a render. Segment widths are each scene’s duration.${
            note ? ` ${note}` : ""
          }`}
      </p>
    </section>
  );
}
