import { describe, expect, it } from "vitest";
import {
  assertVideoCutTransition,
  edlClipSchema,
  edlDiffSchema,
  edlSchema,
  InvalidVideoCutTransitionError,
  panSchema,
  videoCutAttributionSchema,
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
      mode: "encode",
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
    // B-ve.4 additive knobs default OFF — the pre-window cue above carries neither.
    expect(parsed.audio[0].fadeIn).toBeUndefined();
    expect(parsed.audio[0].bitrateKbps).toBeUndefined();
  });
});

describe("copy output mode (B-ve.4 half-window: the G-score mux made expressible)", () => {
  const scoredMux = {
    name: "scored-mux",
    output: { width: 1280, height: 720, fps: 24, duration: 50.775, video: { mode: "copy" } },
    video: [
      {
        name: "picture",
        source: { kind: "cut", ref: "cuts/cut-v6-endcard-graded.mp4" },
        duration: 50.775,
      },
    ],
    audio: [
      {
        source: { kind: "audio", ref: "music/emotional-cello_the-mountain.mp3" },
        offset: 105,
        fadeIn: { duration: 1.2 },
        fadeOut: { start: 49.5, duration: 1.275 },
        bitrateKbps: 192,
      },
    ],
  };

  it("accepts the scored-master shape: one untouched video-bearing clip + a measured music cue", () => {
    const parsed = edlSchema.parse(scoredMux);
    expect(parsed.output.video).toEqual({ mode: "copy" });
    expect(parsed.audio[0].fadeIn).toEqual({ duration: 1.2 });
    expect(parsed.audio[0].bitrateKbps).toBe(192);
  });

  it("the copy arm is not swallowed by the encode arm's defaults (union order pin)", () => {
    const parsed = edlSchema.parse(scoredMux);
    expect(parsed.output.video.mode).toBe("copy");
    expect("codec" in parsed.output.video).toBe(false);
  });

  it("refuses what a stream copy cannot do: multiple clips, picture ops, stills, captions", () => {
    const base = scoredMux;
    // two clips
    expect(
      edlSchema.safeParse({ ...base, video: [base.video[0], base.video[0]] }).success,
    ).toBe(false);
    // picture re-processing
    expect(
      edlSchema.safeParse({
        ...base,
        video: [{ ...base.video[0], grade: { saturation: 1.1 } }],
      }).success,
    ).toBe(false);
    expect(
      edlSchema.safeParse({ ...base, video: [{ ...base.video[0], in: 2 }] }).success,
    ).toBe(false);
    // a still cannot be stream-copied into a film
    expect(
      edlSchema.safeParse({
        ...base,
        video: [{ ...base.video[0], source: { kind: "still", ref: "stills/a.png" } }],
      }).success,
    ).toBe(false);
    // captions need an encode pass
    expect(
      edlSchema.safeParse({
        ...base,
        captions: {
          style: { pointsize: 40 },
          lines: [{ text: "hi", x: 640, y: 600, fadeIn: 1, fadeOut: 3 }],
        },
      }).success,
    ).toBe(false);
    // an empty caption block is harmless
    expect(
      edlSchema.safeParse({ ...base, captions: { style: { pointsize: 40 }, lines: [] } }).success,
    ).toBe(true);
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

describe("EDL diffs (B-ve.4: the AI-assist wire)", () => {
  it("accepts the measured ops, each carrying its why", () => {
    const parsed = edlDiffSchema.parse({
      summary: "align the crescendo and clear the caption off the falcon",
      ops: [
        { op: "caption-move", line: 1, x: 640, y: 614, why: "clears the wing at 12.3s" },
        {
          op: "music-align",
          cue: 0,
          offset: 105,
          fadeOut: { start: 49.5, duration: 1.275 },
          why: "hush lands on the gate-lift, slam on the wing-snap",
        },
      ],
    });
    expect(parsed.version).toBe(1);
    expect(parsed.ops).toHaveLength(2);
  });

  it("refuses an op without a rationale, an empty diff, and a knobless music-align", () => {
    expect(
      edlDiffSchema.safeParse({
        summary: "s",
        ops: [{ op: "caption-move", line: 0, x: 1, y: 2 }],
      }).success,
    ).toBe(false);
    expect(edlDiffSchema.safeParse({ summary: "s", ops: [] }).success).toBe(false);
    expect(
      edlDiffSchema.safeParse({
        summary: "s",
        ops: [{ op: "music-align", cue: 0, why: "turns nothing" }],
      }).success,
    ).toBe(false);
  });
});

describe("cut attribution (B-ve.4: replayable + attributed)", () => {
  it("an operator save needs no proposal; an agent save without one is refused", () => {
    expect(videoCutAttributionSchema.safeParse({ authoredBy: "operator" }).success).toBe(true);
    expect(videoCutAttributionSchema.safeParse({ authoredBy: "agent" }).success).toBe(false);
    expect(
      videoCutAttributionSchema.safeParse({
        authoredBy: "agent",
        proposal: {
          model: "claude-sonnet-5",
          promptName: "edl-diff-proposer",
          promptHash: "abc123",
          diff: {
            summary: "s",
            ops: [{ op: "caption-move", line: 0, x: 1, y: 2, why: "w" }],
          },
          decidedBy: "operator",
        },
      }).success,
    ).toBe(true);
  });
});
