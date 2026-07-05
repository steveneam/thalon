import { describe, expect, it } from "vitest";
import { detectLongitudinalOutlier, latestDeltaVelocity, longitudinalConfigSchema, type SnapshotPoint } from "../longitudinal";

const HOUR = 3_600_000;

function point(
  externalId: string,
  capturedAtMs: number,
  views: number | undefined,
  account = "acct",
): SnapshotPoint {
  return {
    externalId,
    account,
    capturedAtMs,
    metrics: views === undefined ? {} : { views },
  };
}

const CONFIG = longitudinalConfigSchema.parse({});

describe("latestDeltaVelocity (B4.3 pure math)", () => {
  it("computes views gained per hour between the last two snapshots, regardless of input order", () => {
    const points = [point("a", 2 * HOUR, 3_000), point("a", 0, 1_000), point("a", 1 * HOUR, 1_500)];
    // Last pair: 1h→2h, 1_500→3_000 = 1_500 views/h.
    expect(latestDeltaVelocity(points, CONFIG)).toBe(1_500);
  });

  it("floors the interval at minIntervalHours so a tight double-poll can't fabricate a spike", () => {
    const points = [point("a", 0, 1_000), point("a", 60_000, 2_000)]; // 1 minute apart
    expect(latestDeltaVelocity(points, CONFIG)).toBe(1_000); // floored to 1h
  });

  it("skips snapshots missing the views metric and disarms below two usable snapshots", () => {
    expect(latestDeltaVelocity([point("a", 0, 1_000)], CONFIG)).toBeNull();
    expect(latestDeltaVelocity([point("a", 0, undefined), point("a", HOUR, 2_000)], CONFIG)).toBeNull();
    expect(
      latestDeltaVelocity(
        [point("a", 0, 1_000), point("a", HOUR, undefined), point("a", 2 * HOUR, 2_000)],
        CONFIG,
      ),
    ).toBe(500); // 0h→2h usable pair, 1_000 gained over 2h
  });
});

describe("detectLongitudinalOutlier (B4.3 pure math)", () => {
  const accountHistory: SnapshotPoint[] = [
    // Two peers, each gaining 100 views/h — the stored baseline.
    point("p1", 0, 1_000),
    point("p1", HOUR, 1_100),
    point("p2", 0, 2_000),
    point("p2", HOUR, 2_100),
  ];

  it("fires when the item's Δ-velocity clears the multiple of the account's stored baseline", () => {
    const item = [point("hot", 0, 1_000), point("hot", HOUR, 1_400)]; // 400/h vs baseline 100/h
    const score = detectLongitudinalOutlier(item, [...accountHistory, ...item]);
    expect(score.deltaVelocity).toBe(400);
    expect(score.baselineDeltaVelocity).toBe(100);
    expect(score.isOutlier).toBe(true);
    expect(score.reasons[0]).toMatch(/Δ-velocity 400 views\/h .* ≥ 3× .* 100 views\/h/);
  });

  it("does not fire below the multiple", () => {
    const item = [point("warm", 0, 1_000), point("warm", HOUR, 1_250)]; // 250/h < 3×100
    const score = detectLongitudinalOutlier(item, [...accountHistory, ...item]);
    expect(score.isOutlier).toBe(false);
    expect(score.reasons).toEqual([]);
  });

  it("excludes the item's own rows from its baseline and arms only at minBaselinePeers", () => {
    const item = [point("solo", 0, 1_000), point("solo", HOUR, 2_000)];
    const onePeer = [point("p1", 0, 1_000), point("p1", HOUR, 1_100)];
    const score = detectLongitudinalOutlier(item, [...item, ...onePeer]); // 1 peer < default 2
    expect(score.deltaVelocity).toBe(1_000);
    expect(score.baselineDeltaVelocity).toBeNull();
    expect(score.isOutlier).toBe(false);
  });

  it("a missing views metric disarms the item entirely", () => {
    const item = [point("mute", 0, undefined), point("mute", HOUR, undefined)];
    const score = detectLongitudinalOutlier(item, accountHistory);
    expect(score.deltaVelocity).toBeNull();
    expect(score.isOutlier).toBe(false);
  });
});
