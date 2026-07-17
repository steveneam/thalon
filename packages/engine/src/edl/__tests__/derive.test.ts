import { describe, expect, it } from "vitest";
import { edlSchema, type Edl, type EdlInput } from "@thalon/contracts";
import { compileEdl } from "../compile";
import { centeredCropFor, DeriveEdlError, deriveEdl } from "../derive";

/**
 * B-ve.5: deriveEdl is the own-engine recut as a pure transform — timeline
 * verbatim, framing swapped, seeds honest (largest centered window of the
 * MEASURED source; the operator's crop handles do the measuring from
 * there). Geometry cross-checked against the film family: 1280x720 takes,
 * 9:16 and 1:1 canvases.
 */

const NINE_SIXTEEN = { width: 1080, height: 1920 };
const ONE_ONE = { width: 1080, height: 1080 };

function parentEdl(): Edl {
  const input: EdlInput = {
    name: "film-16x9",
    output: { width: 1920, height: 1080, fps: 24, duration: 9.5 },
    video: [
      {
        name: "b1",
        source: { kind: "take", ref: "motion/keepers/beat-01.mp4" },
        duration: 5,
        grade: { brightness: 0.05, gamma: 1.2 },
        scale: { width: 1920, height: 1080, flags: "bicubic" },
      },
      {
        name: "b2",
        source: { kind: "take", ref: "motion/keepers/beat-02.mp4" },
        duration: 5,
        // A parent-aspect crop: replaced by the derived seed, never blended.
        crop: { width: 1706, height: 960, x: 12, y: 60 },
        transitionIn: { type: "xfade", duration: 0.5 },
      },
    ],
    audio: [{ source: { kind: "audio", ref: "music/track.mp3" }, offset: 3, gainDb: -2 }],
    captions: {
      style: { pointsize: 44 },
      lines: [{ text: "measured, not vibed", x: 960, y: 640, fadeIn: 1, fadeOut: 4 }],
    },
  };
  return edlSchema.parse(input);
}

const DIMS = {
  "motion/keepers/beat-01.mp4": { width: 1280, height: 720 },
  "motion/keepers/beat-02.mp4": { width: 1280, height: 720 },
};

describe("centeredCropFor", () => {
  it("windows a wide source for a vertical target: full height, centered, even-sized", () => {
    // 1280x720 at 9:16 — the film family's own geometry (hand recipe: 405-wide windows).
    expect(centeredCropFor({ width: 1280, height: 720 }, NINE_SIXTEEN)).toEqual({
      width: 404,
      height: 720,
      x: 438,
      y: 0,
    });
  });

  it("windows a wide source for a square target", () => {
    expect(centeredCropFor({ width: 1280, height: 720 }, ONE_ONE)).toEqual({
      width: 720,
      height: 720,
      x: 280,
      y: 0,
    });
  });

  it("windows a tall source for a squarer target: full width, vertically centered", () => {
    expect(centeredCropFor({ width: 1080, height: 1920 }, ONE_ONE)).toEqual({
      width: 1080,
      height: 1080,
      x: 0,
      y: 420,
    });
  });

  it("refuses degenerate sources", () => {
    expect(() => centeredCropFor({ width: 0, height: 720 }, ONE_ONE)).toThrow(DeriveEdlError);
  });
});

describe("deriveEdl", () => {
  it("keeps the timeline verbatim and swaps only the framing", () => {
    const parent = parentEdl();
    const derived = deriveEdl(parent, { name: "film-9x16", canvas: NINE_SIXTEEN, dims: DIMS });

    expect(derived.name).toBe("film-9x16");
    expect(derived.output).toEqual({ ...parent.output, width: 1080, height: 1920 });

    // Timeline untouched: order, in points, durations, transitions, grades, music.
    expect(derived.video.map((c) => c.name)).toEqual(["b1", "b2"]);
    expect(derived.video.map((c) => c.duration)).toEqual([5, 5]);
    expect(derived.video[1].transitionIn).toEqual({ type: "xfade", duration: 0.5 });
    expect(derived.video[0].grade).toEqual(parent.video[0].grade);
    expect(derived.audio).toEqual(parent.audio);

    // Framing seeded: centered measured window + scale to canvas; the
    // parent's own crop is REPLACED (it was composed for the parent aspect).
    expect(derived.video[0].crop).toEqual({ width: 404, height: 720, x: 438, y: 0 });
    expect(derived.video[1].crop).toEqual({ width: 404, height: 720, x: 438, y: 0 });
    expect(derived.video[0].scale).toEqual({ width: 1080, height: 1920, flags: "bicubic" });
    expect(derived.video[1].scale).toEqual({ width: 1080, height: 1920, flags: "lanczos" });

    // Captions: text/timing verbatim, centers proportionally re-seeded.
    expect(derived.captions?.lines[0]).toEqual({
      ...parent.captions!.lines[0],
      x: 540, // 960 * 1080/1920
      y: 1138, // round(640 * 1920/1080)
    });
  });

  it("the derived EDL is compiler-valid as produced", () => {
    const derived = deriveEdl(parentEdl(), { name: "film-1x1", canvas: ONE_ONE, dims: DIMS });
    expect(() => compileEdl(derived)).not.toThrow();
  });

  it("refuses a copy-mode parent — a stream copy has no per-beat picture to recompose", () => {
    const copyParent = edlSchema.parse({
      name: "scored-master",
      output: { width: 1920, height: 1080, fps: 24, duration: 50.79, video: { mode: "copy" } },
      video: [
        { name: "picture", source: { kind: "cut", ref: "cuts/master.mp4" }, duration: 50.79 },
      ],
    });
    expect(() =>
      deriveEdl(copyParent, { name: "x", canvas: NINE_SIXTEEN, dims: {} }),
    ).toThrow(/copy-mode cut has no per-beat picture/);
  });

  it("refuses when a source has no measured dimensions, naming the ref", () => {
    expect(() =>
      deriveEdl(parentEdl(), {
        name: "x",
        canvas: NINE_SIXTEEN,
        dims: { "motion/keepers/beat-01.mp4": { width: 1280, height: 720 } },
      }),
    ).toThrow(/motion\/keepers\/beat-02\.mp4.*measured, never estimated/);
  });
});
