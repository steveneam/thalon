import type { AudioCue, CaptionLine, Edl, EdlClip } from "@thalon/contracts";
import type { TakeView } from "./types";

/**
 * B-ve.3 edit helpers: pure, immutable transforms over a parsed EDL — the
 * five manual ops (reorder / trim / take-swap / caption moves / music
 * offset) as data operations. Every helper returns a NEW Edl; the compiler
 * caps (first beat carries no transition, xfade between beats, one
 * overlay-fade tail) are treated as lane invariants and preserved by
 * construction. Zero I/O — the save door (videoCuts.create at version+1)
 * and the render door live elsewhere.
 */

export interface Lane {
  /** The xfade-chained beat lane, in timeline order. */
  beats: EdlClip[];
  /** The at-most-one overlay-fade tail (the endcard machinery), pinned last. */
  overlay: EdlClip | null;
}

export function splitLane(edl: Edl): Lane {
  const overlayIndex = edl.video.findIndex((c) => c.transitionIn?.type === "overlay-fade");
  return overlayIndex === -1
    ? { beats: edl.video, overlay: null }
    : { beats: edl.video.slice(0, overlayIndex), overlay: edl.video[overlayIndex] };
}

function joinLane(edl: Edl, lane: Lane): Edl {
  return { ...edl, video: lane.overlay ? [...lane.beats, lane.overlay] : [...lane.beats] };
}

/** Assembled beat-lane duration: sum(durations) − sum(xfade overlaps) — the compiler's own math, for display. */
export function laneDuration(edl: Edl): number {
  const { beats } = splitLane(edl);
  const raw = beats.reduce((acc, c) => acc + c.duration - (c.transitionIn?.duration ?? 0), 0);
  return Math.round(raw * 1e6) / 1e6;
}

/**
 * Move a beat within the lane. Transitions are POSITION-bound, not
 * clip-bound: the fades live between beats, so reordering clips leaves the
 * fade rhythm in place (and the lane stays compiler-valid — the first
 * position never carries a transition). The overlay tail never moves.
 */
export function reorderBeat(edl: Edl, from: number, to: number): Edl {
  const lane = splitLane(edl);
  const n = lane.beats.length;
  if (from === to || from < 0 || to < 0 || from >= n || to >= n) return edl;
  const transitions = lane.beats.map((c) => c.transitionIn);
  const beats = [...lane.beats];
  const [moved] = beats.splice(from, 1);
  beats.splice(to, 0, moved);
  return joinLane(edl, {
    ...lane,
    beats: beats.map((clip, i) => {
      const rest = { ...clip };
      delete rest.transitionIn;
      return transitions[i] ? { ...rest, transitionIn: transitions[i] } : rest;
    }),
  });
}

/** Trim a beat: source in-point and/or timeline duration. Values clamp to legal (in ≥ 0, duration > 0). */
export function trimBeat(edl: Edl, index: number, patch: { in?: number; duration?: number }): Edl {
  const lane = splitLane(edl);
  if (index < 0 || index >= lane.beats.length) return edl;
  const beats = lane.beats.map((clip, i) =>
    i === index
      ? {
          ...clip,
          ...(patch.in !== undefined ? { in: Math.max(0, patch.in) } : {}),
          ...(patch.duration !== undefined ? { duration: Math.max(0.01, patch.duration) } : {}),
        }
      : clip,
  );
  return joinLane(edl, { ...lane, beats });
}

/** Swap a beat's source ref (take-swap). The source KIND is the clip's semantics (still = loop-hold) — it never changes on swap. */
export function swapBeatSource(edl: Edl, index: number, ref: string): Edl {
  const lane = splitLane(edl);
  if (index < 0 || index >= lane.beats.length) return edl;
  const beats = lane.beats.map((clip, i) =>
    i === index ? { ...clip, source: { ...clip.source, ref } } : clip,
  );
  return joinLane(edl, { ...lane, beats });
}

/** The overlay tail's trim boundary (`at`) — where the prior timeline freezes for the endcard fade. */
export function setOverlayAt(edl: Edl, at: number): Edl {
  const lane = splitLane(edl);
  if (!lane.overlay) return edl;
  return joinLane(edl, { ...lane, overlay: { ...lane.overlay, at: Math.max(0, at) } });
}

/** Patch one caption line (text edits + moves). Text is content — the judge gate binds at the approve door (B-ve.4). */
export function patchCaptionLine(edl: Edl, index: number, patch: Partial<CaptionLine>): Edl {
  if (!edl.captions || index < 0 || index >= edl.captions.lines.length) return edl;
  return {
    ...edl,
    captions: {
      ...edl.captions,
      lines: edl.captions.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    },
  };
}

/** Patch the (at most one) music cue: offset / static gain / tail easing. `copy` mode has no knobs — stream-copy is verbatim. */
export function patchMusic(
  edl: Edl,
  patch: Partial<Pick<AudioCue, "offset" | "gainDb" | "fadeOut">>,
): Edl {
  if (edl.audio.length === 0) return edl;
  const [cue, ...rest] = edl.audio;
  if (cue.mode === "copy") return edl;
  const next: AudioCue = {
    ...cue,
    ...(patch.offset !== undefined ? { offset: Math.max(0, patch.offset) } : {}),
    ...(patch.gainDb !== undefined ? { gainDb: patch.gainDb } : {}),
    ...("fadeOut" in patch ? { fadeOut: patch.fadeOut } : {}),
  };
  return { ...edl, audio: [next, ...rest] };
}

/** The output -t of record. Lane edits change the assembled duration — the operator confirms it explicitly (measured, not auto-synced under the endcard holds). */
export function setOutputDuration(edl: Edl, duration: number): Edl {
  if (!(duration > 0)) return edl;
  return { ...edl, output: { ...edl.output, duration } };
}

/**
 * Take-swap candidates for a clip: scoped to the slot of the take its ref
 * currently points at — keepers first, rejects visible WITH their reasons
 * (the learning material is part of the picker, ADR 0010). Sources that
 * match no slotted take (cut layers, unregistered files) get no picker.
 */
export function swapCandidatesFor(takes: TakeView[], currentRef: string): TakeView[] {
  const current = takes.find((t) => t.ref === currentRef);
  if (!current?.slot) return [];
  return takes
    .filter((t) => t.slot === current.slot && t.kind === current.kind)
    .sort((a, b) =>
      a.disposition !== b.disposition
        ? a.disposition === "keeper"
          ? -1
          : 1
        : a.ref.localeCompare(b.ref),
    );
}

/** A re-edit is a NEW VERSION: the next version number for a cut name (1 for a fresh name). */
export function nextVersionFor(cuts: { name: string; version: number }[], name: string): number {
  return cuts.reduce((max, c) => (c.name === name ? Math.max(max, c.version) : max), 0) + 1;
}
