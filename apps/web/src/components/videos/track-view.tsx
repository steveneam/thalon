"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Magnet, Minus, Plus } from "lucide-react";
import type { Edl } from "@thalon/contracts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  patchCaptionLine,
  patchMusic,
  reorderBeat,
  setOverlayAt,
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
  timelineChunks,
} from "@/lib/videos/track-view";

/**
 * B-ve.6 track view (docs/research/nle-timeline-ui-patterns.md): the EDL
 * against a time axis. The beat lane is MAGNETIC (FCP model — our chain
 * contract rendered truthfully): dragging a chunk reorders with live
 * ripple, edge-drags trim, nothing can gap or collide. Captions above the
 * spine, music below (absolute times — the contract's truth). Every gesture
 * funnels through the SAME pure transforms the inspector fields use; Esc
 * cancels a drag losslessly (the Figma bar).
 */

const SNAP_PX = 8;
const EDGE_PX = 9;

/** Sticky-left lane label — the Resolve track-header anatomy, one word per lane. */
function LaneLabel({ children }: { children: string }) {
  return (
    <span
      aria-hidden
      className="u-eyebrow pointer-events-none sticky left-0 z-0 float-left mt-0.5 rounded-r bg-background/60 px-1.5 text-2xs leading-4 text-muted-foreground/80"
    >
      {children}
    </span>
  );
}

type Drag =
  | { kind: "reorder"; index: number; grabOffsetSec: number; base: Edl }
  | { kind: "trim-start" | "trim-end"; index: number; base: Edl }
  | { kind: "overlay-at"; base: Edl }
  | { kind: "caption"; line: number; grabOffsetSec: number; base: Edl }
  | { kind: "music"; startOffset: number; startClientX: number; base: Edl }
  | { kind: "playhead" };

export function TrackView({
  edl,
  selected,
  onSelect,
  onEdl,
  onPlayhead,
  posterFor,
}: {
  edl: Edl;
  selected: number;
  onSelect: (index: number) => void;
  /** The editor's single edit funnel — dirty bit + attribution reset live there. */
  onEdl: (fn: (edl: Edl) => Edl) => void;
  /** Playhead moved — the editor seeks its preview video here (scrub). */
  onPlayhead?: (sec: number) => void;
  /** Guarded media URL for a clip's source — poster-frame chunk fills (the Resolve/FCP filmstrip signal). Null = plain chunks. */
  posterFor?: ((index: number) => string | null) | null;
}) {
  const laneRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const [pxPerSec, setPxPerSec] = useState(24);
  const [snapping, setSnapping] = useState(true);
  const [playhead, setPlayhead] = useState<number | null>(null);
  const [readout, setReadout] = useState<string | null>(null);

  const chunks = useMemo(() => timelineChunks(edl), [edl]);
  const { beats, overlay } = useMemo(() => splitLane(edl), [edl]);
  const duration = edl.output.duration;
  const width = Math.max(1, Math.ceil(duration * pxPerSec)) + 16;
  const snapThreshold = SNAP_PX / pxPerSec;

  // Esc cancels the active drag losslessly — restore the drag's base EDL.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const drag = dragRef.current;
      if (e.key !== "Escape" || !drag || drag.kind === "playhead") return;
      onEdl(() => drag.base);
      dragRef.current = null;
      setReadout(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEdl]);

  const secAt = (clientX: number): number => {
    const rect = laneRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, (clientX - rect.left) / pxPerSec);
  };

  const snap = (sec: number, exclude?: number | null) => {
    const targets = snapTargetsFor(edl, playhead).filter((t) => t !== exclude);
    return applySnap(sec, targets, snapThreshold, snapping);
  };

  const movePlayhead = (clientX: number) => {
    const sec = Math.min(quantize(secAt(clientX)), duration);
    setPlayhead(sec);
    onPlayhead?.(sec);
  };

  const beginDrag = (drag: Drag, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = drag;
  };

  const onLanePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const sec = secAt(e.clientX);
    if (drag.kind === "playhead") {
      movePlayhead(e.clientX);
      return;
    }
    if (drag.kind === "reorder") {
      const center =
        sec - drag.grabOffsetSec + (beats[drag.index]?.duration ?? 0) / 2;
      const target = reorderTargetFor(edl, drag.index, center);
      setReadout(`${beats[drag.index]?.name ?? ""} → slot ${target + 1}`);
      if (target !== drag.index) {
        onEdl((cur) => reorderBeat(cur, drag.index, target));
        dragRef.current = { ...drag, index: target };
        onSelect(target);
      }
      return;
    }
    if (drag.kind === "trim-end") {
      const start = beatStarts(edl)[drag.index] ?? 0;
      const end = snap(sec, null).value;
      const nextDuration = Math.max(0.1, quantize(end - start));
      setReadout(`${beats[drag.index]?.name ?? ""} · ${nextDuration}s`);
      onEdl((cur) => trimBeat(cur, drag.index, { duration: nextDuration }));
      return;
    }
    if (drag.kind === "trim-start") {
      const start = beatStarts(edl)[drag.index] ?? 0;
      const target = snap(sec, null).value;
      const delta = quantize(target - start);
      if (delta !== 0) {
        setReadout(
          `${beats[drag.index]?.name ?? ""} · in ${quantize((beats[drag.index]?.in ?? 0) + delta)}s`,
        );
        onEdl((cur) => trimBeatStart(cur, drag.index, delta));
      }
      return;
    }
    if (drag.kind === "overlay-at") {
      const at = Math.min(Math.max(0, snap(sec, null).value), duration);
      setReadout(`freeze at ${at}s`);
      onEdl((cur) => setOverlayAt(cur, at));
      return;
    }
    if (drag.kind === "caption") {
      const line = edl.captions?.lines[drag.line];
      if (!line) return;
      const span = line.fadeOut - line.fadeIn;
      const fadeIn = Math.max(0, snap(sec - drag.grabOffsetSec, null).value);
      setReadout(`“${line.text.slice(0, 24)}” · ${fadeIn}s → ${quantize(fadeIn + span)}s`);
      onEdl((cur) =>
        patchCaptionLine(cur, drag.line, { fadeIn, fadeOut: quantize(fadeIn + span) }),
      );
      return;
    }
    if (drag.kind !== "music") return;
    // Music: dragging the waveform block LEFT advances into the track (offset grows).
    const deltaSec = (drag.startClientX - e.clientX) / pxPerSec;
    const offset = Math.max(0, quantize(drag.startOffset + deltaSec));
    setReadout(`music offset ${offset}s`);
    onEdl((cur) => patchMusic(cur, { offset }));
  };

  const endDrag = () => {
    dragRef.current = null;
    setReadout(null);
  };

  const ticks = useMemo(() => {
    const step = pxPerSec >= 60 ? 1 : pxPerSec >= 24 ? 5 : 10;
    const out: number[] = [];
    for (let t = 0; t <= duration; t += step) out.push(t);
    return out;
  }, [duration, pxPerSec]);

  const cue = edl.audio[0];
  const playheadX = playhead !== null ? playhead * pxPerSec : null;

  return (
    <div className="flex flex-col gap-2" data-testid="track-view">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Zoom out"
          onClick={() => setPxPerSec((z) => Math.max(6, z / 1.5))}
        >
          <Minus aria-hidden />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Zoom in"
          onClick={() => setPxPerSec((z) => Math.min(240, z * 1.5))}
        >
          <Plus aria-hidden />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const w = laneRef.current?.parentElement?.clientWidth ?? 800;
            setPxPerSec(Math.max(6, (w - 24) / duration));
          }}
        >
          Fit
        </Button>
        <Button
          variant={snapping ? "secondary" : "outline"}
          size="sm"
          aria-pressed={snapping}
          onClick={() => setSnapping((s) => !s)}
        >
          <Magnet aria-hidden className="size-3.5" /> snap
        </Button>
        <span aria-live="polite" className="u-tabular ml-auto text-xs text-muted-foreground">
          {readout ??
            (playhead !== null ? `playhead ${playhead}s` : "drag chunks · edges trim · Esc cancels")}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-background">
        <div
          ref={laneRef}
          className="relative select-none"
          style={{ width }}
          onPointerMove={onLanePointerMove}
          onPointerUp={endDrag}
        >
          {/* Ruler — click/drag places the playhead (scrubs the render when present). */}
          <div
            role="slider"
            aria-label="Playhead"
            aria-valuenow={playhead ?? 0}
            tabIndex={0}
            className="u-tabular relative h-6 cursor-col-resize border-b border-border text-2xs text-muted-foreground"
            onPointerDown={(e) => {
              beginDrag({ kind: "playhead" }, e);
              movePlayhead(e.clientX);
            }}
          >
            {ticks.map((t) => (
              <span
                key={t}
                className="absolute top-0 h-full border-l border-border/70 pl-1"
                style={{ left: t * pxPerSec }}
              >
                {t}s
              </span>
            ))}
          </div>

          {/* Caption lane — chips at absolute fade windows (the contract's truth). */}
          <div className="relative h-8 border-b border-border/60 bg-muted/20">
            <LaneLabel>captions</LaneLabel>
            {(edl.captions?.lines ?? []).map((line, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Caption: ${line.text}`}
                title={`${line.text} · ${line.fadeIn}s → ${line.fadeOut}s`}
                onPointerDown={(e) =>
                  beginDrag(
                    { kind: "caption", line: i, grabOffsetSec: secAt(e.clientX) - line.fadeIn, base: edl },
                    e,
                  )
                }
                className="absolute top-1 h-6 cursor-grab truncate rounded border border-primary/50 bg-primary/10 px-1 text-left text-2xs leading-5 hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                style={{
                  left: line.fadeIn * pxPerSec,
                  width: Math.max(10, (line.fadeOut - line.fadeIn) * pxPerSec),
                }}
              >
                {line.text}
              </button>
            ))}
          </div>

          {/* Beat spine — magnetic. */}
          <div className="relative h-16 border-b border-border/60">
            <LaneLabel>video</LaneLabel>
            {chunks.map((chunk) => {
              const isOverlay = chunk.kind === "overlay";
              const isSelected = selected === chunk.index;
              return (
                <div
                  key={`${chunk.kind}-${chunk.index}`}
                  role="button"
                  aria-label={`${chunk.name} (${chunk.duration}s)`}
                  aria-pressed={isSelected}
                  tabIndex={0}
                  onPointerDown={(e) => {
                    onSelect(chunk.index);
                    if (isOverlay) {
                      beginDrag({ kind: "overlay-at", base: edl }, e);
                      return;
                    }
                    const rect = (e.currentTarget as Element).getBoundingClientRect();
                    const inLeftEdge = e.clientX - rect.left <= EDGE_PX;
                    const inRightEdge = rect.right - e.clientX <= EDGE_PX;
                    if (inRightEdge) beginDrag({ kind: "trim-end", index: chunk.index, base: edl }, e);
                    else if (inLeftEdge)
                      beginDrag({ kind: "trim-start", index: chunk.index, base: edl }, e);
                    else
                      beginDrag(
                        {
                          kind: "reorder",
                          index: chunk.index,
                          grabOffsetSec: secAt(e.clientX) - chunk.start,
                          base: edl,
                        },
                        e,
                      );
                  }}
                  className={cn(
                    "absolute flex h-12 cursor-grab flex-col justify-center overflow-hidden rounded-md border px-1.5",
                    "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    isOverlay
                      ? "top-1 h-9 border-dashed border-amber-600/70 bg-amber-500/10"
                      : "top-2 border-border bg-card hover:bg-muted/60",
                    isSelected && "ring-2 ring-ring/60",
                  )}
                  style={{
                    left: chunk.start * pxPerSec,
                    width: Math.max(14, chunk.duration * pxPerSec),
                    zIndex: isOverlay ? 2 : 1,
                  }}
                >
                  {/* Poster-frame fill — the filmstrip signal (Resolve/FCP); media never eats the drag. */}
                  {(() => {
                    const poster = posterFor?.(chunk.index) ?? null;
                    if (!poster) return null;
                    const still = edl.video[chunk.index]?.source.kind === "still";
                    return still ? (
                      // eslint-disable-next-line @next/next/no-img-element -- guarded local media route, not an optimizable asset
                      <img
                        aria-hidden
                        alt=""
                        src={poster}
                        className="pointer-events-none absolute inset-0 size-full object-cover opacity-45"
                      />
                    ) : (
                      <video
                        aria-hidden
                        muted
                        preload="metadata"
                        src={poster}
                        className="pointer-events-none absolute inset-0 size-full object-cover opacity-45"
                      />
                    );
                  })()}
                  {/* The xfade enters as an overlapped edge — drawn, not implied. */}
                  {chunk.fadeIn > 0 && !isOverlay && (
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary/25 to-transparent"
                      style={{ width: chunk.fadeIn * pxPerSec }}
                    />
                  )}
                  <span className="relative truncate rounded-sm bg-background/80 px-1 text-xs font-medium leading-4 [align-self:start]">
                    {chunk.name}
                  </span>
                  <span className="u-tabular relative mt-auto truncate rounded-sm bg-background/70 px-1 text-2xs leading-4 text-muted-foreground [align-self:start]">
                    {isOverlay ? `freeze ${chunk.start}s` : `${chunk.duration}s`}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Music lane — offset drags the SOURCE under the timeline window. */}
          <div className="relative h-10">
            <LaneLabel>music</LaneLabel>
            {cue ? (
              <div
                role="button"
                aria-label={`Music (offset ${cue.offset}s)`}
                tabIndex={0}
                onPointerDown={(e) => {
                  if (cue.mode === "copy") return;
                  beginDrag(
                    { kind: "music", startOffset: cue.offset, startClientX: e.clientX, base: edl },
                    e,
                  );
                }}
                className={cn(
                  "absolute inset-x-0 top-1 flex h-8 items-center gap-2 truncate rounded-md border px-2 text-2xs",
                  cue.mode === "copy"
                    ? "cursor-default border-border bg-muted/40 text-muted-foreground"
                    : "cursor-grab border-sky-700/50 bg-sky-500/10 hover:bg-sky-500/20",
                )}
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(90deg, transparent 0 6px, color-mix(in oklab, currentColor 12%, transparent) 6px 7px)",
                }}
              >
                <span className="truncate font-mono">{cue.source.ref}</span>
                <span className="u-tabular ml-auto">
                  {cue.mode === "copy" ? "stream copy — knobless" : `offset ${cue.offset}s`}
                </span>
              </div>
            ) : (
              <p className="px-2 pt-2 text-2xs text-muted-foreground">silent cut — no music lane</p>
            )}
          </div>

          {playheadX !== null && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 z-10 w-px bg-destructive"
              style={{ left: playheadX }}
            >
              {/* The playhead head — the universal NLE marker. */}
              <span className="absolute -left-1 top-0 size-2 rounded-b-sm bg-destructive" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
