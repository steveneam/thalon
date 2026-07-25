import { describe, expect, it } from "vitest";
import { compactCount, freshnessStamp, suggestedExit } from "@/components/intel/launchpad";
import type { TrendCard } from "@/lib/intel/types";

function card(overrides: Partial<TrendCard>): TrendCard {
  return {
    id: "t-1",
    source: "bluesky",
    externalId: "x",
    text: "a trend",
    account: "someone.example",
    publishedAt: "2026-07-05T09:00:00.000Z",
    areaName: "area",
    score: 0.9,
    reasons: [],
    isOutlier: false,
    shareToView: null,
    bookmarkToView: null,
    metrics: {},
    ...overrides,
  };
}

describe("suggestedExit (the honest pre-pick — a default, never a gate)", () => {
  it("thread-shaped sources suggest Post", () => {
    const pick = suggestedExit(card({ source: "bluesky" }));
    expect(pick.family).toBe("post");
    expect(pick.reason).toMatch(/thread-shaped/);
  });

  it("video-native sources suggest Video", () => {
    const pick = suggestedExit(card({ source: "youtube" }));
    expect(pick.family).toBe("video");
    expect(pick.reason).toMatch(/video-native/);
  });
});

describe("compactCount", () => {
  it("rounds by magnitude the way the mock sheet's meta rows read", () => {
    expect(compactCount(512)).toBe("512");
    expect(compactCount(9_410)).toBe("9.4k");
    // The Intel sheet writes "24.6k views" and "12.1k" — one decimal survives
    // above 10k; a zero decimal still drops.
    expect(compactCount(24_631)).toBe("24.6k");
    expect(compactCount(12_100)).toBe("12.1k");
    expect(compactCount(28_000)).toBe("28k");
    expect(compactCount(1_200_000)).toBe("1.2M");
  });
});

describe("freshnessStamp (honest loss-framing — rising/hot only)", () => {
  const now = new Date("2026-07-06T04:00:00.000Z").getTime(); // 19h after publish

  it("stamps a rising card as catchable with its age", () => {
    expect(freshnessStamp(card({ score: 0.9 }), now)).toBe("rising 19h · catchable");
  });

  it("rolls to days past 24h", () => {
    const later = now + 36 * 3_600_000;
    expect(freshnessStamp(card({ score: 0.62 }), later)).toBe("rising 2d · catchable");
  });

  it("says nothing on cooler bands — no fake urgency", () => {
    expect(freshnessStamp(card({ score: 0.48 }), now)).toBeNull();
    expect(freshnessStamp(card({ score: 0.2 }), now)).toBeNull();
  });
});
