import type { EdlDiff, VideoDeriveAspect } from "@thalon/contracts";
import type { TakeView } from "@/lib/videos/types";

/**
 * The editor's pure reads — what the sheet's marks and captions may
 * honestly say about a real cut. No DOM, no I/O.
 */

/** Ratio tolerance: enough to catch 1920×1080 and 1280×720 as one aspect. */
const ASPECT_EPSILON = 0.02;

const ASPECT_RATIOS: Readonly<Record<string, number>> = {
  "16:9": 16 / 9,
  "9:16": 9 / 16,
  "1:1": 1,
};

/**
 * Which aspect a cut's canvas IS. Returns null for a canvas that matches
 * none of them — the segmented control then shows nothing as current,
 * rather than rounding a 4:3 master into "16:9".
 */
export function aspectOf(width: number, height: number): "16:9" | VideoDeriveAspect | null {
  if (!(width > 0) || !(height > 0)) return null;
  const ratio = width / height;
  for (const [name, target] of Object.entries(ASPECT_RATIOS)) {
    if (Math.abs(ratio - target) <= ASPECT_EPSILON) return name as "16:9" | VideoDeriveAspect;
  }
  return null;
}

export interface ProposalMarks {
  /** Clip indices a proposed diff touches — the sheet's `.blk.prop`. */
  beats: ReadonlySet<number>;
  /** Caption line indices it touches — the sheet's `.blk-cap.prop`. */
  captions: ReadonlySet<number>;
  /** Whether it touches the music cue. */
  music: boolean;
}

/**
 * Where a proposed diff lands ON THE TIMELINE — the sheet's promise that
 * "the agent answers with a proposal on the timeline, never a silent
 * change". The diff vocabulary is caption-move / caption-text /
 * music-align / clip-crop, so those are the three lanes a proposal can
 * mark; nothing infers a mark the diff does not carry.
 */
export function proposalMarks(diff: EdlDiff | null): ProposalMarks {
  const beats = new Set<number>();
  const captions = new Set<number>();
  let music = false;
  for (const op of diff?.ops ?? []) {
    if (op.op === "clip-crop") beats.add(op.clip);
    else if (op.op === "music-align") music = true;
    else captions.add(op.line);
  }
  return { beats, captions, music };
}

/**
 * A candidate take's caption in the swap strip: a reject leads with its
 * REASON (the learning material is part of the picker, ADR 0010) and a
 * keeper says so.
 */
export function takeCaption(take: TakeView): string {
  if (take.disposition === "keeper") return "keeper";
  return take.reason ?? "rejected · no reason on record";
}
