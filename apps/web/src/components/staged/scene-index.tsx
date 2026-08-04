"use client";

import { useState } from "react";
import { formatMsAsClock } from "@/lib/approve-queue/formats/clip-plan";

/**
 * THE SCENE INDEX (s101 rebuild, `Staged.dc.html`).
 *
 * This ONE component replaces two — `storyboard-cards.tsx` and the scene half
 * of `direction-editor.tsx` — because the sheet draws one shape for both
 * artifacts. The two files had drifted into near-duplicates that disagreed on
 * details (the storyboard's visual line rendered only when present; the
 * direction's rendered "visual pending" when absent), which is precisely the
 * kind of divergence a shared drawing exists to end. Callers normalise their
 * artifact into `IndexScene` and the difference stops there.
 *
 * WHY AN INDEX AND NOT CARDS. Nine open scene cards stacked in the pane's
 * one column measured 3219px inside a 764px viewport — four screens of
 * scrolling for a 1:10 video, with the preview scrolled off the top the whole
 * time. One row per scene, ONE open at a time (Grain · Copy.ai · Asana from
 * the research pass), brings the same nine scenes to ~1000px and keeps the
 * pinned preview in view. The open scene is also the PREVIEWED scene: opening
 * a row and clicking its scrubber segment are the same act.
 */

export interface IndexScene {
  heading: string;
  narration: string;
  onScreenText: string | null;
  visual: string | null;
  motion: string | null;
  durationMs: number | null;
}

export interface SceneEdit {
  heading: string;
  narration: string;
  onScreenText: string;
  visual: string;
  motion: string;
  durationMs: string;
}

interface SceneIndexProps {
  scenes: IndexScene[];
  /** The open row — also the previewed scene. Owned by the parent. */
  openIndex: number;
  onOpen: (index: number) => void;
  /** Advanced mode only: a live chain gets facts, never a form it cannot submit. */
  editable: boolean;
  busy: boolean;
  accepted: ReadonlySet<number>;
  /** The motion vocabulary of the artifact being edited ([] when it has no motion field). */
  motions: readonly string[];
  onAccept?: (index: number) => void;
  onTweak?: (index: number, next: SceneEdit) => void;
  onMove?: (index: number, to: number) => void;
}

function toEdit(scene: IndexScene): SceneEdit {
  return {
    heading: scene.heading,
    narration: scene.narration,
    onScreenText: scene.onScreenText ?? "",
    visual: scene.visual ?? "",
    motion: scene.motion ?? "",
    durationMs: scene.durationMs === null ? "" : String(scene.durationMs),
  };
}

export function SceneIndex({
  scenes,
  openIndex,
  onOpen,
  editable,
  busy,
  accepted,
  motions,
  onAccept,
  onTweak,
  onMove,
}: SceneIndexProps) {
  const [editing, setEditing] = useState<number | null>(null);
  const [fields, setFields] = useState<SceneEdit | null>(null);

  function startTweak(index: number) {
    setEditing(index);
    setFields(toEdit(scenes[index]));
  }

  function save() {
    if (editing === null || !fields) return;
    const index = editing;
    setEditing(null);
    setFields(null);
    onTweak?.(index, fields);
  }

  const set = (field: keyof SceneEdit) => (value: string) =>
    setFields((prev) => (prev ? { ...prev, [field]: value } : prev));

  return (
    <div className="scenes" role="group" aria-label="Scenes">
      {scenes.map((scene, i) => {
        const open = i === openIndex;
        const isEditing = editable && editing === i && fields !== null;
        return (
          <div key={i} className={`scene${open ? " open" : ""}`}>
            <button
              type="button"
              className="scene-hd"
              aria-expanded={open}
              aria-label={`Scene ${i + 1}: ${scene.heading}`}
              onClick={() => onOpen(i)}
            >
              <span className="n">{i + 1}</span>
              <span className="ti">{scene.heading}</span>
              {accepted.has(i) && <span className="acc">accepted ✓</span>}
              {scene.durationMs !== null && (
                <span className="dur">{formatMsAsClock(scene.durationMs)}</span>
              )}
            </button>
            {open && (
              <div className="scene-body">
                {isEditing ? (
                  <div className="staged-form">
                    <label>
                      <span className="lb">Heading</span>
                      <input
                        className="in"
                        aria-label={`Scene ${i + 1} heading`}
                        value={fields.heading}
                        onChange={(e) => set("heading")(e.target.value)}
                      />
                    </label>
                    <label>
                      <span className="lb">Narration — the judged claim surface</span>
                      <textarea
                        className="in"
                        aria-label={`Scene ${i + 1} narration`}
                        value={fields.narration}
                        onChange={(e) => set("narration")(e.target.value)}
                      />
                    </label>
                    <label>
                      <span className="lb">On-screen text (blank = none)</span>
                      <input
                        className="in"
                        aria-label={`Scene ${i + 1} on-screen text`}
                        value={fields.onScreenText}
                        onChange={(e) => set("onScreenText")(e.target.value)}
                      />
                    </label>
                    <label>
                      <span className="lb">Visual direction (blank = none)</span>
                      <input
                        className="in"
                        aria-label={`Scene ${i + 1} visual`}
                        value={fields.visual}
                        onChange={(e) => set("visual")(e.target.value)}
                      />
                    </label>
                    <div className="pair">
                      {motions.length > 0 && (
                        <label>
                          <span className="lb">Motion</span>
                          <select
                            className="in"
                            aria-label={`Scene ${i + 1} motion`}
                            value={fields.motion}
                            onChange={(e) => set("motion")(e.target.value)}
                          >
                            {motions.map((motion) => (
                              <option key={motion} value={motion}>
                                {motion}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <label>
                        <span className="lb">Duration ms</span>
                        <input
                          type="number"
                          min={1}
                          step={500}
                          className="in"
                          aria-label={`Scene ${i + 1} duration`}
                          value={fields.durationMs}
                          onChange={(e) => set("durationMs")(e.target.value)}
                        />
                      </label>
                    </div>
                    <div style={{ display: "flex", gap: 7 }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={
                          busy || fields.heading.trim() === "" || fields.narration.trim() === ""
                        }
                        onClick={save}
                      >
                        Save tweak
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setEditing(null);
                          setFields(null);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="narr">{scene.narration}</p>
                    {scene.onScreenText && (
                      <p className="dir onscreen">
                        <span className="tag">On-screen</span>
                        <span className="txt">{scene.onScreenText}</span>
                      </p>
                    )}
                    <p className={`dir vis${scene.visual ? "" : " pending"}`}>
                      <span className="tag">Visual</span>
                      <span className="txt">
                        {scene.visual ?? "not filled yet — the scenes stage writes it"}
                      </span>
                    </p>
                    {scene.motion && (
                      <p className="dir">
                        <span className="tag">Motion</span>
                        <span className="txt">{scene.motion}</span>
                      </p>
                    )}
                    {editable && (
                      <div style={{ display: "flex", gap: 7, paddingTop: 2 }}>
                        {onAccept && (
                          <button
                            type="button"
                            className={`btn btn-sm ${accepted.has(i) ? "btn-quiet" : "btn-ghost"}`}
                            aria-label={`Accept scene ${i + 1}`}
                            aria-pressed={accepted.has(i)}
                            aria-disabled={busy || accepted.has(i)}
                            onClick={() => {
                              if (busy || accepted.has(i)) return;
                              onAccept(i);
                            }}
                          >
                            {accepted.has(i) ? "Accepted ✓" : "Accept"}
                          </button>
                        )}
                        {onTweak && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            aria-label={`Tweak scene ${i + 1}`}
                            aria-disabled={busy || editing !== null}
                            onClick={() => {
                              if (busy || editing !== null) return;
                              startTweak(i);
                            }}
                          >
                            Tweak
                          </button>
                        )}
                        {onMove && (
                          <>
                            <button
                              type="button"
                              className="btn btn-quiet btn-sm"
                              aria-label={`Move scene ${i + 1} up`}
                              aria-disabled={busy || i === 0 || editing !== null}
                              onClick={() => {
                                if (busy || i === 0 || editing !== null) return;
                                onMove(i, i - 1);
                              }}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="btn btn-quiet btn-sm"
                              aria-label={`Move scene ${i + 1} down`}
                              aria-disabled={busy || i === scenes.length - 1 || editing !== null}
                              onClick={() => {
                                if (busy || i === scenes.length - 1 || editing !== null) return;
                                onMove(i, i + 1);
                              }}
                            >
                              ↓
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
