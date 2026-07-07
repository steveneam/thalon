import { describe, expect, it } from "vitest";
import {
  HOOK_MAX_VISUAL_GAP_MS,
  MAX_VISUAL_GAP_MS,
  assertPacingDensity,
  planAccentPulses,
  type MotionEvent,
} from "../composition-pacing";

const ev = (atMs: number): MotionEvent => ({ atMs, kind: "caption-word", cueIndex: 0 });

describe("planAccentPulses", () => {
  it("returns nothing when every gap is inside the limit", () => {
    const events = [ev(500), ev(2_500), ev(4_800)];
    expect(planAccentPulses(events, { durationMs: 6_000, hookEndMs: 2_000 })).toEqual([]);
  });

  it("closes an oversized gap with evenly spaced deterministic pulses", () => {
    // 500 → 8_500: an 8s hole needs ceil(8000/2500)-1 = 3 pulses at 2500-spacing.
    const pulses = planAccentPulses([ev(500), ev(8_500)], { durationMs: 9_000, hookEndMs: 400 });
    expect(pulses).toEqual([2_500, 4_500, 6_500]);
  });

  it("applies the tighter hook limit to gaps that end inside the hook window", () => {
    // A 2.2s opening gap is fine globally but not in the hook.
    const pulses = planAccentPulses([ev(2_200)], { durationMs: 3_000, hookEndMs: 2_500 });
    expect(pulses).toEqual([1_100]);
    expect(planAccentPulses([ev(2_200)], { durationMs: 3_000, hookEndMs: 1_000 })).toEqual([]);
  });

  it("anchors at 0 and the total duration — a dead tail gets filled too", () => {
    const pulses = planAccentPulses([ev(300)], { durationMs: 6_000, hookEndMs: 200 });
    expect(pulses.length).toBeGreaterThan(0);
    expect(Math.max(...pulses)).toBeGreaterThan(3_000);
  });
});

describe("assertPacingDensity", () => {
  it("passes a dense schedule and reports the max gap", () => {
    const schedule = assertPacingDensity([ev(1_000), ev(3_000), ev(5_000)], {
      durationMs: 6_000,
      hookEndMs: 900,
    });
    expect(schedule.maxGapMs).toBe(2_000);
    expect(schedule.events.map((e) => e.atMs)).toEqual([1_000, 3_000, 5_000]);
  });

  it("throws loudly on a stretch over the limit — a generator bug, never render spend", () => {
    expect(() =>
      assertPacingDensity([ev(500)], { durationMs: 500 + MAX_VISUAL_GAP_MS + 1, hookEndMs: 400 }),
    ).toThrow(/pacing-density violated/);
  });

  it("throws on a hook stretch over the hook limit", () => {
    expect(() =>
      assertPacingDensity([ev(HOOK_MAX_VISUAL_GAP_MS + 100), ev(HOOK_MAX_VISUAL_GAP_MS + 200)], {
        durationMs: HOOK_MAX_VISUAL_GAP_MS + 300,
        hookEndMs: HOOK_MAX_VISUAL_GAP_MS + 250,
      }),
    ).toThrow(/pacing-density violated/);
  });
});
