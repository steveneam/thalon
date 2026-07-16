import { describe, expect, it } from "vitest";
import {
  assertVideoCutTransition,
  edlClipSchema,
  edlSchema,
  InvalidVideoCutTransitionError,
  panSchema,
  videoSourceRefSchema,
  videoTakeSchema,
} from "../video-project";

/** B-ve.1 (ADR 0010): the EDL + video-project validated shapes. */

describe("pan expressions (the tenant-data -> filtergraph injection guard)", () => {
  it("accepts static, linear, and whitelisted-expression pans", () => {
    expect(panSchema.parse(690)).toBe(690);
    expect(panSchema.parse({ from: 172, to: 388 })).toEqual({ from: 172, to: 388 });
    // The b9 full-width sweep, verbatim from the 9:16 recipe.
    expect(panSchema.parse({ expr: "min(875*t/4.5,875)" })).toEqual({
      expr: "min(875*t/4.5,875)",
    });
  });

  it("refuses anything that could escape the compiler's quoting", () => {
    for (const expr of [
      "min(1,2)'; drop", // quote
      "if(gte(t,1),0,9)", // non-whitelisted function
      "875[x]", // stream-label bracket
      "1;2", // filter separator
      "x='0'", // quotes + assignment
      "N", // frame-number variable — t only
    ]) {
      expect(panSchema.safeParse({ expr }).success, expr).toBe(false);
    }
  });
});

describe("source refs are project-relative only", () => {
  it("accepts the film tree's shapes and refuses traversal", () => {
    expect(
      videoSourceRefSchema.safeParse({ kind: "take", ref: "motion/keepers/clip-02.mp4" }).success,
    ).toBe(true);
    for (const ref of ["/abs/path.mp4", "../up.mp4", "a/../b.mp4", "a//b.mp4", "a\\b.mp4", ""]) {
      expect(videoSourceRefSchema.safeParse({ kind: "take", ref }).success, ref).toBe(false);
    }
  });
});

describe("clip timeline rules", () => {
  const base = {
    name: "endcard",
    source: { kind: "still" as const, ref: "stills/keepers/endcard.png" },
    duration: 50.775,
  };

  it("an overlay-fade clip must carry `at`; other clips must not", () => {
    expect(
      edlClipSchema.safeParse({
        ...base,
        transitionIn: { type: "overlay-fade", duration: 0.4 },
      }).success,
    ).toBe(false);
    expect(
      edlClipSchema.safeParse({
        ...base,
        at: 41.375,
        transitionIn: { type: "overlay-fade", duration: 0.4 },
      }).success,
    ).toBe(true);
    expect(
      edlClipSchema.safeParse({
        ...base,
        at: 41.375,
        transitionIn: { type: "xfade", duration: 0.4 },
      }).success,
    ).toBe(false);
    expect(edlClipSchema.safeParse({ ...base, at: 41.375 }).success).toBe(false);
  });
});

describe("EDL additivity + defaults", () => {
  it("a minimal EDL (no audio, no captions, no version field) parses — pre-window shapes stay valid as fields arrive", () => {
    const parsed = edlSchema.parse({
      name: "minimal",
      output: { width: 1280, height: 720, fps: 24, duration: 5 },
      video: [{ name: "b1", source: { kind: "take", ref: "clip.mp4" }, duration: 5 }],
    });
    expect(parsed.version).toBe(1);
    expect(parsed.audio).toEqual([]);
    expect(parsed.captions).toBeUndefined();
    expect(parsed.output.video).toEqual({
      codec: "libx264",
      crf: 18,
      preset: "slow",
      pixFmt: "yuv420p",
    });
    expect(parsed.video[0].in).toBe(0);
  });

  it("the music lane is static-gain only with an optional tail easing — level-flat by default (s44 lesson)", () => {
    const parsed = edlSchema.parse({
      name: "with-music",
      output: { width: 1280, height: 720, fps: 24, duration: 50.775 },
      video: [{ name: "b1", source: { kind: "cut", ref: "cuts/base.mp4" }, duration: 50.775 }],
      audio: [
        {
          source: { kind: "audio", ref: "audio/score.m4a" },
          offset: 105,
          fadeOut: { start: 49.5, duration: 1.275 },
        },
      ],
    });
    expect(parsed.audio[0].gainDb).toBe(0);
    expect(parsed.audio[0].mode).toBe("encode");
  });
});

describe("takes: rejects carry their reasons", () => {
  it("refuses a reject without a reason (the learning material)", () => {
    const reject = {
      slot: "beat-01",
      kind: "motion" as const,
      disposition: "reject" as const,
      ref: "motion/rejects/clip-01-t1.mp4",
    };
    expect(videoTakeSchema.safeParse(reject).success).toBe(false);
    expect(
      videoTakeSchema.safeParse({ ...reject, reason: "wing clips the frame" }).success,
    ).toBe(true);
    // Keepers need none.
    expect(
      videoTakeSchema.safeParse({ kind: "motion", ref: "motion/keepers/clip-01.mp4" }).success,
    ).toBe(true);
  });
});

describe("cut lifecycle rulebook", () => {
  it("draft -> rendered -> approved, nothing else; approved is terminal", () => {
    expect(() => assertVideoCutTransition("draft", "rendered")).not.toThrow();
    expect(() => assertVideoCutTransition("rendered", "approved")).not.toThrow();
    for (const [from, to] of [
      ["draft", "approved"],
      ["rendered", "draft"],
      ["rendered", "rendered"],
      ["approved", "draft"],
      ["approved", "rendered"],
    ] as const) {
      expect(() => assertVideoCutTransition(from, to)).toThrow(InvalidVideoCutTransitionError);
    }
  });
});
