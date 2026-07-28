import { describe, expect, it } from "vitest";
import type { Edl } from "@thalon/contracts";
import { compareEdls } from "../compare";

/**
 * A1 — compare two versions. Deterministic by construction: every case below
 * is two EDLs in and a fixed list of changes out, with no model anywhere near
 * it. The cases that matter most are the ones a naive index-wise diff gets
 * wrong (an insertion, a reworded caption), because those are exactly the
 * edits an operator makes between two versions.
 */

const BASE: Edl = {
  version: 1,
  name: "film-16x9",
  output: {
    width: 1280,
    height: 720,
    fps: 24,
    duration: 12,
    video: { mode: "encode", codec: "libx264", crf: 18, preset: "medium", pixFmt: "yuv420p" },
  },
  video: [
    { name: "beat-01", source: { kind: "take", ref: "motion/keepers/beat-01.mp4" }, in: 0, duration: 6 },
    { name: "beat-02", source: { kind: "take", ref: "motion/keepers/beat-02.mp4" }, in: 0, duration: 6 },
  ],
  audio: [
    { mode: "encode", source: { kind: "audio", ref: "music/bed.mp3" }, offset: 3, gainDb: -6 },
  ],
  captions: {
    style: { font: "FreeSerif-Italic", pointsize: 42, kerning: 2, fill: "#eaaa40", glowFill: "#eaaa40" },
    lines: [
      { text: "one prompt", x: 100, y: 600, fadeIn: 1, fadeOut: 3, ramp: 0.4 },
      { text: "a full cut", x: 100, y: 600, fadeIn: 5, fadeOut: 8, ramp: 0.4 },
    ],
  },
};

function ops(comparison: { rows: { op: string }[] }): string[] {
  return comparison.rows.map((r) => r.op);
}

describe("compareEdls — the beat lane", () => {
  it("says two versions are the same rather than showing an empty panel", () => {
    const same = compareEdls(BASE, structuredClone(BASE));
    expect(same.identical).toBe(true);
    expect(same.rows).toEqual([]);
  });

  it("names a trim with both durations and the in-point", () => {
    const after = structuredClone(BASE);
    after.video[0] = { ...after.video[0], in: 1.5, duration: 3 };
    const { rows } = compareEdls(BASE, after);
    expect(rows).toHaveLength(1);
    expect(rows[0].op).toBe("beat-trimmed");
    expect(rows[0].what).toBe("beat-01 6s → 3s, in-point 0s → 1.5s");
  });

  it("reports ONE addition for an inserted beat — the beats after it did not move", () => {
    /*
     * The whole reason the match runs through a longest-common-subsequence:
     * an index-wise compare calls every beat after an insertion "reordered",
     * which is true of its index and false of the edit.
     */
    const after = structuredClone(BASE);
    after.video.splice(1, 0, {
      name: "beat-01b",
      source: { kind: "take", ref: "motion/keepers/beat-01b.mp4" },
      in: 0,
      duration: 4,
    });
    const { rows } = compareEdls(BASE, after);
    expect(ops({ rows })).toEqual(["beat-added"]);
    expect(rows[0].what).toBe("beat-01b added at #2 — 4s of beat-01b.mp4");
  });

  it("reports a removal with what the dropped beat was", () => {
    const after = structuredClone(BASE);
    after.video = [after.video[0]];
    const { rows } = compareEdls(BASE, after);
    expect(ops({ rows })).toEqual(["beat-removed"]);
    expect(rows[0].what).toContain("beat-02 dropped from #2");
  });

  it("calls a reorder a move, from one position to the other", () => {
    // A swap is symmetric — either beat can be described as the one that
    // moved — so the panel names ONE of them rather than both, and which one
    // is deterministic (the other is the run the order-preserving match kept).
    const after = structuredClone(BASE);
    after.video = [BASE.video[1], BASE.video[0]];
    const { rows } = compareEdls(BASE, after);
    expect(ops({ rows })).toEqual(["beat-moved"]);
    expect(rows[0].what).toBe("beat-01 moved from #1 to #2");
  });

  it("names only the beat that actually moved when a beat is lifted over two others", () => {
    const three = structuredClone(BASE);
    three.video.push({
      name: "beat-03",
      source: { kind: "take", ref: "motion/keepers/beat-03.mp4" },
      in: 0,
      duration: 6,
    });
    const after = structuredClone(three);
    after.video = [three.video[2], three.video[0], three.video[1]];
    const { rows } = compareEdls(three, after);
    expect(ops({ rows })).toEqual(["beat-moved"]);
    expect(rows[0].what).toBe("beat-03 moved from #3 to #1");
  });

  it("names a take swap by file, both sides", () => {
    const after = structuredClone(BASE);
    after.video[0] = {
      ...after.video[0],
      source: { kind: "take", ref: "motion/rejects/beat-01-t2.mp4" },
    };
    const { rows } = compareEdls(BASE, after);
    expect(ops({ rows })).toEqual(["beat-source"]);
    expect(rows[0].what).toBe("beat-01 now rides beat-01-t2.mp4 (was beat-01.mp4)");
  });

  it("catches a reframe, and says which knob moved", () => {
    const after = structuredClone(BASE);
    after.video[0] = { ...after.video[0], crop: { x: 40, y: 0, width: 600, height: 720 } };
    const { rows } = compareEdls(BASE, after);
    expect(ops({ rows })).toEqual(["beat-reframed"]);
    expect(rows[0].what).toBe("beat-01 crop changed");
  });

  it("catches a transition appearing between two beats", () => {
    const after = structuredClone(BASE);
    after.video[1] = { ...after.video[1], transitionIn: { type: "xfade", duration: 0.5 } };
    const { rows } = compareEdls(BASE, after);
    expect(ops({ rows })).toEqual(["beat-transition"]);
    expect(rows[0].what).toBe("beat-02 enters on xfade 0.5s (was cut)");
  });

  it("compares the endcard on its own terms, never against the beats around it", () => {
    const withEndcard = structuredClone(BASE);
    withEndcard.video.push({
      name: "endcard",
      source: { kind: "still", ref: "stills/endcard.png" },
      in: 0,
      duration: 12,
      at: 10,
      transitionIn: { type: "overlay-fade", duration: 1 },
    });
    const added = compareEdls(BASE, withEndcard);
    expect(ops(added)).toEqual(["endcard-added"]);

    const moved = structuredClone(withEndcard);
    moved.video[2] = { ...moved.video[2], at: 9 };
    const { rows } = compareEdls(withEndcard, moved);
    expect(ops({ rows })).toEqual(["endcard-freeze"]);
    expect(rows[0].what).toBe("the endcard freezes the film at 10s → 9s");
  });
});

describe("compareEdls — captions", () => {
  it("calls a reworded line a text change, not a delete plus an add", () => {
    const after = structuredClone(BASE);
    after.captions!.lines[1] = { ...after.captions!.lines[1], text: "a whole cut" };
    const { rows } = compareEdls(BASE, after);
    expect(ops({ rows })).toEqual(["caption-text"]);
    expect(rows[0].what).toBe("line 2: “a full cut” → “a whole cut”");
  });

  it("reports an inserted line as one addition, leaving the untouched lines alone", () => {
    const after = structuredClone(BASE);
    after.captions!.lines.splice(1, 0, {
      text: "one take",
      x: 100,
      y: 600,
      fadeIn: 3.2,
      fadeOut: 4.8,
      ramp: 0.4,
    });
    const { rows } = compareEdls(BASE, after);
    expect(ops({ rows })).toEqual(["caption-added"]);
    expect(rows[0].what).toBe("line 2 added: “one take” at 3.2s–4.8s");
  });

  it("states a re-timed plate and a moved plate separately", () => {
    const after = structuredClone(BASE);
    after.captions!.lines[0] = { ...after.captions!.lines[0], fadeOut: 4, x: 300, y: 500 };
    const { rows } = compareEdls(BASE, after);
    expect(ops({ rows })).toEqual(["caption-timing", "caption-move"]);
    expect(rows[0].what).toContain("now holds 1s–4s (was 1s–3s)");
    expect(rows[1].what).toContain("moved to 300,500 (was 100,600)");
  });

  it("says a line was removed, and a cut that lost its whole caption lane", () => {
    const after = structuredClone(BASE);
    after.captions!.lines = [];
    const { rows } = compareEdls(BASE, after);
    expect(ops({ rows })).toEqual(["caption-removed", "caption-removed"]);

    // The lane gone entirely is the same two facts — and NOT a restyle: a cut
    // that lost its captions did not change their typography.
    const gone = structuredClone(BASE);
    delete gone.captions;
    expect(ops(compareEdls(BASE, gone))).toEqual(["caption-removed", "caption-removed"]);
  });

  it("notes a restyled plate only while there are plates on both sides", () => {
    const after = structuredClone(BASE);
    after.captions!.style = { ...after.captions!.style, pointsize: 54 };
    expect(ops(compareEdls(BASE, after))).toEqual(["caption-style"]);
  });
});

describe("compareEdls — music and the frame", () => {
  it("says a silent cut acquired a bed", () => {
    const silent = { ...structuredClone(BASE), audio: [] };
    const { rows } = compareEdls(silent, BASE);
    expect(ops({ rows })).toEqual(["music-added"]);
    expect(rows[0].what).toBe("bed.mp3 scores the cut (from 3s in, -6 dB)");
  });

  it("separates a bed SWAP from the knobs on it", () => {
    const after = structuredClone(BASE);
    after.audio[0] = {
      ...after.audio[0],
      source: { kind: "audio", ref: "music/music-candidates/bed-07.mp3" },
      offset: 0,
      gainDb: -3,
    };
    const { rows } = compareEdls(BASE, after);
    expect(ops({ rows })).toEqual(["music-source", "music-align", "music-gain"]);
    expect(rows[0].what).toBe("bed swapped to bed-07.mp3 (was bed.mp3)");
    expect(rows[2].what).toBe("bed level -6 dB → -3 dB");
  });

  it("states the tail easing on both sides — the knob a silent diff would hide", () => {
    const after = structuredClone(BASE);
    after.audio[0] = { ...after.audio[0], fadeOut: { start: 9, duration: 3 } };
    const { rows } = compareEdls(BASE, after);
    expect(ops({ rows })).toEqual(["music-easing"]);
    expect(rows[0].what).toBe("no easing → tail ease from 9s over 3s");
  });

  it("reads a 9:16 recut as a frame change plus whatever the recut did to the lane", () => {
    const recut = structuredClone(BASE);
    recut.output = { ...recut.output, width: 1080, height: 1920, duration: 10 };
    recut.video[0] = { ...recut.video[0], duration: 4 };
    const { rows } = compareEdls(BASE, recut);
    expect(ops({ rows })).toEqual(["beat-trimmed", "output", "output"]);
    expect(rows[1].what).toBe("runtime 12s → 10s");
    expect(rows[2].what).toBe("frame 1280×720 → 1080×1920");
  });
});
