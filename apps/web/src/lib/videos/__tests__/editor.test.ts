import { edlSchema } from "@thalon/contracts";
import { describe, expect, it } from "vitest";
import {
  auditionVolume,
  deleteBeat,
  deleteCaptionLine,
  insertBeat,
  insertCaptionLine,
  laneDuration,
  nextVersionFor,
  patchCaptionLine,
  patchMusic,
  reorderBeat,
  setOutputDuration,
  setOverlayAt,
  splitLane,
  swapBeatSource,
  swapCandidatesFor,
  trimBeat,
} from "../editor";
import type { TakeView } from "../types";

/** Three xfade beats + endcard overlay + captions + encoded music — the film shape in miniature. */
function fixture() {
  return edlSchema.parse({
    name: "mini",
    output: { width: 1280, height: 720, fps: 24, duration: 16 },
    video: [
      { name: "b1", source: { kind: "take", ref: "motion/keepers/beat-01.mp4" }, duration: 5 },
      {
        name: "b2",
        source: { kind: "take", ref: "motion/keepers/beat-02.mp4" },
        duration: 5,
        in: 1,
        transitionIn: { type: "xfade", duration: 0.5 },
      },
      {
        name: "b3",
        source: { kind: "take", ref: "motion/keepers/beat-03.mp4" },
        duration: 5,
        transitionIn: { type: "xfade", duration: 0.25 },
      },
      {
        name: "endcard",
        source: { kind: "still", ref: "stills/keepers/beat-04-endcard.png" },
        duration: 16,
        at: 13,
        transitionIn: { type: "overlay-fade", duration: 1.2 },
      },
    ],
    audio: [{ source: { kind: "audio", ref: "music/track.mp3" }, offset: 3, gainDb: -2 }],
    captions: {
      style: { pointsize: 44 },
      lines: [{ text: "line one", x: 640, y: 600, fadeIn: 1, fadeOut: 4 }],
    },
  });
}

describe("splitLane / laneDuration", () => {
  it("separates the xfade beats from the overlay tail", () => {
    const lane = splitLane(fixture());
    expect(lane.beats.map((b) => b.name)).toEqual(["b1", "b2", "b3"]);
    expect(lane.overlay?.name).toBe("endcard");
  });

  it("assembled duration = sum(durations) − xfade overlaps", () => {
    expect(laneDuration(fixture())).toBe(5 + 5 + 5 - 0.5 - 0.25);
  });
});

describe("reorderBeat (transitions are position-bound)", () => {
  it("moving a beat keeps the fade rhythm in place and the first position bare", () => {
    const out = reorderBeat(fixture(), 0, 2);
    const lane = splitLane(out);
    expect(lane.beats.map((b) => b.name)).toEqual(["b2", "b3", "b1"]);
    // Position 0 never carries a transition; positions keep their original fades.
    expect(lane.beats[0].transitionIn).toBeUndefined();
    expect(lane.beats[1].transitionIn?.duration).toBe(0.5);
    expect(lane.beats[2].transitionIn?.duration).toBe(0.25);
    // The lane stays schema-valid (the compiler's own contract).
    expect(() => edlSchema.parse(out)).not.toThrow();
  });

  it("the overlay tail never moves and out-of-range is a no-op", () => {
    const edl = fixture();
    expect(reorderBeat(edl, 0, 3)).toBe(edl); // index 3 is the overlay — outside the beat lane
    expect(reorderBeat(edl, 1, 1)).toBe(edl);
    expect(splitLane(reorderBeat(edl, 2, 0)).overlay?.name).toBe("endcard");
  });
});

describe("trimBeat / swapBeatSource / setOverlayAt", () => {
  it("trims in-point and duration with clamps", () => {
    const out = trimBeat(trimBeat(fixture(), 1, { in: -2 }), 1, { duration: 4.5 });
    const beat = splitLane(out).beats[1];
    expect(beat.in).toBe(0);
    expect(beat.duration).toBe(4.5);
  });

  it("swaps only the ref — the source kind is the clip's semantics", () => {
    const out = swapBeatSource(fixture(), 0, "motion/rejects/beat-01-t2.mp4");
    const beat = splitLane(out).beats[0];
    expect(beat.source).toEqual({ kind: "take", ref: "motion/rejects/beat-01-t2.mp4" });
  });

  it("moves the overlay freeze boundary", () => {
    expect(splitLane(setOverlayAt(fixture(), 12.2)).overlay?.at).toBe(12.2);
  });
});

describe("captions / music / output", () => {
  it("patches one caption line, leaving the style untouched", () => {
    const out = patchCaptionLine(fixture(), 0, { text: "edited", y: 620 });
    expect(out.captions?.lines[0]).toMatchObject({ text: "edited", x: 640, y: 620 });
    expect(out.captions?.style.pointsize).toBe(44);
  });

  it("patches music offset/gain and adds+removes tail easing", () => {
    const withFade = patchMusic(fixture(), { offset: 4.5, fadeOut: { start: 14, duration: 1.5 } });
    expect(withFade.audio[0]).toMatchObject({ offset: 4.5, fadeOut: { start: 14, duration: 1.5 } });
    const removed = patchMusic(withFade, { fadeOut: undefined });
    expect(removed.audio[0].fadeOut).toBeUndefined();
  });

  it("a copy-mode cue has no knobs — patch is a no-op by contract", () => {
    const copyEdl = edlSchema.parse({
      ...fixture(),
      audio: [{ source: { kind: "cut", ref: "cuts/master.mp4" }, mode: "copy" }],
    });
    expect(patchMusic(copyEdl, { offset: 9 })).toBe(copyEdl);
  });

  it("B-audio.1: the audition level is the cue's own gain, and a boost clamps honestly", () => {
    expect(auditionVolume(0)).toBe(1);
    expect(auditionVolume(-6)).toBeCloseTo(0.501, 3);
    expect(auditionVolume(-20)).toBeCloseTo(0.1, 3);
    // A player tops out at unity; the lane's copy says so rather than pretending.
    expect(auditionVolume(9)).toBe(1);
    expect(auditionVolume(Number.NaN)).toBe(1);
  });

  it("sets the output -t explicitly (never auto-synced)", () => {
    expect(setOutputDuration(fixture(), 15.5).output.duration).toBe(15.5);
    expect(setOutputDuration(fixture(), 0).output.duration).toBe(16);
  });
});

function take(overrides: Partial<TakeView>): TakeView {
  return {
    id: overrides.ref ?? "t",
    slot: "beat-01",
    kind: "motion",
    disposition: "keeper",
    ref: "motion/keepers/beat-01.mp4",
    reason: null,
    provenance: {},
    createdAt: "2026-07-16T00:00:00.000Z",
    ...overrides,
  };
}

/*
 * THE MISSING VERBS (s80). The lane could be reordered, trimmed and
 * source-swapped, but never CHANGED — of the 27 operator jobs the s78 walk
 * scored, "drop a beat / add one from the takes pool" and "add a caption line
 * or delete one the generator wrote" both had no affordance at all.
 */
describe("deleteBeat / insertBeat", () => {
  it("drops the named beat and leaves the overlay tail alone", () => {
    const next = deleteBeat(fixture(), 1);
    const lane = splitLane(next);
    expect(lane.beats.map((b) => b.name)).toEqual(["b1", "b3"]);
    expect(lane.overlay?.name).toBe("endcard");
    expect(() => edlSchema.parse(next)).not.toThrow();
  });

  it("never leaves position 0 carrying a transition", () => {
    // b1 out means b2 leads — and a lane whose first clip fades in from
    // nothing is not compiler-valid.
    const lane = splitLane(deleteBeat(fixture(), 0));
    expect(lane.beats[0].name).toBe("b2");
    expect(lane.beats[0].transitionIn).toBeUndefined();
  });

  it("refuses to empty the lane — a cut with no beats is broken, not shorter", () => {
    let edl = deleteBeat(fixture(), 0);
    edl = deleteBeat(edl, 0);
    expect(splitLane(edl).beats).toHaveLength(1);
    const last = deleteBeat(edl, 0);
    expect(splitLane(last).beats).toHaveLength(1);
    expect(last).toBe(edl);
  });

  it("inserts after the index, copying the neighbour's source KIND and duration", () => {
    const next = insertBeat(fixture(), 0, "motion/keepers/beat-09.mp4");
    const lane = splitLane(next);
    expect(lane.beats.map((b) => b.name)).toEqual(["b1", "b1-insert", "b2", "b3"]);
    expect(lane.beats[1].source).toEqual({ kind: "take", ref: "motion/keepers/beat-09.mp4" });
    expect(lane.beats[1].duration).toBe(5);
    expect(lane.beats[1].in).toBe(0);
    expect(() => edlSchema.parse(next)).not.toThrow();
  });
});

describe("insertCaptionLine / deleteCaptionLine", () => {
  it("adds a line after the index, inheriting the neighbour's placement", () => {
    const next = insertCaptionLine(fixture(), 0, "line two");
    const lines = next.captions?.lines ?? [];
    expect(lines.map((l) => l.text)).toEqual(["line one", "line two"]);
    // Placement is inherited so a new plate lands where the last one was.
    expect(lines[1].x).toBe(640);
    expect(lines[1].y).toBe(600);
    // It starts where the previous plate left, never overlapping it.
    expect(lines[1].fadeIn).toBe(4);
    expect(() => edlSchema.parse(next)).not.toThrow();
  });

  it("clamps a new plate's fade window to the cut's duration", () => {
    const edl = fixture();
    const long = patchCaptionLine(edl, 0, { fadeIn: 14, fadeOut: 16 });
    const lines = insertCaptionLine(long, 0, "tail").captions?.lines ?? [];
    expect(lines[1].fadeIn).toBeLessThanOrEqual(edl.output.duration);
    expect(lines[1].fadeOut).toBeLessThanOrEqual(edl.output.duration);
  });

  it("deletes a line, and emptying the caption lane is legal", () => {
    const next = deleteCaptionLine(fixture(), 0);
    expect(next.captions?.lines).toEqual([]);
    expect(() => edlSchema.parse(next)).not.toThrow();
  });

  it("ignores an out-of-range index rather than corrupting the lane", () => {
    const edl = fixture();
    expect(deleteCaptionLine(edl, 9)).toBe(edl);
    expect(deleteCaptionLine(edl, -1)).toBe(edl);
  });
});

describe("swapCandidatesFor", () => {
  const takes: TakeView[] = [
    take({ ref: "motion/keepers/beat-01.mp4" }),
    take({ ref: "motion/rejects/beat-01-t1.mp4", disposition: "reject", reason: "hand clips through" }),
    take({ ref: "motion/keepers/beat-01-alt.mp4" }),
    take({ ref: "motion/keepers/beat-02.mp4", slot: "beat-02" }),
    take({ ref: "stills/keepers/beat-01-still.png", kind: "still" }),
  ];

  it("scopes to the current ref's slot AND kind, keepers before rejects (reasons ride along)", () => {
    const out = swapCandidatesFor(takes, "motion/keepers/beat-01.mp4");
    expect(out.map((t) => t.ref)).toEqual([
      "motion/keepers/beat-01-alt.mp4",
      "motion/keepers/beat-01.mp4",
      "motion/rejects/beat-01-t1.mp4",
    ]);
    expect(out[2].reason).toBe("hand clips through");
  });

  it("a ref matching no slotted take gets no picker (cut layers, unregistered files)", () => {
    expect(swapCandidatesFor(takes, "cuts/rough-cut-v3.mp4")).toEqual([]);
  });
});

describe("nextVersionFor", () => {
  it("max version for the name +1; a fresh name starts at 1", () => {
    const cuts = [
      { name: "film-16x9", version: 6 },
      { name: "film-16x9", version: 2 },
      { name: "film-9x16", version: 1 },
    ];
    expect(nextVersionFor(cuts, "film-16x9")).toBe(7);
    expect(nextVersionFor(cuts, "brand-new")).toBe(1);
  });
});
