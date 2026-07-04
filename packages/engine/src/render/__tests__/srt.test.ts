import { describe, expect, it } from "vitest";
import { parseCaptions } from "../../ingest/captions";
import {
  DERIVED_MS_PER_CHAR,
  MAX_DERIVED_CUE_MS,
  MIN_DERIVED_CUE_MS,
  derivePillarTimeline,
  derivedCueDurationMs,
  formatSrtTimestamp,
  pillarScriptToSrt,
  renderSrt,
} from "../srt";

const SCRIPT = {
  hook: "What if your docs wrote their own demo?",
  beats: [
    { beatIndex: 0, narration: "Thalon reads your site and drafts the script." },
    {
      beatIndex: 1,
      narration: "Every claim is judged against your own sources before you ever see it.",
      onScreenText: "Grounded, always",
      durationHintMs: 4_200,
    },
    { beatIndex: 2, narration: "You approve. It ships." },
  ],
  cta: "Try the demo tenant today.",
};

describe("derivePillarTimeline (B3.10 deterministic caption core)", () => {
  it("is deterministic: identical meta yields byte-identical SRT", () => {
    expect(pillarScriptToSrt(SCRIPT)).toBe(pillarScriptToSrt(SCRIPT));
  });

  it("orders cues hook -> beats (by beatIndex, not array order) -> cta, contiguous from 0", () => {
    const shuffled = { ...SCRIPT, beats: [SCRIPT.beats[2], SCRIPT.beats[0], SCRIPT.beats[1]] };
    const timeline = derivePillarTimeline(shuffled);
    expect(timeline.cues.map((c) => c.kind)).toEqual(["hook", "beat", "beat", "beat", "cta"]);
    expect(timeline.cues.map((c) => c.beatIndex)).toEqual([null, 0, 1, 2, null]);
    expect(timeline.cues[0].startMs).toBe(0);
    for (let i = 1; i < timeline.cues.length; i++) {
      expect(timeline.cues[i].startMs).toBe(timeline.cues[i - 1].endMs);
    }
    expect(timeline.totalDurationMs).toBe(timeline.cues.at(-1)!.endMs);
  });

  it("trusts an authored durationHintMs verbatim and clamps only derived durations", () => {
    const timeline = derivePillarTimeline(SCRIPT);
    const hinted = timeline.cues.find((c) => c.beatIndex === 1)!;
    expect(hinted.endMs - hinted.startMs).toBe(4_200);
    expect(derivedCueDurationMs("hi")).toBe(MIN_DERIVED_CUE_MS);
    expect(derivedCueDurationMs("x".repeat(1_000))).toBe(MAX_DERIVED_CUE_MS);
    expect(derivedCueDurationMs("x".repeat(50))).toBe(50 * DERIVED_MS_PER_CHAR);
  });

  it("omits the cta cue when the script has none", () => {
    const timeline = derivePillarTimeline({ ...SCRIPT, cta: null });
    expect(timeline.cues.map((c) => c.kind)).toEqual(["hook", "beat", "beat", "beat"]);
  });

  it("normalises internal newlines/whitespace so no cue text can terminate its own SRT block", () => {
    const timeline = derivePillarTimeline({
      hook: "line one\n\n\nline two\t spaced",
      beats: [{ beatIndex: 0, narration: "ok" }],
      cta: null,
    });
    expect(timeline.cues[0].text).toBe("line one line two spaced");
    expect(renderSrt(timeline)).not.toMatch(/\n\n\n/);
  });

  it("formats strict SRT timestamps and rejects invalid input", () => {
    expect(formatSrtTimestamp(0)).toBe("00:00:00,000");
    expect(formatSrtTimestamp(3_600_000 + 61_005)).toBe("01:01:01,005");
    expect(() => formatSrtTimestamp(-1)).toThrow(/invalid SRT timestamp/);
    expect(() => formatSrtTimestamp(1.5)).toThrow(/invalid SRT timestamp/);
  });

  it("round-trips through the B2.2 caption-file ingest unchanged — the generated pillar IS waterfall-able", () => {
    const timeline = derivePillarTimeline(SCRIPT);
    const segments = parseCaptions(pillarScriptToSrt(SCRIPT), "srt");
    expect(segments).toEqual(
      timeline.cues.map((cue) => ({ text: cue.text, startMs: cue.startMs, endMs: cue.endMs })),
    );
  });
});
