import { describe, expect, it } from "vitest";
import { outlierConfigSchema, type ScoredItem } from "../outliers";
import {
  cosineSimilarity,
  rankCandidates,
  rankerConfigSchema,
  resolveRankerWeights,
  type RankableArea,
} from "../ranker";
import type { TrendItem } from "../trend-source";

const NOW = 1_750_000_000_000;
const HOUR = 3_600_000;
const OUTLIER_CONFIG = outlierConfigSchema.parse({});

function item(externalId: string, publishedAt = NOW): TrendItem {
  return { externalId, text: `text ${externalId}`, account: "acct", publishedAt, metrics: {} };
}

function scored(
  externalId: string,
  over: Partial<Omit<ScoredItem, "item">> = {},
  publishedAt = NOW,
): ScoredItem {
  return {
    item: item(externalId, publishedAt),
    velocity: null,
    baselineVelocity: null,
    shareToView: null,
    bookmarkToView: null,
    reasons: [],
    isOutlier: false,
    ...over,
  };
}

function area(id: string, vector: number[], over: Partial<RankableArea> = {}): RankableArea {
  return { id, name: `area ${id}`, vector, ...over };
}

describe("cosineSimilarity", () => {
  it("computes plain cosine; a zero vector has no direction and scores 0", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    expect(cosineSimilarity([1, 0], [-1, 0])).toBe(-1);
    expect(cosineSimilarity([1, 0], [0, 0])).toBe(0);
  });

  it("throws on dimension mismatch or empty vectors — a silent 0 would hide a wiring bug", () => {
    expect(() => cosineSimilarity([1, 0], [1])).toThrow(/equal-dimension/);
    expect(() => cosineSimilarity([], [])).toThrow(/equal-dimension/);
  });
});

describe("resolveRankerWeights (tenant default ← area override)", () => {
  it("an UNSET override field keeps the tenant default — never the schema's all-1 default", () => {
    const tenant = { relevance: 2, engagement: 1, velocity: 1, freshness: 0 };
    expect(resolveRankerWeights(tenant, { freshness: 4 })).toEqual({
      relevance: 2, // untouched by the override
      engagement: 1,
      velocity: 1,
      freshness: 4, // explicitly overridden
    });
    expect(resolveRankerWeights(tenant)).toEqual(tenant);
  });

  it("zero is a legal override — 'turn this signal off' is config", () => {
    const tenant = rankerConfigSchema.parse({}).weights;
    expect(resolveRankerWeights(tenant, { relevance: 0 }).relevance).toBe(0);
  });
});

describe("rankCandidates (B6.4 EdgeRank-shaped deterministic score)", () => {
  it("relevance = (cosine + 1) / 2 against each area; disarmed signals never dilute the score", () => {
    // No metrics at all → only relevance + freshness are armed. Published at
    // NOW → freshness 1. Identical vector → relevance 1 → score (1+1)/2 = 1
    // under equal weights; engagement/velocity being unmeasurable must NOT
    // drag it toward 0.5.
    const ranked = rankCandidates(
      [{ scored: scored("x"), vector: [1, 0] }],
      [area("match", [1, 0]), area("orthogonal", [0, 1]), area("opposite", [-1, 0])],
      {},
      OUTLIER_CONFIG,
      NOW,
    );
    const byArea = Object.fromEntries(ranked.map((r) => [r.areaId, r]));
    expect(byArea.match.components).toEqual({
      relevance: 1,
      engagement: null,
      velocity: null,
      freshness: 1,
    });
    expect(byArea.match.score).toBe(1);
    expect(byArea.orthogonal.components.relevance).toBe(0.5);
    expect(byArea.orthogonal.score).toBe(0.75);
    expect(byArea.opposite.components.relevance).toBe(0);
    expect(byArea.opposite.score).toBe(0.5);
  });

  it("engagement saturates at 0.5 exactly on the config threshold and keeps rising past it", () => {
    const atThreshold = rankCandidates(
      [{ scored: scored("x", { shareToView: 0.01 }), vector: [1, 0] }],
      [area("a", [1, 0])],
      {},
      OUTLIER_CONFIG, // shareToViewThreshold 0.01
      NOW,
    )[0];
    expect(atThreshold.components.engagement).toBe(0.5);

    const tenTimes = rankCandidates(
      [{ scored: scored("x", { shareToView: 0.1 }), vector: [1, 0] }],
      [area("a", [1, 0])],
      {},
      OUTLIER_CONFIG,
      NOW,
    )[0];
    expect(tenTimes.components.engagement).toBeCloseTo(0.9091, 3); // 0.1/(0.1+0.01) — no cap cliff
  });

  it("velocity combines the single-sweep signal and the stored Δ-velocity signal, each armed independently", () => {
    // sweep: 90 views/h vs 3× baseline 10 → 90/(90+30) = 0.75
    // Δ:     30 views/h vs 3× stored baseline 30 → 30/(30+90) = 0.25
    const both = rankCandidates(
      [
        {
          scored: scored("x", { velocity: 90, baselineVelocity: 10 }),
          vector: [1, 0],
          longitudinal: {
            deltaVelocity: 30,
            baselineDeltaVelocity: 30,
            reasons: [],
            isOutlier: false,
          },
        },
      ],
      [area("a", [1, 0])],
      {},
      OUTLIER_CONFIG,
      NOW,
    )[0];
    expect(both.components.velocity).toBe(0.5); // mean(0.75, 0.25)
    const velocityReason = both.reasons.find((r) => r.startsWith("velocity"));
    expect(velocityReason).toContain("sweep 90");
    expect(velocityReason).toContain("Δ 30");
    expect(velocityReason).toContain("stored baseline 30");

    // A zero/negative stored baseline disarms the Δ signal; sweep alone remains.
    const sweepOnly = rankCandidates(
      [
        {
          scored: scored("x", { velocity: 90, baselineVelocity: 10 }),
          vector: [1, 0],
          longitudinal: {
            deltaVelocity: 30,
            baselineDeltaVelocity: 0,
            reasons: [],
            isOutlier: false,
          },
        },
      ],
      [area("a", [1, 0])],
      {},
      OUTLIER_CONFIG,
      NOW,
    )[0];
    expect(sweepOnly.components.velocity).toBe(0.75);

    // A negative Δ carries no signal (0), but stays armed — declining items sink.
    const declining = rankCandidates(
      [
        {
          scored: scored("x"),
          vector: [1, 0],
          longitudinal: {
            deltaVelocity: -5,
            baselineDeltaVelocity: 10,
            reasons: [],
            isOutlier: false,
          },
        },
      ],
      [area("a", [1, 0])],
      {},
      OUTLIER_CONFIG,
      NOW,
    )[0];
    expect(declining.components.velocity).toBe(0);
  });

  it("freshness decays by half-life from publish time (config, default 24h)", () => {
    const ranked = rankCandidates(
      [
        { scored: scored("now", {}, NOW), vector: [1, 0] },
        { scored: scored("day", {}, NOW - 24 * HOUR), vector: [1, 0] },
        { scored: scored("twodays", {}, NOW - 48 * HOUR), vector: [1, 0] },
      ],
      [area("a", [1, 0])],
      {},
      OUTLIER_CONFIG,
      NOW,
    );
    const byId = Object.fromEntries(ranked.map((r) => [r.item.externalId, r]));
    expect(byId.now.components.freshness).toBe(1);
    expect(byId.day.components.freshness).toBe(0.5);
    expect(byId.twodays.components.freshness).toBe(0.25);

    const longHalfLife = rankCandidates(
      [{ scored: scored("day", {}, NOW - 24 * HOUR), vector: [1, 0] }],
      [area("a", [1, 0])],
      { freshnessHalfLifeHours: 48 },
      OUTLIER_CONFIG,
      NOW,
    )[0];
    expect(longHalfLife.components.freshness).toBeCloseTo(0.7071, 3);
  });

  it("weights resolve tenant default ← area override, and the applied weights ride each row", () => {
    const ranked = rankCandidates(
      [{ scored: scored("x"), vector: [0, 1] }], // relevance 0.5 vs [1,0]... vs both areas below
      [
        area("plain", [1, 0]),
        area("muted", [1, 0], { weights: { relevance: 0 } }),
      ],
      { weights: { relevance: 3 } }, // tenant default
      OUTLIER_CONFIG,
      NOW,
    );
    const byArea = Object.fromEntries(ranked.map((r) => [r.areaId, r]));
    // armed: relevance 0.5 + freshness 1
    expect(byArea.plain.weights.relevance).toBe(3);
    expect(byArea.plain.score).toBe(round4((3 * 0.5 + 1 * 1) / 4)); // 0.625
    expect(byArea.muted.weights.relevance).toBe(0); // area override wins
    expect(byArea.muted.weights.freshness).toBe(1); // unset override keeps tenant default
    expect(byArea.muted.score).toBe(1); // freshness alone
  });

  it("all armed weights at zero yields score 0, never a division blow-up", () => {
    const ranked = rankCandidates(
      [{ scored: scored("x"), vector: [1, 0] }],
      [area("a", [1, 0], { weights: { relevance: 0, freshness: 0 } })],
      {},
      OUTLIER_CONFIG,
      NOW,
    );
    expect(ranked[0].score).toBe(0);
  });

  it("emits one reason line per ARMED signal, naming the area", () => {
    const bare = rankCandidates(
      [{ scored: scored("x"), vector: [1, 0] }],
      [area("a", [1, 0], { name: "AI video" })],
      {},
      OUTLIER_CONFIG,
      NOW,
    )[0];
    expect(bare.reasons).toHaveLength(2); // relevance + freshness only
    expect(bare.reasons[0]).toContain('to area "AI video"');

    const full = rankCandidates(
      [
        {
          scored: scored("x", { shareToView: 0.02, velocity: 90, baselineVelocity: 10 }),
          vector: [1, 0],
        },
      ],
      [area("a", [1, 0])],
      {},
      OUTLIER_CONFIG,
      NOW,
    )[0];
    expect(full.reasons).toHaveLength(4);
    expect(full.reasons.map((r) => r.split(" ")[0])).toEqual([
      "relevance",
      "engagement",
      "velocity",
      "freshness",
    ]);
  });

  it("sorts deterministically: score desc, then externalId asc, then areaId asc", () => {
    const ranked = rankCandidates(
      [
        { scored: scored("b"), vector: [1, 0] },
        { scored: scored("a"), vector: [1, 0] },
        { scored: scored("c"), vector: [0, 1] }, // lower relevance → lower score
      ],
      [area("z", [1, 0]), area("y", [1, 0])],
      {},
      OUTLIER_CONFIG,
      NOW,
    );
    expect(ranked.map((r) => [r.item.externalId, r.areaId])).toEqual([
      ["a", "y"],
      ["a", "z"],
      ["b", "y"],
      ["b", "z"],
      ["c", "y"],
      ["c", "z"],
    ]);
  });
});

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
