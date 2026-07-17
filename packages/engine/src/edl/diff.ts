import { edlSchema, type Edl, type EdlDiff } from "@thalon/contracts";

/**
 * B-ve.4 (ADR 0010): apply an EDL diff — the pure transform both sides of
 * the wire share. The editor applies it to preview an agent proposal; the
 * save door RE-applies it against the base cut to verify the submitted EDL
 * is exactly base + diff (replayable is an executable check, not a
 * convention). Deterministic: same base + same diff ⇒ the same EDL, always,
 * and the result re-parses through edlSchema so an applied diff can never
 * produce an invalid EDL.
 */

export class EdlDiffApplyError extends Error {
  constructor(
    /** Index into diff.ops of the op that failed. */
    public readonly opIndex: number,
    message: string,
  ) {
    super(`edl diff op ${opIndex}: ${message}`);
    this.name = "EdlDiffApplyError";
  }
}

export function applyEdlDiff(base: Edl, diff: EdlDiff): Edl {
  const next: Edl = structuredClone(base);
  diff.ops.forEach((op, i) => {
    switch (op.op) {
      case "caption-move":
      case "caption-text": {
        const line = next.captions?.lines[op.line];
        if (!line) {
          throw new EdlDiffApplyError(
            i,
            `caption line ${op.line} does not exist (the cut has ${next.captions?.lines.length ?? 0})`,
          );
        }
        if (op.op === "caption-move") {
          line.x = op.x;
          line.y = op.y;
        } else {
          line.text = op.text;
        }
        break;
      }
      case "music-align": {
        const cue = next.audio[op.cue];
        if (!cue) {
          throw new EdlDiffApplyError(
            i,
            `audio cue ${op.cue} does not exist (the cut has ${next.audio.length})`,
          );
        }
        if (cue.mode === "copy") {
          throw new EdlDiffApplyError(
            i,
            "audio cue is stream-copied — alignment knobs need an encode cue",
          );
        }
        if (op.offset !== undefined) cue.offset = op.offset;
        if (op.gainDb !== undefined) cue.gainDb = op.gainDb;
        if (op.fadeIn !== undefined) cue.fadeIn = op.fadeIn;
        if (op.fadeOut !== undefined) cue.fadeOut = op.fadeOut;
        break;
      }
      default: {
        // Additive-kind ratchet (B-ve.7 half-window): a contract op kind
        // without an engine arm must refuse, never silently no-op — a
        // dropped op would let base + diff "replay-verify" an EDL the diff
        // never produced. The cast keeps this arm alive even when the
        // switch above is exhaustive.
        throw new EdlDiffApplyError(
          i,
          `op kind "${(op as { op: string }).op}" has no engine arm yet`,
        );
      }
    }
  });
  return edlSchema.parse(next);
}
