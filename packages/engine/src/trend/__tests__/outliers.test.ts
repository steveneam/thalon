import { describe, expect, it } from "vitest";
import { detectOutliers, outlierConfigSchema } from "../outliers";
import type { TrendItem } from "../trend-source";

const CONFIG = outlierConfigSchema.parse({});
const NOW = 1_750_000_000_000;
const DAY = 24 * 3_600_000;

/** All items a day old so views/hour is views/24 — keeps expectations legible. */
function item(overrides: Partial<TrendItem> & Pick<TrendItem, "externalId" | "account">): TrendItem {
  return {
    text: `item ${overrides.externalId}`,
    publishedAt: NOW - DAY,
    metrics: {},
    ...overrides,
  };
}

describe("detectOutliers (B3.12 deterministic ratio math)", () => {
  it("fires the velocity rule against the account's sweep-peer median", () => {
    const items = [
      item({ externalId: "hot", account: "alpha", metrics: { views: 120_000 } }),
      item({ externalId: "p1", account: "alpha", metrics: { views: 1_000 } }),
      item({ externalId: "p2", account: "alpha", metrics: { views: 1_200 } }),
      item({ externalId: "p3", account: "alpha", metrics: { views: 1_400 } }),
    ];
    const scored = detectOutliers(items, CONFIG, NOW);
    const hot = scored.find((s) => s.item.externalId === "hot")!;
    expect(hot.velocity).toBeCloseTo(120_000 / 24);
    expect(hot.baselineVelocity).toBeCloseTo(1_200 / 24); // median of the three peers
    expect(hot.isOutlier).toBe(true);
    expect(hot.reasons).toEqual([expect.stringMatching(/velocity 5000 views\/h is ≥ 3×/)]);
    // The peers themselves are not outliers.
    for (const id of ["p1", "p2", "p3"]) {
      expect(scored.find((s) => s.item.externalId === id)!.isOutlier).toBe(false);
    }
  });

  it("never arms the velocity rule below minBaselinePeers", () => {
    const items = [
      item({ externalId: "solo", account: "beta", metrics: { views: 1_000_000 } }),
      item({ externalId: "one-peer", account: "beta", metrics: { views: 10 } }),
    ];
    const scored = detectOutliers(items, CONFIG, NOW);
    // One peer each — below the default minBaselinePeers of 2.
    expect(scored.find((s) => s.item.externalId === "solo")!.baselineVelocity).toBeNull();
    expect(scored.find((s) => s.item.externalId === "solo")!.isOutlier).toBe(false);
  });

  it("fires share-to-view and bookmark-efficiency independently, with metric names from config", () => {
    const config = outlierConfigSchema.parse({
      metricNames: { views: "impressions", shares: "reposts", bookmarks: "saves" },
    });
    const items = [
      item({
        externalId: "shared",
        account: "a",
        metrics: { impressions: 50_000, reposts: 900, saves: 10 },
      }),
      item({
        externalId: "saved",
        account: "b",
        metrics: { impressions: 50_000, reposts: 10, saves: 2_000 },
      }),
    ];
    const scored = detectOutliers(items, config, NOW);
    const shared = scored.find((s) => s.item.externalId === "shared")!;
    expect(shared.shareToView).toBeCloseTo(0.018);
    expect(shared.reasons).toEqual([expect.stringMatching(/reposts-to-impressions ratio 0.018 is ≥ 0.01/)]);
    const saved = scored.find((s) => s.item.externalId === "saved")!;
    expect(saved.bookmarkToView).toBeCloseTo(0.04);
    expect(saved.reasons).toEqual([expect.stringMatching(/saves-to-impressions ratio 0.04 is ≥ 0.02/)]);
  });

  it("keeps ratio rules disarmed below minViews — tiny denominators fabricate nothing", () => {
    const items = [
      item({ externalId: "tiny", account: "a", metrics: { views: 50, shares: 40, bookmarks: 40 } }),
    ];
    const scored = detectOutliers(items, CONFIG, NOW);
    expect(scored[0].shareToView).toBeNull();
    expect(scored[0].bookmarkToView).toBeNull();
    expect(scored[0].isOutlier).toBe(false);
  });

  it("treats missing metrics as disarmed rules, never as zeroes or crashes", () => {
    const items = [item({ externalId: "bare", account: "a", metrics: {} })];
    const scored = detectOutliers(items, CONFIG, NOW);
    expect(scored[0]).toMatchObject({
      velocity: null,
      baselineVelocity: null,
      shareToView: null,
      bookmarkToView: null,
      isOutlier: false,
    });
  });

  it("floors item age at minAgeHours so a just-published item cannot divide by epsilon", () => {
    const justPublished = item({
      externalId: "new",
      account: "a",
      publishedAt: NOW - 60_000, // one minute old
      metrics: { views: 6_000 },
    });
    const scored = detectOutliers([justPublished], CONFIG, NOW);
    expect(scored[0].velocity).toBeCloseTo(6_000); // views / 1h floor, not views / (1/60)h
  });

  it("is deterministic: identical input yields deeply identical output", () => {
    const items = [
      item({ externalId: "x", account: "a", metrics: { views: 90_000, shares: 2_000 } }),
      item({ externalId: "y", account: "a", metrics: { views: 1_000 } }),
      item({ externalId: "z", account: "a", metrics: { views: 1_100 } }),
    ];
    expect(detectOutliers(items, CONFIG, NOW)).toEqual(detectOutliers(items, CONFIG, NOW));
  });
});
