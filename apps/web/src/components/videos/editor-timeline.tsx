"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Edl } from "@thalon/contracts";
import {
  deleteBeat,
  deleteCaptionLine,
  insertCaptionForBeat,
  insertCaptionLine,
  patchCaptionLine,
  patchMusic,
  removeMusicCue,
  reorderBeat,
  splitBeat,
  splitLane,
  trimBeat,
  trimBeatStart,
} from "@/lib/videos/editor";
import {
  applySnap,
  beatStarts,
  quantize,
  reorderTargetFor,
  snapTargetsFor,
} from "@/lib/videos/track-view";

/**
 * The multi-track timeline — the EDL surface, rebuilt in the grammar of
 * docs/research/mock-sheets/Videos.dc.html: three lanes (video beats ·
 * music cue · caption plates) drawn PROPORTIONALLY across the lane track,
 * with the playhead over all three.
 *
 * The B-ve.6 keeper survives whole, because none of it was ever pixels: the
 * magnetic reorder, the edge trims and the snap targets are the same pure
 * seconds-math in lib/videos/track-view.ts, and every gesture funnels
 * through the same pure EDL transforms the inspector's fields use. What
 * changed is the projection — the old view measured in px/sec, the sheet
 * measures in percent of the track, so a lane can never disagree with the
 * card it sits in.
 *
 * Esc cancels an active drag losslessly (the Figma bar): the drag captures
 * the EDL it started from and restores it.
 */

/** Where a pointer sits on a lane, in seconds. */
const EDGE_FRACTION = 0.18;
/** Snap threshold: 8px of an ~800px track, expressed in the sheet's own proportion. */
const SNAP_FRACTION = 0.01;

/** One frozen empty set, so an unwired optional mark prop is not a new object per render. */
const EMPTY_SET: ReadonlySet<number> = new Set();

/** The unwired default for `frameFor` — every block falls back to the striped placeholder. */
const NO_FRAME = () => null;

/** The sheet's block label — "01", "02", … — and the beats rail's own grammar. */
function ordinal(index: number): string {
  return String(index + 1).padStart(2, "0");
}

export type Selection =
  | { kind: "beat"; index: number }
  | { kind: "caption"; index: number }
  | { kind: "music" }
  | null;

type Drag =
  | { kind: "reorder"; index: number; grabOffsetSec: number; base: Edl }
  | { kind: "trim-start" | "trim-end"; index: number; base: Edl }
  | { kind: "caption"; line: number; grabOffsetSec: number; base: Edl }
  | { kind: "music"; startOffset: number; startClientX: number; base: Edl }
  | { kind: "playhead" };

/** Percentage widths for the beat lane — the sheet's own flex-and-percent lane. */
export function beatWidths(edl: Edl): number[] {
  const { beats } = splitLane(edl);
  const total = beats.reduce((sum, clip) => sum + clip.duration, 0);
  if (total <= 0) return beats.map(() => 0);
  return beats.map((clip) => (clip.duration / total) * 100);
}

/**
 * Caption plates as the sheet draws them: a width and the gap since the
 * previous plate, both in percent of the cut. A plate that would start
 * before the one before it closes simply butts against it (never a
 * negative margin, which would draw an overlap the render doesn't have).
 */
export function captionPlates(edl: Edl): { width: number; gap: number }[] {
  const total = edl.output.duration;
  if (!(total > 0)) return [];
  let cursor = 0;
  return (edl.captions?.lines ?? []).map((line) => {
    const start = Math.max(cursor, line.fadeIn);
    const end = Math.max(start, line.fadeOut);
    const plate = { gap: ((start - cursor) / total) * 100, width: ((end - start) / total) * 100 };
    cursor = end;
    return plate;
  });
}

export function EditorTimeline({
  edl,
  selection,
  onSelect,
  onEdl,
  playhead,
  onPlayhead,
  propBeats,
  propCaptions,
  propMusic,
  refusedCaptions = EMPTY_SET,
  frameFor = NO_FRAME,
  onNotice,
}: {
  edl: Edl;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  /** The editor's single edit funnel — the dirty bit and attribution reset live there. */
  onEdl: (fn: (edl: Edl) => Edl) => void;
  /** Playhead position as a fraction of the cut, or null when it has never been placed. */
  playhead: number | null;
  onPlayhead: (fraction: number) => void;
  /** Indices a pending agent proposal touches — the sheet's `.prop` marks. */
  propBeats: ReadonlySet<number>;
  propCaptions: ReadonlySet<number>;
  propMusic: boolean;
  /**
   * Caption lines the JUDGE REFUSED at the approve door (s82 B3). A refusal
   * used to be announced only in the notice band — "line 2 was refused" — while
   * the plate it names carried no mark at all, so finding it meant counting
   * plates by eye. Distinct from `propCaptions`: a proposal is an offer to
   * change (warn), a refusal is a gate verdict on what is there now (err), and
   * one plate can carry both.
   *
   * Optional because the set is assembled from the approve response, which
   * lives in the editor's own state (editor.tsx — a different lane's file this
   * session). Defaulted rather than required so the mark is dead-simple to
   * wire and cannot half-render.
   */
  refusedCaptions?: ReadonlySet<number>;
  /**
   * s95/V2 — a take ref's FRAME, as a fetchable src (the B-media.0 poster the
   * editor resolves from the project's takes). Null keeps the sheet's striped
   * placeholder: stripes mean "no frame derived yet", never a decoration.
   */
  frameFor?: (ref: string) => string | null;
  /**
   * s95b — where the tools row answers. Every refusal is a sentence in the
   * notice band (the aria-disabled grammar this surface already keeps), and
   * every applied verb states what changed and that ⌘Z undoes it.
   */
  onNotice: (line: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const [snapping, setSnapping] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [readout, setReadout] = useState<string | null>(null);

  const { beats, overlay } = useMemo(() => splitLane(edl), [edl]);
  const widths = useMemo(() => beatWidths(edl), [edl]);
  const plates = useMemo(() => captionPlates(edl), [edl]);
  const duration = edl.output.duration;
  const cue = edl.audio[0];

  // Esc cancels the active drag losslessly — restore the drag's base EDL.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const drag = dragRef.current;
      if (event.key !== "Escape" || drag === null || drag.kind === "playhead") return;
      onEdl(() => drag.base);
      dragRef.current = null;
      setReadout(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEdl]);

  /** Pointer x → seconds along the beat lane. */
  const secAt = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return Math.max(0, ((clientX - rect.left) / rect.width) * duration);
  };

  const snap = (sec: number) =>
    applySnap(sec, snapTargetsFor(edl, playhead === null ? null : playhead * duration), SNAP_FRACTION * duration, snapping)
      .value;

  const onTrackPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (drag === null) return;
    const sec = secAt(event.clientX);
    if (drag.kind === "playhead") {
      onPlayhead(duration > 0 ? Math.min(1, sec / duration) : 0);
      return;
    }
    if (drag.kind === "reorder") {
      const center = sec - drag.grabOffsetSec + (beats[drag.index]?.duration ?? 0) / 2;
      const target = reorderTargetFor(edl, drag.index, center);
      setReadout(`${beats[drag.index]?.name ?? ""} → slot ${target + 1}`);
      if (target !== drag.index) {
        onEdl((current) => reorderBeat(current, drag.index, target));
        dragRef.current = { ...drag, index: target };
        onSelect({ kind: "beat", index: target });
      }
      return;
    }
    if (drag.kind === "trim-end") {
      const start = beatStarts(edl)[drag.index] ?? 0;
      const next = Math.max(0.1, quantize(snap(sec) - start));
      setReadout(`${beats[drag.index]?.name ?? ""} · ${next}s`);
      onEdl((current) => trimBeat(current, drag.index, { duration: next }));
      return;
    }
    if (drag.kind === "trim-start") {
      const start = beatStarts(edl)[drag.index] ?? 0;
      const delta = quantize(snap(sec) - start);
      if (delta !== 0) {
        setReadout(`${beats[drag.index]?.name ?? ""} · in ${quantize((beats[drag.index]?.in ?? 0) + delta)}s`);
        onEdl((current) => trimBeatStart(current, drag.index, delta));
      }
      return;
    }
    if (drag.kind === "caption") {
      const line = edl.captions?.lines[drag.line];
      if (!line) return;
      const span = line.fadeOut - line.fadeIn;
      const fadeIn = Math.max(0, snap(sec - drag.grabOffsetSec));
      setReadout(`“${line.text.slice(0, 24)}” · ${fadeIn}s → ${quantize(fadeIn + span)}s`);
      onEdl((current) =>
        patchCaptionLine(current, drag.line, { fadeIn, fadeOut: quantize(fadeIn + span) }),
      );
      return;
    }
    if (drag.kind !== "music") return;
    // Music: dragging the block LEFT advances into the track (offset grows).
    const rect = trackRef.current?.getBoundingClientRect();
    const perPx = rect && rect.width > 0 ? duration / rect.width : 0;
    const offset = Math.max(0, quantize(drag.startOffset + (drag.startClientX - event.clientX) * perPx));
    setReadout(`music offset ${offset}s`);
    onEdl((current) => patchMusic(current, { offset }));
  };

  /*
   * s95b — THE TOOLS ROW's four verbs, each acting on the SELECTED block (the
   * sheet's own words: "on the selected block"). All four are EDL-only edits
   * through the same `onEdl` funnel every drag uses — free, so unbadged (V4:
   * absence says free) — and every refusal is a sentence, never a dead chip.
   * Split and Crop cut AT THE PLAYHEAD: the ruler places it, the chip acts,
   * which gives the keyboard the frame precision the edge-drags give the mouse.
   */
  const playheadSec = playhead === null ? null : playhead * duration;

  const onSplit = () => {
    if (selection?.kind !== "beat") {
      onNotice("Select a beat block first — Split cuts the selected beat at the playhead.");
      return;
    }
    const i = selection.index;
    const clip = beats[i];
    const start = beatStarts(edl)[i] ?? 0;
    if (playheadSec === null || playheadSec <= start || playheadSec >= start + clip.duration) {
      onNotice(`Place the playhead inside ${clip.name} first — Split cuts at the playhead.`);
      return;
    }
    const offset = quantize(playheadSec - start);
    if (offset < 0.1 || clip.duration - offset < 0.1) {
      onNotice(`Too close to the edge — each half of ${clip.name} needs at least 0.1s.`);
      return;
    }
    onEdl((current) => splitBeat(current, i, offset));
    onNotice(`Split ${clip.name} at ${offset}s — both halves ride the same take, hard cut at the seam.`);
  };

  const onCrop = () => {
    if (selection === null) {
      onNotice("Select a block first — Crop trims the selected block to end at the playhead.");
      return;
    }
    if (selection.kind === "music") {
      onNotice("The music bed has no crop — its offset, gain and tail easing live in the inspector below.");
      return;
    }
    if (playheadSec === null) {
      onNotice("Place the playhead first — Crop trims the selected block to end there.");
      return;
    }
    if (selection.kind === "beat") {
      const clip = beats[selection.index];
      const start = beatStarts(edl)[selection.index] ?? 0;
      if (playheadSec <= start || playheadSec >= start + clip.duration) {
        onNotice(`Place the playhead inside ${clip.name} — Crop trims the beat to end there.`);
        return;
      }
      const next = Math.max(0.1, quantize(playheadSec - start));
      onEdl((current) => trimBeat(current, selection.index, { duration: next }));
      onNotice(`Cropped ${clip.name} to ${next}s — the tail is trimmed, the take itself is untouched.`);
      return;
    }
    const line = edl.captions?.lines[selection.index];
    if (!line) return;
    if (playheadSec <= line.fadeIn) {
      onNotice(`Place the playhead after this plate fades in (${line.fadeIn}s) — Crop ends the plate there.`);
      return;
    }
    onEdl((current) => patchCaptionLine(current, selection.index, { fadeOut: quantize(playheadSec) }));
    onNotice(`Caption ${selection.index + 1} now ends at ${quantize(playheadSec)}s.`);
  };

  const onText = () => {
    if (selection?.kind === "caption") {
      const i = selection.index;
      onEdl((current) => insertCaptionLine(current, i, "New caption"));
      onSelect({ kind: "caption", index: i + 1 });
      onNotice(`Added a plate after Caption ${i + 1} — type its text in the inspector below.`);
      return;
    }
    if (selection?.kind === "beat") {
      if (!edl.captions) {
        onNotice(
          "This cut has no caption style on record, so a plate cannot be added — a style is the compiler's and the judge's input, not something to invent here.",
        );
        return;
      }
      const i = selection.index;
      const fadeIn = Math.min(beatStarts(edl)[i] ?? 0, duration);
      // The insertion slot is deterministic from the CURRENT lines (the
      // transform sorts by fadeIn), so the new plate can be selected without
      // waiting for the state round-trip.
      const at = edl.captions.lines.findIndex((l) => l.fadeIn > fadeIn);
      const index = at === -1 ? edl.captions.lines.length : at;
      onEdl((current) => insertCaptionForBeat(current, i, "New caption"));
      onSelect({ kind: "caption", index });
      onNotice(`Added a caption over ${beats[i].name} — type its text in the inspector below.`);
      return;
    }
    onNotice("Select a beat or a caption plate first — Text adds a plate on the selected block.");
  };

  const onDeleteTool = () => {
    if (selection === null) {
      onNotice("Select a block first — Delete removes the selected block from this cut.");
      return;
    }
    if (selection.kind === "beat") {
      if (beats.length <= 1) {
        onNotice("The last beat stays — a cut with no beats cannot render. Delete the version instead if the cut itself is wrong.");
        return;
      }
      const name = beats[selection.index]?.name ?? "that beat";
      onEdl((current) => deleteBeat(current, selection.index));
      onSelect(null);
      onNotice(`Removed ${name} from the working copy — the take stays on record. ⌘Z undoes.`);
      return;
    }
    if (selection.kind === "caption") {
      onEdl((current) => deleteCaptionLine(current, selection.index));
      onSelect(null);
      onNotice(`Removed Caption ${selection.index + 1} from the working copy. ⌘Z undoes.`);
      return;
    }
    if (cue === undefined) {
      onNotice("This cut is already silent — there is no music bed to delete.");
      return;
    }
    onEdl((current) => removeMusicCue(current));
    onSelect(null);
    onNotice("Removed the music bed — the lane's silent state is the door to pick another. ⌘Z undoes.");
  };

  const beginDrag = (drag: Drag, event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    dragRef.current = drag;
  };

  const endDrag = () => {
    dragRef.current = null;
    setReadout(null);
  };

  return (
    <>
      <div className="tl-head">
        <span className="t-title">Timeline</span>
        <button
          type="button"
          className={snapping ? "pill pill-idle snap-pill on" : "pill pill-idle snap-pill"}
          aria-pressed={snapping}
          onClick={() => setSnapping((on) => !on)}
        >
          Snap · {snapping ? "magnetic" : "off"}
        </button>
        {/*
          s95b — the manual tools row (Squarespace: the toolbar acts on the
          selection; Arcade: tools at the timeline's edge; Leonardo: delete set
          apart in the danger colour). All four are EDL-only, so unbadged; each
          stays pressable and ANSWERS when it must refuse — the aria-disabled
          grammar the aspect lens set.
        */}
        <button
          type="button"
          className="chipbtn"
          aria-disabled={selection?.kind !== "beat" || undefined}
          title="Split the selected beat at the playhead — an EDL edit, free"
          onClick={onSplit}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="4" cy="4.5" r="1.9" /><circle cx="4" cy="11.5" r="1.9" /><path d="M5.7 5.6 13.5 13M5.7 10.4 13.5 3" /></svg>
          Split
        </button>
        <button
          type="button"
          className="chipbtn"
          aria-disabled={selection === null || selection.kind === "music" || undefined}
          title="Trim the selected block to end at the playhead — an EDL edit, free"
          onClick={onCrop}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M4.5 1.5v10h10M1.5 4.5h10v10" /></svg>
          Crop
        </button>
        <button
          type="button"
          className="chipbtn"
          aria-disabled={selection === null || selection.kind === "music" || undefined}
          title="Add a caption plate on the selected block — the judge gate reads the text at Approve"
          onClick={onText}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M3.5 3.5h9M8 3.5v9.5" /></svg>
          Text
        </button>
        <button
          type="button"
          className="chipbtn chip-danger"
          aria-disabled={selection === null || undefined}
          title="Remove the selected block from this cut — undoable, the source stays on record"
          onClick={onDeleteTool}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M3 4.5h10M6.3 4.5V3h3.4v1.5M4.7 4.5l.6 8h5.4l.6-8" /></svg>
          Delete
        </button>
        <span className="t-label" aria-live="polite">
          {readout ?? "on the selected block · drag reorders · edges trim"}
        </span>
        <div style={{ flex: 1 }} />
        <div className="seg" role="group" aria-label="Timeline zoom">
          <button
            type="button"
            className="seg-opt"
            aria-label="Zoom out"
            onClick={() => setZoom((z) => Math.max(1, z / 1.5))}
          >
            −
          </button>
          <button
            type="button"
            className={zoom === 1 ? "seg-opt on" : "seg-opt"}
            onClick={() => setZoom(1)}
          >
            fit
          </button>
          <button
            type="button"
            className="seg-opt"
            aria-label="Zoom in"
            onClick={() => setZoom((z) => Math.min(8, z * 1.5))}
          >
            +
          </button>
        </div>
      </div>

      <div className="tl-scroll">
        <div
          className="tl-body"
          style={{
            width: `${zoom * 100}%`,
            ...(playhead === null ? {} : ({ "--playhead": playhead } as React.CSSProperties)),
          }}
          onPointerMove={onTrackPointerMove}
          onPointerUp={endDrag}
        >
          {playhead !== null && <div className="playhead" />}

          <div className="lane">
            {/* s95 — the kind dot (VEED): sheet-local kind tokens, deliberately
                NOT the ok/warn status colours, so status keeps its meaning. */}
            <div className="lane-hd">
              <span>
                <span className="kdot" style={{ background: "var(--tk-video)" }} />
                Video
              </span>
              <small>beats · takes</small>
            </div>
            <div className="lane-tr" ref={trackRef}>
              {beats.length === 0 ? (
                <span className="t-label">This cut has no beat lane.</span>
              ) : (
                beats.map((clip, i) => {
                  /*
                   * s95/V2 — the frame ON the block ("every reference puts
                   * frame thumbnails on its timeline clips; ours were plain
                   * blocks"). The take's poster rides as a cover background
                   * under a bottom scrim so the ordinal stays legible (the
                   * alpha-tint-over-photos lesson: composite, never hope);
                   * no poster = the sheet's stripes, which now MEAN "no frame
                   * derived yet". Selection is a ring, never a repaint that
                   * would hide the frame.
                   */
                  const frame = frameFor(clip.source.ref);
                  const marks = [
                    selection?.kind === "beat" && selection.index === i ? "on" : "",
                    propBeats.has(i) ? "prop" : "",
                    frame !== null ? "framed" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <button
                      key={`${clip.name}-${i}`}
                      type="button"
                      className={marks === "" ? "blk" : `blk ${marks}`}
                      style={{
                        width: `${widths[i]}%`,
                        ...(frame === null
                          ? {}
                          : {
                              backgroundImage: `linear-gradient(180deg, oklch(0 0 0 / 0) 40%, oklch(0 0 0 / 0.62)), url("${frame}")`,
                            }),
                      }}
                      aria-pressed={selection?.kind === "beat" && selection.index === i}
                      /*
                       * The NAME is the accessible name, whatever the pixels do
                       * (s82 B10). The visible label degrades to an ellipsis on
                       * a narrow block; an accessible name never clips, so the
                       * identity, the duration and the proposal all live here
                       * where truncation cannot reach them.
                       */
                      aria-label={`Beat ${ordinal(i)} · ${clip.name} · ${clip.duration}s${
                        propBeats.has(i) ? " · proposed change" : ""
                      }`}
                      title={`${clip.name} · ${clip.duration}s · ${clip.source.ref}`}
                      /*
                       * KEYBOARD ACTIVATION (s80 blocker fix). Enter/Space on a
                       * focused button dispatches `click`, never `pointerdown`,
                       * so a block carrying only onPointerDown was a silent
                       * no-op from the keyboard: it took focus, painted its
                       * focus ring, announced aria-pressed=false, and did
                       * nothing. Idempotent for a pointer click, which fires
                       * pointerdown then click and re-sets the same selection.
                       */
                      onClick={() => onSelect({ kind: "beat", index: i })}
                      onPointerDown={(event) => {
                        onSelect({ kind: "beat", index: i });
                        const rect = (event.currentTarget as Element).getBoundingClientRect();
                        const edge = Math.min(9, rect.width * EDGE_FRACTION);
                        if (rect.right - event.clientX <= edge) {
                          beginDrag({ kind: "trim-end", index: i, base: edl }, event);
                        } else if (event.clientX - rect.left <= edge) {
                          beginDrag({ kind: "trim-start", index: i, base: edl }, event);
                        } else {
                          beginDrag(
                            {
                              kind: "reorder",
                              index: i,
                              grabOffsetSec: secAt(event.clientX) - (beatStarts(edl)[i] ?? 0),
                              base: edl,
                            },
                            event,
                          );
                        }
                      }}
                    >
                      {/*
                        THE SHEET'S OWN LABEL, and the proposal out of the text
                        flow (s82 B10, a `high`).

                        The block used to print the whole `clip.name` inside a
                        `overflow:hidden; white-space:nowrap` box with computed
                        `text-overflow: clip`: on the real 9-beat cut "beat-09"
                        rendered as "beat-" — mid-token, with no cue that
                        anything was missing. Worse, the `.prop-tag` was appended
                        INSIDE that same box, so injecting it measured 0px
                        visible and the amber border became the only channel
                        saying "the agent proposes here", on the surface whose
                        stated promise is "never a silent change".

                        So: the sheet's ordinal leads and never shrinks, the name
                        follows in a span that ellipsises (a visible truncation
                        cue, and the beats rail beside this states the same name
                        in full anyway), and the proposal word is a corner mark
                        positioned out of the flow, where a long label cannot eat
                        it. `title` keeps the full name; `aria-label` above keeps
                        every fact.
                      */}
                      <span className="blk-ord">{ordinal(i)}</span>
                      <span className="blk-lbl">· {clip.name}</span>
                      {propBeats.has(i) && <span className="prop-tag">proposed</span>}
                    </button>
                  );
                })
              )}
              {overlay !== null && duration > 0 && (
                /*
                  THE FREEZE FACT IS DRAWN, NOT TOOLTIPPED (s82 B7).

                  This marker carried its whole fact — where the freeze lands and
                  that the prior timeline holds under it — in a `title`, on an
                  element `editor.css` gives `pointer-events: none`. An element
                  that receives no pointer events is never hovered, so that title
                  could never be displayed by any browser: the fact was
                  unreachable at rest and stated nowhere else until a selection
                  opened the inspector.

                  `pointer-events: none` STAYS. The marker spans from its freeze
                  boundary to the end of the lane, over the beats underneath it,
                  so making it hoverable would make it swallow their selections
                  and drags. The fix is therefore to move the fact into the
                  marker's own text — freeze first, because the marker is as
                  narrow as the tail it covers and the name is the part that can
                  afford to ellipsise.
                */
                <span
                  className="blk-overlay"
                  style={{ left: `${Math.min(100, ((overlay.at ?? 0) / duration) * 100)}%` }}
                >
                  <span className="blk-overlay-fact">endcard · freeze {overlay.at ?? 0}s</span>
                  <span className="blk-lbl">· {overlay.name}</span>
                </span>
              )}
            </div>
          </div>

          <div className="lane">
            <div className="lane-hd">
              <span>
                <span className="kdot" style={{ background: "var(--tk-music)" }} />
                Music
              </span>
              <small>cue · waveform</small>
            </div>
            <div className="lane-tr">
              {cue === undefined ? (
                /*
                  A SILENT CUT IS A CHOICE, NOT A VERDICT. This said "Silent
                  cut — no music lane on this EDL" as flat text: true, and a
                  dead end, on a project that ships seven candidate beds. It is
                  now the way into the picker, which is the same door a scored
                  cut uses to change its bed.
                */
                <button
                  type="button"
                  className="as-text-btn"
                  aria-pressed={selection?.kind === "music"}
                  title="This cut has no music — choose a bed from the project's candidates"
                  onClick={() => onSelect({ kind: "music" })}
                >
                  Silent cut — choose a music bed →
                </button>
              ) : (
                <button
                  type="button"
                  className={[
                    "blk-music",
                    selection?.kind === "music" ? "on" : "",
                    propMusic ? "prop" : "",
                    /*
                      SELECTABLE, NOT DRAGGABLE (s82 B6). `button.blk-music` is
                      `cursor: grab` for every cue, but the pointer-down handler
                      returns immediately for a stream-copied one — so the block
                      advertised a drag it refuses to perform, and the honest
                      explanation lived only in a `title` the operator reads
                      AFTER grabbing and watching nothing move. The mode is now
                      ON the element, so the cursor can tell the truth before the
                      gesture instead of after it.
                    */
                    cue.mode === "copy" ? "copy" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ width: "100%" }}
                  aria-pressed={selection?.kind === "music"}
                  /*
                    The block has no text of its own, so before this its whole
                    accessible name was its `title` — and a pending proposal on
                    it was signalled by border hue alone (s82 B2). Per
                    `proposalMarks`, music-align is one of the commonest ops in
                    the diff vocabulary, so that was colour-as-sole-channel on
                    one of the most likely proposals to arrive.
                  */
                  aria-label={[
                    `Music bed ${cue.source.ref}`,
                    cue.mode === "copy"
                      ? "stream-copied verbatim — no knobs by contract"
                      : `offset ${cue.offset}s · gain ${cue.gainDb}dB`,
                    propMusic ? "proposed change" : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  title={
                    cue.mode === "copy"
                      ? `${cue.source.ref} · stream-copied verbatim — no knobs by contract`
                      : `${cue.source.ref} · offset ${cue.offset}s · gain ${cue.gainDb}dB`
                  }
                  // Keyboard activation — see the beat block above.
                  onClick={() => onSelect({ kind: "music" })}
                  onPointerDown={(event) => {
                    onSelect({ kind: "music" });
                    if (cue.mode === "copy") return;
                    beginDrag(
                      {
                        kind: "music",
                        startOffset: cue.offset,
                        startClientX: event.clientX,
                        base: edl,
                      },
                      event,
                    );
                  }}
                >
                  {/*
                    The two facts that were hover-only, drawn. They ride an
                    overlay rather than the block's own flow so the sheet's
                    waveform geometry is untouched, and `pointer-events: none`
                    keeps the drag surface whole underneath them.
                  */}
                  {(propMusic || cue.mode === "copy") && (
                    <span className="blk-tags">
                      {propMusic && <span className="prop-tag">proposed</span>}
                      {cue.mode === "copy" && <span className="mode-tag">no knobs</span>}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="lane">
            <div className="lane-hd">
              <span>
                <span className="kdot" style={{ background: "var(--tk-cap)" }} />
                Captions
              </span>
              {/*
                A PLATE IS TOO SMALL FOR A WORD, SO THE LANE CARRIES IT (s82
                B2/B3). A caption plate is 22px tall and as narrow as its fade
                window — a 7% plate is about 50px — so the word that a beat block
                can hold does not fit inside one. The mark on the plate is
                therefore a corner dot, and the WORD lives here, once per lane:
                a proposal and a judge refusal are different facts in different
                channels (warn vs err), and neither is left to hue alone.

                It REPLACES the decorative subtitle rather than adding a third
                line — the subtitle only restates the lane's own name, while a
                third line would grow the 74px header and push this lane's
                geometry off the sheet for as long as a proposal is pending.
              */}
              {propCaptions.size > 0 || refusedCaptions.size > 0 ? (
                <small className="lane-marks">
                  {propCaptions.size > 0 && <span className="prop-tag">proposed</span>}
                  {refusedCaptions.size > 0 && <span className="refused-tag">refused</span>}
                </small>
              ) : (
                <small>plates · fades</small>
              )}
            </div>
            <div className="lane-tr" style={{ alignItems: "center" }}>
              {plates.length === 0 ? (
                <span className="t-label">No caption lane on this cut.</span>
              ) : (
                plates.map((plate, i) => {
                  const line = edl.captions?.lines[i];
                  const proposed = propCaptions.has(i);
                  const refused = refusedCaptions.has(i);
                  const marks = [
                    selection?.kind === "caption" && selection.index === i ? "on" : "",
                    proposed ? "prop" : "",
                    refused ? "refused" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <button
                      key={i}
                      type="button"
                      className={marks === "" ? "blk-cap" : `blk-cap ${marks}`}
                      style={{ width: `${plate.width}%`, marginLeft: `${plate.gap}%` }}
                      /*
                        The plate's state in its accessible NAME, not just its
                        border: `aria-pressed` encodes selection and says nothing
                        about a proposal or a refusal, and the plate has no text
                        of its own to carry either.
                      */
                      aria-label={[
                        `Caption ${i + 1}: ${line?.text ?? ""}`,
                        proposed ? "proposed change" : "",
                        refused ? "refused by the judge" : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      aria-pressed={selection?.kind === "caption" && selection.index === i}
                      title={`${line?.text ?? ""} · ${line?.fadeIn ?? 0}s → ${line?.fadeOut ?? 0}s`}
                      // Keyboard activation — see the beat block above. This is
                      // the one that made the blocker a BLOCKER: selecting a
                      // plate is the ONLY entry to the caption inspector, so a
                      // keyboard-only operator could never edit a caption.
                      onClick={() => onSelect({ kind: "caption", index: i })}
                      onPointerDown={(event) => {
                        onSelect({ kind: "caption", index: i });
                        beginDrag(
                          {
                            kind: "caption",
                            line: i,
                            grabOffsetSec: secAt(event.clientX) - (line?.fadeIn ?? 0),
                            base: edl,
                          },
                          event,
                        );
                      }}
                    >
                      {/* The per-plate mark: out of the flow, so a 20px plate
                          still shows it. The word is in the lane header and in
                          this plate's accessible name — never the hue alone. */}
                      {(proposed || refused) && (
                        <span className={refused ? "cap-mark refused" : "cap-mark"} aria-hidden="true" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* The ruler is the sheet's own scrub, so the playhead is placed from
              this strip — a click anywhere along it seeks the preview. */}
          <div
            className="tl-ruler"
            role="slider"
            aria-label="Playhead"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round((playhead ?? 0) * duration)}
            tabIndex={0}
            onPointerDown={(event) => {
              beginDrag({ kind: "playhead" }, event);
              onPlayhead(duration > 0 ? Math.min(1, secAt(event.clientX) / duration) : 0);
            }}
            onKeyDown={(event) => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
              event.preventDefault();
              const step = duration > 0 ? 1 / duration : 0;
              const next = (playhead ?? 0) + (event.key === "ArrowRight" ? step : -step);
              onPlayhead(Math.min(1, Math.max(0, next)));
            }}
          >
            <span className="t-data">
              {playhead === null ? "click to place the playhead" : `${quantize((playhead * duration * 10) / 10)}s`}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
