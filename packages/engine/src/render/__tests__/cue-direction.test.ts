import { stableStringify } from "@thalon/db";
import { describe, expect, it } from "vitest";
import { applyCueDirection } from "../cue-direction";
import { derivePillarTimeline } from "../srt";

const META = {
  hook: "Know what's rising before you post.",
  beats: [
    { beatIndex: 0, narration: "Thalon watches the topic areas you describe." },
    { beatIndex: 1, narration: "Every rising item carries a reason.", onScreenText: "Reasons" },
  ],
  cta: "This demo was rendered by Thalon.",
};

describe("applyCueDirection", () => {
  it("decorates by kind and beatIndex, leaving timing and text untouched", () => {
    const timeline = derivePillarTimeline(META);
    const decorated = applyCueDirection(timeline, {
      hook: { motion: "snappy" },
      beats: { 1: { motion: "bouncy", transition: "flash", sfx: "whoosh" } },
      cta: { transition: "dissolve" },
    });
    expect(decorated.cues[0].motion).toBe("snappy");
    expect(decorated.cues[0].transition).toBeUndefined();
    expect(decorated.cues[1].motion).toBeUndefined();
    expect(decorated.cues[2]).toMatchObject({ motion: "bouncy", transition: "flash", sfx: "whoosh" });
    expect(decorated.cues[3].transition).toBe("dissolve");
    expect(decorated.cues.map((c) => ({ s: c.startMs, e: c.endMs, t: c.text }))).toEqual(
      timeline.cues.map((c) => ({ s: c.startMs, e: c.endMs, t: c.text })),
    );
  });

  it("an EMPTY decoration is byte-identical under stableStringify — the pinned-manifest-hash safety property", () => {
    const timeline = derivePillarTimeline(META);
    const decorated = applyCueDirection(timeline, {});
    expect(stableStringify(decorated)).toBe(stableStringify(timeline));
    // And a directive with no fields set adds nothing either.
    const noop = applyCueDirection(timeline, { beats: { 0: {} } });
    expect(stableStringify(noop)).toBe(stableStringify(timeline));
  });
});
