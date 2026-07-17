import { edlSchema, type Edl, type EdlInput } from "@thalon/contracts";
import { describe, expect, it } from "vitest";
import { trimBeatStart } from "../editor";
import {
  applySnap,
  beatStarts,
  quantize,
  reorderTargetFor,
  snapTargetsFor,
  timelineChunks,
} from "../track-view";

/**
 * B-ve.6 track-view geometry: derived starts mirror the compiler's own
 * accumulation (offset_k = offset_{k-1} + dur_{k-1} − fade_k), reorder is
 * magnetic (slots, never positions), snapping is opt-in and quantized.
 */

function edl(): Edl {
  const input: EdlInput = {
    name: "film",
    output: { width: 1920, height: 1080, fps: 24, duration: 20 },
    video: [
      { name: "b1", source: { kind: "take", ref: "motion/keepers/b1.mp4" }, duration: 5 },
      {
        name: "b2",
        source: { kind: "take", ref: "motion/keepers/b2.mp4" },
        in: 2,
        duration: 5,
        transitionIn: { type: "xfade", duration: 0.5 },
      },
      {
        name: "b3",
        source: { kind: "take", ref: "motion/keepers/b3.mp4" },
        duration: 5,
        transitionIn: { type: "xfade", duration: 0.5 },
      },
      {
        name: "endcard",
        source: { kind: "still", ref: "stills/keepers/endcard.png" },
        duration: 20,
        at: 13,
        transitionIn: { type: "overlay-fade", duration: 0.4 },
      },
    ],
    captions: {
      style: { pointsize: 40 },
      lines: [{ text: "always watching", x: 960, y: 933, fadeIn: 0.9, fadeOut: 4 }],
    },
    audio: [{ source: { kind: "audio", ref: "music/track.mp3" }, offset: 105 }],
  };
  return edlSchema.parse(input);
}

describe("beatStarts — the compiler's own math", () => {
  it("derives starts as prior duration minus this clip's fade", () => {
    // b1 at 0 · b2 at 5−0.5=4.5 · b3 at 4.5+5−0.5=9
    expect(beatStarts(edl())).toEqual([0, 4.5, 9]);
  });
});

describe("timelineChunks", () => {
  it("renders beats at derived starts and the overlay at its explicit freeze", () => {
    const chunks = timelineChunks(edl());
    expect(chunks.map((c) => [c.kind, c.name, c.start, c.duration])).toEqual([
      ["beat", "b1", 0, 5],
      ["beat", "b2", 4.5, 5],
      ["beat", "b3", 9, 5],
      ["overlay", "endcard", 13, 7],
    ]);
    // Selection index joins the existing inspector: overlay = edl.video index 3.
    expect(chunks[3].index).toBe(3);
  });
});

describe("reorderTargetFor — magnetic slots, never positions", () => {
  it("targets by how many other midpoints the dragged center has passed", () => {
    const e = edl();
    expect(reorderTargetFor(e, 0, 0.5)).toBe(0); // barely moved
    expect(reorderTargetFor(e, 0, 8)).toBe(1); // past b2's midpoint (7)
    expect(reorderTargetFor(e, 0, 12)).toBe(2); // past b3's midpoint (11.5)
    expect(reorderTargetFor(e, 2, 1)).toBe(0); // dragged left past everything
    expect(reorderTargetFor(e, 0, 999)).toBe(2); // clamped to the lane
  });
});

describe("snapping", () => {
  it("targets = boundaries + caption fades + endcard freeze + playhead, sorted", () => {
    const targets = snapTargetsFor(edl(), 6.25);
    expect(targets).toEqual([0, 0.9, 4, 4.5, 5, 6.25, 9, 9.5, 13, 14, 20]);
  });

  it("snaps within threshold when enabled; quantizes and passes through otherwise", () => {
    const targets = snapTargetsFor(edl(), null);
    expect(applySnap(4.42, targets, 0.15, true)).toEqual({ value: 4.5, snapped: 4.5 });
    expect(applySnap(4.42, targets, 0.15, false)).toEqual({ value: 4.42, snapped: null });
    expect(applySnap(7.123456789, targets, 0.15, true)).toEqual({
      value: 7.123457,
      snapped: null,
    });
    expect(quantize(7.123456789)).toBe(7.123457);
  });
});

describe("trimBeatStart — the classic NLE trim mapped to {in, duration}", () => {
  it("advances the in-point and shrinks the duration together, clamped legal", () => {
    const e = edl();
    const trimmed = trimBeatStart(e, 1, 1);
    expect(trimmed.video[1].in).toBe(3);
    expect(trimmed.video[1].duration).toBe(4);
    // Extend left is clamped by the source's in-point (in ≥ 0).
    const extended = trimBeatStart(e, 1, -5);
    expect(extended.video[1].in).toBe(0);
    expect(extended.video[1].duration).toBe(7);
    // Shrink is clamped by the minimum legal duration.
    const floor = trimBeatStart(e, 1, 99);
    expect(floor.video[1].duration).toBeCloseTo(0.1, 6);
  });
});
