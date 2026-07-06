import { describe, expect, it } from "vitest";
import {
  detectHorizonOpportunities,
  horizonConfigSchema,
  scoreHorizonSeries,
  type SearchSnapshotPoint,
} from "../horizon";

const T0 = 1_750_000_000_000;
const DAY = 24 * 3_600_000;

function point(
  query: string,
  day: number,
  metrics: Record<string, number>,
  page = "",
): SearchSnapshotPoint {
  return { query, page, capturedAtMs: T0 + day * DAY, metrics };
}

/** position 9, impressions 100→180 (1.8×), ctr 0.005 ≪ 0.75 × 0.03 — the canonical horizon hit. */
const HOT: SearchSnapshotPoint[] = [
  point("what is content automation", 0, { clicks: 0, impressions: 100, ctr: 0, position: 11 }),
  point("what is content automation", 7, { clicks: 1, impressions: 180, ctr: 0.005, position: 9 }),
];

describe("scoreHorizonSeries (B6.8 — tested core math, never model vibes)", () => {
  const config = horizonConfigSchema.parse({});

  it("flags position 8–20 × rising impressions × below-expected CTR, with a reason per rule", () => {
    const score = scoreHorizonSeries(HOT, config);
    expect(score.isOpportunity).toBe(true);
    expect(score.position).toBe(9);
    expect(score.impressionsGrowth).toBeCloseTo(1.8);
    expect(score.ctr).toBe(0.005);
    expect(score.expectedCtr).toBe(0.03);
    expect(score.reasons).toHaveLength(3);
    expect(score.reasons[0]).toMatch(/position 9 is inside the horizon window 8–20/);
    expect(score.reasons[1]).toMatch(/impressions grew 1\.8× to 180 across 2 snapshots/);
    expect(score.reasons[2]).toMatch(/ctr 0\.005 is below 0\.75× the expected 0\.03 at position 9/);
  });

  it("input order is irrelevant — snapshots are sorted by capture time", () => {
    expect(scoreHorizonSeries([...HOT].reverse(), config)).toEqual(
      scoreHorizonSeries(HOT, config),
    );
  });

  it("a query already ranking (position < 8) is not an opportunity", () => {
    const score = scoreHorizonSeries(
      [HOT[0], point("what is content automation", 7, { ...HOT[1].metrics, position: 3 })],
      config,
    );
    expect(score.isOpportunity).toBe(false);
    expect(score.reasons.some((r) => r.includes("horizon window"))).toBe(false);
  });

  it("flat impressions never fire the rising rule", () => {
    const score = scoreHorizonSeries(
      [
        point("q", 0, { impressions: 100, ctr: 0.001, position: 9 }),
        point("q", 7, { impressions: 105, ctr: 0.001, position: 9 }),
      ],
      config,
    );
    expect(score.impressionsGrowth).toBeCloseTo(1.05);
    expect(score.isOpportunity).toBe(false);
    expect(score.reasons.some((r) => r.includes("grew"))).toBe(false);
  });

  it("tiny impressions can't fabricate growth — the rising rule arms at minImpressions", () => {
    const score = scoreHorizonSeries(
      [
        point("q", 0, { impressions: 1, ctr: 0, position: 9 }),
        point("q", 7, { impressions: 4, ctr: 0, position: 9 }),
      ],
      config,
    );
    expect(score.impressionsGrowth).toBe(4);
    expect(score.reasons.some((r) => r.includes("grew"))).toBe(false);
  });

  it("growth from zero is honest (reported as from-0, fires only at minImpressions)", () => {
    const score = scoreHorizonSeries(
      [
        point("q", 0, { impressions: 0, ctr: 0, position: 9 }),
        point("q", 7, { impressions: 40, clicks: 0, position: 9 }),
      ],
      config,
    );
    expect(score.impressionsGrowth).toBe(Infinity);
    expect(score.reasons.some((r) => r.includes("rose from 0 to 40"))).toBe(true);
  });

  it("a single snapshot disarms the rising rule — no history, no growth claim", () => {
    const score = scoreHorizonSeries([HOT[1]], config);
    expect(score.impressionsGrowth).toBeNull();
    expect(score.isOpportunity).toBe(false);
  });

  it("a healthy CTR at position is left alone", () => {
    const score = scoreHorizonSeries(
      [HOT[0], point("what is content automation", 7, { impressions: 180, ctr: 0.05, position: 9 })],
      config,
    );
    expect(score.reasons.some((r) => r.includes("below"))).toBe(false);
    expect(score.isOpportunity).toBe(false);
  });

  it("derives CTR from the latest snapshot's own clicks/impressions when the ctr metric is absent", () => {
    const score = scoreHorizonSeries(
      [HOT[0], point("q", 7, { clicks: 1, impressions: 200, position: 9 })],
      config,
    );
    expect(score.ctr).toBe(0.005);
  });

  it("a missing metric disarms its rule, never fabricates (no position → no window, no expected CTR)", () => {
    const score = scoreHorizonSeries(
      [
        point("q", 0, { impressions: 100, ctr: 0.001 }),
        point("q", 7, { impressions: 200, ctr: 0.001 }),
      ],
      config,
    );
    expect(score.position).toBeNull();
    expect(score.expectedCtr).toBeNull();
    expect(score.reasons).toHaveLength(1); // only the rising rule can fire
    expect(score.isOpportunity).toBe(false);
  });

  it("metric names are config — a vendor's naming arrives as data", () => {
    const score = scoreHorizonSeries(
      [
        point("q", 0, { imp: 100, pos: 9, clk: 0 }),
        point("q", 7, { imp: 180, pos: 9, clk: 1 }),
      ],
      horizonConfigSchema.parse({
        metricNames: { clicks: "clk", impressions: "imp", ctr: "rate", position: "pos" },
      }),
    );
    expect(score.isOpportunity).toBe(true);
    expect(score.ctr).toBeCloseTo(1 / 180);
  });
});

describe("detectHorizonOpportunities (grouping over a stored history)", () => {
  it("groups by (query, page) and scores each series — the site aggregate and a page series stay distinct", () => {
    const scores = detectHorizonOpportunities([
      ...HOT,
      point("what is content automation", 0, { impressions: 60, ctr: 0.02, position: 9 }, "https://site.test/a"),
      point("what is content automation", 7, { impressions: 66, ctr: 0.02, position: 9 }, "https://site.test/a"),
      point("steady query", 0, { impressions: 500, ctr: 0.1, position: 2 }),
    ]);
    expect(scores).toHaveLength(3);
    expect(scores.filter((s) => s.isOpportunity).map((s) => [s.query, s.page])).toEqual([
      ["what is content automation", ""],
    ]);
  });

  it("rejects a non-ascending expectedCtrBands config loudly", () => {
    expect(() =>
      detectHorizonOpportunities(HOT, {
        expectedCtrBands: [
          { upToPosition: 10, ctr: 0.03 },
          { upToPosition: 5, ctr: 0.05 },
        ],
      }),
    ).toThrow(/strictly ascending/);
  });
});
