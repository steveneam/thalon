import type { Edl } from "@thalon/contracts";
import { splitLane } from "./editor";

/**
 * B-ve.6 track-view geometry: the EDL chain rendered against a time axis —
 * pure math, no DOM. The beat lane is MAGNETIC (docs/research/
 * nle-timeline-ui-patterns.md §2): starts DERIVE from durations exactly as
 * the compiler derives them (offset_k = offset_{k-1} + dur_{k-1} − fade_k),
 * so the view can never draw a gap or collision the render wouldn't have.
 */

export interface TrackChunk {
  /** Index into edl.video (selection joins the existing inspector). */
  index: number;
  kind: "beat" | "overlay";
  name: string;
  /** Timeline start, seconds — derived for beats, explicit `at` for the overlay. */
  start: number;
  duration: number;
  /** The xfade this chunk enters with (drawn as an overlapped edge). */
  fadeIn: number;
}

/** Derived start times for the beat lane, the compiler's own accumulation. */
export function beatStarts(edl: Edl): number[] {
  const { beats } = splitLane(edl);
  const starts: number[] = [];
  let offset = 0;
  beats.forEach((clip, i) => {
    if (i === 0) {
      starts.push(0);
      return;
    }
    offset += beats[i - 1].duration - (clip.transitionIn?.duration ?? 0);
    starts.push(offset);
  });
  return starts;
}

export function timelineChunks(edl: Edl): TrackChunk[] {
  const { beats, overlay } = splitLane(edl);
  const starts = beatStarts(edl);
  const chunks: TrackChunk[] = beats.map((clip, i) => ({
    index: i,
    kind: "beat",
    name: clip.name,
    start: starts[i],
    duration: clip.duration,
    fadeIn: clip.transitionIn?.duration ?? 0,
  }));
  if (overlay) {
    chunks.push({
      index: beats.length,
      kind: "overlay",
      name: overlay.name,
      start: overlay.at ?? 0,
      duration: Math.max(0, edl.output.duration - (overlay.at ?? 0)),
      fadeIn: overlay.transitionIn?.duration ?? 0,
    });
  }
  return chunks;
}

/** The contract's own rounding (compile.ts fmt) — drags stay surgical, never 0.1s-web-sloppy. */
export function quantize(sec: number): number {
  return Math.round(sec * 1e6) / 1e6;
}

/**
 * Where a dragged beat's CENTER would slot it: magnetic reorder — the target
 * index is how many OTHER beats' midpoints the center has passed. Never a
 * free position; always a slot.
 */
export function reorderTargetFor(edl: Edl, draggedIndex: number, centerSec: number): number {
  const { beats } = splitLane(edl);
  const starts = beatStarts(edl);
  const others = beats
    .map((clip, i) => ({ i, mid: starts[i] + clip.duration / 2 }))
    .filter(({ i }) => i !== draggedIndex);
  let target = 0;
  for (const other of others) if (centerSec > other.mid) target += 1;
  return Math.min(Math.max(target, 0), beats.length - 1);
}

/** Snap targets: beat boundaries, the endcard freeze, caption fade edges, the playhead. */
export function snapTargetsFor(edl: Edl, playheadSec: number | null): number[] {
  const targets = new Set<number>([0, edl.output.duration]);
  const chunks = timelineChunks(edl);
  for (const chunk of chunks) {
    targets.add(quantize(chunk.start));
    targets.add(quantize(chunk.start + chunk.duration));
  }
  for (const line of edl.captions?.lines ?? []) {
    targets.add(quantize(line.fadeIn));
    targets.add(quantize(line.fadeOut));
  }
  if (playheadSec !== null) targets.add(quantize(playheadSec));
  return [...targets].sort((a, b) => a - b);
}

/** Snap when within threshold (guides appear on approach — the Figma bar); otherwise pass through quantized. */
export function applySnap(
  sec: number,
  targets: number[],
  thresholdSec: number,
  enabled: boolean,
): { value: number; snapped: number | null } {
  const q = quantize(sec);
  if (!enabled) return { value: q, snapped: null };
  let best: number | null = null;
  for (const t of targets) {
    if (Math.abs(t - q) <= thresholdSec && (best === null || Math.abs(t - q) < Math.abs(best - q))) {
      best = t;
    }
  }
  return best === null ? { value: q, snapped: null } : { value: best, snapped: best };
}
