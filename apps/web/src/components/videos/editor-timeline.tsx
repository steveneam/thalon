"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Edl } from "@thalon/contracts";
import {
  patchCaptionLine,
  patchMusic,
  reorderBeat,
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
        <span className="t-label" aria-live="polite">
          {readout ?? "drag to reorder · trim at edges · blocks close ranks · Esc cancels"}
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
            <div className="lane-hd">
              Video
              <small>beats · takes</small>
            </div>
            <div className="lane-tr" ref={trackRef}>
              {beats.length === 0 ? (
                <span className="t-label">This cut has no beat lane.</span>
              ) : (
                beats.map((clip, i) => {
                  const marks = [
                    selection?.kind === "beat" && selection.index === i ? "on" : "",
                    propBeats.has(i) ? "prop" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <button
                      key={`${clip.name}-${i}`}
                      type="button"
                      className={marks === "" ? "blk" : `blk ${marks}`}
                      style={{ width: `${widths[i]}%` }}
                      aria-pressed={selection?.kind === "beat" && selection.index === i}
                      title={`${clip.name} · ${clip.duration}s · ${clip.source.ref}`}
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
                      {clip.name}
                      {propBeats.has(i) && <span className="prop-tag">proposed</span>}
                    </button>
                  );
                })
              )}
              {overlay !== null && duration > 0 && (
                <span
                  className="blk-overlay"
                  style={{ left: `${Math.min(100, ((overlay.at ?? 0) / duration) * 100)}%` }}
                  title={`${overlay.name} · endcard freeze at ${overlay.at ?? 0}s — the prior timeline holds under it`}
                >
                  {overlay.name}
                </span>
              )}
            </div>
          </div>

          <div className="lane">
            <div className="lane-hd">
              Music
              <small>cue · waveform</small>
            </div>
            <div className="lane-tr">
              {cue === undefined ? (
                <span className="t-label">Silent cut — no music lane on this EDL.</span>
              ) : (
                <button
                  type="button"
                  className={[
                    "blk-music",
                    selection?.kind === "music" ? "on" : "",
                    propMusic ? "prop" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ width: "100%" }}
                  aria-pressed={selection?.kind === "music"}
                  title={
                    cue.mode === "copy"
                      ? `${cue.source.ref} · stream-copied verbatim — no knobs by contract`
                      : `${cue.source.ref} · offset ${cue.offset}s · gain ${cue.gainDb}dB`
                  }
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
                />
              )}
            </div>
          </div>

          <div className="lane">
            <div className="lane-hd">
              Captions
              <small>plates · fades</small>
            </div>
            <div className="lane-tr" style={{ alignItems: "center" }}>
              {plates.length === 0 ? (
                <span className="t-label">No caption lane on this cut.</span>
              ) : (
                plates.map((plate, i) => {
                  const line = edl.captions?.lines[i];
                  const marks = [
                    selection?.kind === "caption" && selection.index === i ? "on" : "",
                    propCaptions.has(i) ? "prop" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <button
                      key={i}
                      type="button"
                      className={marks === "" ? "blk-cap" : `blk-cap ${marks}`}
                      style={{ width: `${plate.width}%`, marginLeft: `${plate.gap}%` }}
                      aria-label={`Caption ${i + 1}: ${line?.text ?? ""}`}
                      aria-pressed={selection?.kind === "caption" && selection.index === i}
                      title={`${line?.text ?? ""} · ${line?.fadeIn ?? 0}s → ${line?.fadeOut ?? 0}s`}
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
                    />
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
