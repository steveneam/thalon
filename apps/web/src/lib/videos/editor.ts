import type { AudioCue, CaptionLine, Edl, EdlClip, VideoSourceKind } from "@thalon/contracts";
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

/**
 * The classic NLE trim-start (B-ve.6 track view, left-edge drag): the source
 * in-point advances and the timeline duration shrinks by the same amount —
 * the beat's END keeps its story position (the chain ripples only by the
 * duration change). Clamps keep it legal: in ≥ 0, duration ≥ 0.1.
 */
export function trimBeatStart(edl: Edl, index: number, deltaSec: number): Edl {
  const lane = splitLane(edl);
  if (index < 0 || index >= lane.beats.length) return edl;
  const clip = lane.beats[index];
  const delta = Math.max(-clip.in, Math.min(deltaSec, clip.duration - 0.1));
  return trimBeat(edl, index, { in: clip.in + delta, duration: clip.duration - delta });
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

/**
 * Drop a beat from the cut (s80 — one of the fifteen jobs with no affordance).
 *
 * Refuses to empty the lane: a cut with no beats is not a shorter cut, it is a
 * broken one the compiler cannot lower, and "delete" should never be the door
 * to that. The overlay tail and the transition rhythm are handled exactly as
 * `reorderBeat` handles them — transitions are POSITION-bound, so the surviving
 * beats keep the fade rhythm and position 0 never carries a transitionIn.
 */
export function deleteBeat(edl: Edl, index: number): Edl {
  const lane = splitLane(edl);
  if (index < 0 || index >= lane.beats.length || lane.beats.length <= 1) return edl;
  const beats = lane.beats.filter((_, i) => i !== index);
  return joinLane(edl, {
    ...lane,
    beats: beats.map((clip, i) => {
      const rest = { ...clip };
      delete rest.transitionIn;
      // Position 0 must not carry a transition; every later position keeps the
      // transition that belongs to ITS slot, not to the clip that moved out.
      const transition = i === 0 ? undefined : lane.beats[i]?.transitionIn;
      return transition ? { ...rest, transitionIn: transition } : rest;
    }),
  });
}

/**
 * Split a beat at `offsetSec` seconds into its timeline duration (s95b — the
 * tools row's Split, cutting the selected block at the playhead).
 *
 * Both halves ride the SAME source: the first keeps the clip's in-point and
 * transition and ends at the cut; the second starts its source `offsetSec`
 * further in and carries NO transitionIn — a split is a hard cut, and quietly
 * inventing an xfade at it would smear the exact frame the operator chose.
 * Refuses (returns the EDL unchanged) when either half would fall under the
 * 0.1s floor every trim door already enforces.
 */
export function splitBeat(edl: Edl, index: number, offsetSec: number): Edl {
  const lane = splitLane(edl);
  if (index < 0 || index >= lane.beats.length) return edl;
  const clip = lane.beats[index];
  const offset = Math.round(offsetSec * 1e6) / 1e6;
  if (offset < 0.1 || clip.duration - offset < 0.1) return edl;
  const first = { ...clip, duration: offset };
  const second = { ...clip, in: clip.in + offset, duration: clip.duration - offset, name: `${clip.name}-split` };
  delete second.transitionIn;
  const beats = [...lane.beats];
  beats.splice(index, 1, first, second);
  return joinLane(edl, { ...lane, beats });
}

/**
 * Insert a beat AFTER `index`, sourced from an existing take ref.
 *
 * The new beat copies the neighbour's duration and source KIND rather than
 * inventing them: a still is a loop-hold and a motion clip is not, and guessing
 * that wrong produces a cut the compiler lowers into something nobody asked
 * for. `in` starts at 0 — the operator trims from there.
 */
export function insertBeat(edl: Edl, index: number, ref: string): Edl {
  const lane = splitLane(edl);
  if (lane.beats.length === 0) return edl;
  const at = Math.max(-1, Math.min(index, lane.beats.length - 1));
  const neighbour = lane.beats[Math.max(0, at)];
  const inserted = {
    name: `${neighbour.name}-insert`,
    source: { ...neighbour.source, ref },
    in: 0,
    duration: neighbour.duration,
  };
  const beats = [...lane.beats];
  beats.splice(at + 1, 0, inserted);
  return joinLane(edl, { ...lane, beats });
}

/**
 * Add a caption line. Text is CONTENT — it rides the judge harness before any
 * cut carrying it can be approved (ADR 0010), which is exactly why adding one
 * is safe to offer here: the gate binds at the approve door, not at the
 * keystroke. The plate inherits the previous line's placement so a new line
 * lands where the last one was rather than at the frame origin.
 */
export function insertCaptionLine(edl: Edl, afterIndex: number, text: string): Edl {
  if (!edl.captions) return edl;
  const lines = edl.captions.lines;
  const at = Math.max(-1, Math.min(afterIndex, lines.length - 1));
  const near = lines[Math.max(0, at)];
  const duration = edl.output.duration;
  const fadeIn = near ? Math.min(near.fadeOut, duration) : 0;
  const line: CaptionLine = near
    ? { ...near, text, fadeIn, fadeOut: Math.min(fadeIn + (near.fadeOut - near.fadeIn), duration) }
    : { text, x: Math.round(edl.output.width / 2), y: Math.round(edl.output.height * 0.8), fadeIn: 0, fadeOut: Math.min(3, duration), ramp: 0.4 };
  const next = [...lines];
  next.splice(at + 1, 0, line);
  return { ...edl, captions: { ...edl.captions, lines: next } };
}

/**
 * Add a caption plate OVER a beat (s95b — the tools row's Text on a selected
 * beat): the plate spans the beat's own timeline window, so the text lands on
 * the block the operator selected rather than wherever the last plate ended.
 * Style and placement inherit from the nearest existing line (the same
 * inheritance `insertCaptionLine` applies); the window is the compiler's own
 * accumulation (offset_k = offset_{k-1} + dur_{k-1} − fade_k), clamped to the
 * output duration. Refuses when the cut carries no caption style — a style
 * cannot be invented here (the judge gate and the compiler both read it).
 */
export function insertCaptionForBeat(edl: Edl, beatIndex: number, text: string): Edl {
  if (!edl.captions) return edl;
  const lane = splitLane(edl);
  if (beatIndex < 0 || beatIndex >= lane.beats.length) return edl;
  let start = 0;
  for (let i = 1; i <= beatIndex; i += 1) {
    start += lane.beats[i - 1].duration - (lane.beats[i].transitionIn?.duration ?? 0);
  }
  const clip = lane.beats[beatIndex];
  const fadeIn = Math.min(start, edl.output.duration);
  const fadeOut = Math.min(start + clip.duration, edl.output.duration);
  const lines = edl.captions.lines;
  const near = lines.filter((l) => l.fadeIn <= fadeIn).at(-1) ?? lines[0];
  const line: CaptionLine = near
    ? { ...near, text, fadeIn, fadeOut }
    : { text, x: Math.round(edl.output.width / 2), y: Math.round(edl.output.height * 0.8), fadeIn, fadeOut, ramp: 0.4 };
  // Plates render in array order (captionPlates walks a cursor), so the new
  // line lands where its fadeIn sorts, never appended out of sequence.
  const at = lines.findIndex((l) => l.fadeIn > fadeIn);
  const next = [...lines];
  next.splice(at === -1 ? lines.length : at, 0, line);
  return { ...edl, captions: { ...edl.captions, lines: next } };
}

/** Delete one caption line. Unlike beats, emptying the lane is legal — a cut with no captions is a cut. */
export function deleteCaptionLine(edl: Edl, index: number): Edl {
  if (!edl.captions || index < 0 || index >= edl.captions.lines.length) return edl;
  return {
    ...edl,
    captions: { ...edl.captions, lines: edl.captions.lines.filter((_, i) => i !== index) },
  };
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

/**
 * THE BEDS THIS PROJECT OFFERS.
 *
 * A candidate is a take the IMPORT marked as one — anything under a
 * `music-candidates/` segment, which is the exact rule import.ts applies — or
 * any take of kind `audio`, since an `music/*.mp3` is a bed by its nature.
 *
 * NOT "every slotless take", which is what this filtered on first and is
 * wrong: a slot binds a take to one beat, and plenty of takes lack one for
 * reasons that have nothing to do with music. Driving it surfaced
 * `motion/experiments/seedance-assembly-experiment-s43.mp4` — a silent video
 * experiment — being offered as a music bed. Slotlessness is a consequence of
 * being a candidate, never the definition of one.
 *
 * Keepers before rejects, then stable by ref: the same grammar the beat picker
 * uses, because a reject carries its reason and that reason is learning
 * material.
 */
export function musicCandidatesFor(takes: TakeView[]): TakeView[] {
  return takes
    .filter((t) => t.kind === "audio" || t.ref.split("/").includes("music-candidates"))
    .sort((a, b) =>
      a.disposition !== b.disposition
        ? a.disposition === "keeper"
          ? -1
          : 1
        : a.ref.localeCompare(b.ref),
    );
}

/**
 * SWAP THE MUSIC TRACK — the verb the copilot chip has been offering and the
 * surface could not perform.
 *
 * `patchMusic` only ever PATCHED an existing cue, which is why a cut with no
 * music could never acquire any and a cut with the wrong bed could never
 * change it. This is the missing half: ADD a cue where there is none, REPLACE
 * the source where there is one. Per the pre-plan's contract ruling, the bed is
 * addressed as a PROJECT-RELATIVE ref against `audioCueSchema`, which already
 * accepts exactly this — so no window opens. (Pointing a cue at a *stored* bed,
 * addressed by sha, is the bridge that would need one, and is not this route.)
 *
 * Two decisions the swap makes on the operator's behalf, both stated rather
 * than silent:
 *
 *  - MODE BECOMES `encode`. `copy` means "stream-copy this source verbatim",
 *    and by contract it has no knobs — the inspector correctly refuses to draw
 *    offset, gain and tail for it. Choosing a bed and then finding every
 *    control inert is the dead door this verb exists to close, so a chosen bed
 *    is always an encoded one.
 *  - OFFSET RESETS TO 0. An offset is measured seconds INTO a particular file;
 *    carried onto a different track it silently starts the new bed somewhere
 *    arbitrary. Gain and tail easing DO carry: a level and a fade-out at
 *    0:38 are facts about the cut, not about which file is under them.
 */
export function setMusicSource(edl: Edl, ref: string, kind: VideoSourceKind = "take"): Edl {
  const source = { kind, ref };
  const [cue, ...rest] = edl.audio;
  if (!cue) {
    return { ...edl, audio: [{ source, offset: 0, gainDb: 0, mode: "encode" }] };
  }
  return { ...edl, audio: [{ ...cue, source, offset: 0, mode: "encode" }, ...rest] };
}

/**
 * Drop the music cue (s95b — the tools row's Delete on the selected music
 * block). A silent cut is legal and stays a CHOICE with a way back: the lane's
 * empty state is already the door into the bed picker, so removing a bed never
 * strands the cut. Gain/offset go with the cue — they were facts about it.
 */
export function removeMusicCue(edl: Edl): Edl {
  if (edl.audio.length === 0) return edl;
  const [, ...rest] = edl.audio;
  return { ...edl, audio: rest };
}

/**
 * B-audio.1 piece 2 (AUDITION): the music lane's static gain, in dB, as a
 * player volume. The drawn waveform has been silent-by-omission since s44 —
 * clicking it set the in-point but playback ignored both the in-point and the
 * level, so the operator heard something the render would never produce.
 *
 * A boost above 0 dB cannot be auditioned (a player tops out at unity), so it
 * CLAMPS and the lane says so rather than pretending — the same honesty the
 * engine's `bedVolumeFromGainDb` applies on the render side.
 */
export function auditionVolume(gainDb: number): number {
  if (!Number.isFinite(gainDb)) return 1;
  return Math.max(0, Math.min(1, 10 ** (gainDb / 20)));
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
export function nextVersionFor(
  cuts: readonly { name: string; version: number }[],
  name: string,
): number {
  return cuts.reduce((max, c) => (c.name === name ? Math.max(max, c.version) : max), 0) + 1;
}

/** What the default-cut rule ranks on — the browse summary the project detail already carries. */
export interface RankableCut {
  id: string;
  version: number;
  edl: { beats: number; captionLines: number; audio: "silent" | "copy" | "encode" };
}

/**
 * WHICH CUT THE EDITOR OPENS — a stated rule, replacing `project.cuts[0]`.
 *
 * The old default was whatever the detail query returned first: not the master,
 * not the latest, not the furthest along. On the concept film that is a 1-beat
 * scored master with no captions — the emptiest cut in the project — so the
 * editor opened on the one cut with almost nothing to edit. The founder's call
 * (s80) was "can make the one with the music the default"; the drive harness
 * honoured it by ranking cuts explicitly, and this is the same rule moved into
 * the PRODUCT, where it belongs.
 *
 * The rule: OPEN THE RICHEST CUT — the one carrying the most work, counting
 * beats, caption lines and a music cue as one more. Music is a term rather than
 * the first sort key on purpose: keying on it would open that same 1-beat
 * scored master ahead of a ten-beat captioned cut, which is the exact defect
 * this replaces. Ties go to the higher version, then to a stable id compare so
 * the same data always opens the same cut.
 *
 * Deliberately NOT ranked on: `createdAt`, which on imported projects is the
 * seeding timestamp rather than when anyone last worked on the cut, and
 * `status`, because every cut here is already rendered or approved — a re-edit
 * always lands as a new version regardless of which one it starts from.
 */
export function defaultCutFor<T extends RankableCut>(cuts: readonly T[]): T | null {
  const weight = (c: RankableCut) =>
    c.edl.beats + c.edl.captionLines + (c.edl.audio === "silent" ? 0 : 1);
  return (
    [...cuts].sort(
      (a, b) => weight(b) - weight(a) || b.version - a.version || a.id.localeCompare(b.id),
    )[0] ?? null
  );
}
