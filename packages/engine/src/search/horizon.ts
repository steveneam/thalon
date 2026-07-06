import { z } from "zod";

/**
 * B6.8 "peering over the horizon" — the founder's GSC-based opportunity
 * intuition formalized as TESTED MATH in pure core, the ./../trend/outliers.ts
 * mold (ADR 0006 decision 1). Over a query's stored `search_snapshots`
 * history, three deterministic rules, each a reason string when it fires;
 * an OPPORTUNITY is all three firing together:
 *
 *  - position window: the latest position sits at `minPosition`–`maxPosition`
 *    (default 8–20) — close enough that page 1 is within reach;
 *  - rising impressions: demand is growing — the latest impressions are ≥
 *    `risingImpressionsFactor` × the earliest usable snapshot's (and ≥
 *    `minImpressions`, so tiny denominators can't fabricate growth);
 *  - below-expected CTR: the query earns less than `ctrShortfallFactor` ×
 *    the position-expected CTR (`expectedCtrBands`, config) — demand the
 *    tenant is being SHOWN for but not yet winning.
 *
 * Metric NAMES are config (SPINE §4.1 — GSC says clicks/impressions/ctr/
 * position; a future paid tool may not). A missing metric disarms its rule
 * for that series, never fabricates. No clock, no db, no driver in here:
 * callers read `search_snapshots` rows (see ./intake.ts `runHorizonScan`)
 * and map them to `SearchSnapshotPoint`s.
 */

export const horizonConfigSchema = z.object({
  metricNames: z
    .object({
      clicks: z.string().min(1),
      impressions: z.string().min(1),
      ctr: z.string().min(1),
      position: z.string().min(1),
    })
    .default({ clicks: "clicks", impressions: "impressions", ctr: "ctr", position: "position" }),
  /** The horizon window: closer than minPosition already ranks; beyond maxPosition isn't yet competitive. */
  minPosition: z.number().positive().default(8),
  maxPosition: z.number().positive().default(20),
  /** Rising = latest impressions ≥ this multiple of the earliest usable snapshot's. */
  risingImpressionsFactor: z.number().positive().default(1.2),
  /** The rising rule arms only at this many latest impressions — below it, growth ratios are noise. */
  minImpressions: z.number().nonnegative().default(10),
  /** Rising needs history: at least this many snapshots carrying the impressions metric. */
  minSnapshots: z.number().int().min(2).default(2),
  /**
   * Expected CTR by position as a step table (ascending `upToPosition`;
   * validated) — deliberately coarse defaults, per-tenant config refines.
   */
  expectedCtrBands: z
    .array(z.object({ upToPosition: z.number().positive(), ctr: z.number().positive() }))
    .min(1)
    .default([
      { upToPosition: 1, ctr: 0.3 },
      { upToPosition: 3, ctr: 0.12 },
      { upToPosition: 6, ctr: 0.05 },
      { upToPosition: 10, ctr: 0.03 },
      { upToPosition: 20, ctr: 0.015 },
    ])
    .refine(
      (bands) => bands.every((b, i) => i === 0 || bands[i - 1].upToPosition < b.upToPosition),
      { message: "expectedCtrBands must be strictly ascending by upToPosition" },
    ),
  /** Below-expected fires when actual CTR < this fraction of the band's expected CTR. */
  ctrShortfallFactor: z.number().positive().default(0.75),
});

export type HorizonConfigInput = z.input<typeof horizonConfigSchema>;
export type HorizonConfig = z.infer<typeof horizonConfigSchema>;

/** One stored snapshot, db-agnostic (map a `search_snapshots` row: capturedAt.getTime(), metrics). */
export interface SearchSnapshotPoint {
  query: string;
  /** Page/URL dimension; "" = the site-level aggregate (the storage convention). */
  page: string;
  capturedAtMs: number;
  metrics: Record<string, number>;
}

export interface HorizonScore {
  query: string;
  page: string;
  /** Snapshots in this series (all, usable or not). */
  snapshots: number;
  /** Latest snapshot's position; null when the metric is absent. */
  position: number | null;
  /** Latest ÷ earliest usable impressions; null with < minSnapshots usable points (Infinity = growth from zero). */
  impressionsGrowth: number | null;
  latestImpressions: number | null;
  /** Latest actual CTR — the ctr metric, else derived clicks/impressions; null when underivable. */
  ctr: number | null;
  /** The band-expected CTR at the latest position; null when position is absent or beyond the last band. */
  expectedCtr: number | null;
  /** One human-readable line per rule that fired — the operator sees WHY (never model vibes). */
  reasons: string[];
  /** All three rules fired: demand the tenant almost ranks for. */
  isOpportunity: boolean;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

function expectedCtrAt(position: number, config: HorizonConfig): number | null {
  for (const band of config.expectedCtrBands) {
    if (position <= band.upToPosition) return band.ctr;
  }
  return null;
}

/** Scores ONE query+page series (its snapshots, any order — sorted here). */
export function scoreHorizonSeries(
  points: readonly SearchSnapshotPoint[],
  config: HorizonConfig,
): HorizonScore {
  if (points.length === 0) {
    throw new Error("scoreHorizonSeries needs at least one snapshot point");
  }
  const names = config.metricNames;
  const sorted = [...points].sort((a, b) => a.capturedAtMs - b.capturedAtMs);
  const latest = sorted[sorted.length - 1];

  const position = latest.metrics[names.position] ?? null;

  const usableImpressions = sorted
    .map((p) => p.metrics[names.impressions])
    .filter((v): v is number => v !== undefined);
  const latestImpressions = usableImpressions.at(-1) ?? null;
  let impressionsGrowth: number | null = null;
  if (usableImpressions.length >= config.minSnapshots) {
    const earliest = usableImpressions[0];
    const newest = usableImpressions[usableImpressions.length - 1];
    impressionsGrowth = earliest > 0 ? newest / earliest : newest > 0 ? Infinity : null;
  }

  const clicks = latest.metrics[names.clicks];
  const ctrMetric = latest.metrics[names.ctr];
  // Derivation stays within the LATEST snapshot — never latest clicks over an older snapshot's impressions.
  const latestOwnImpressions = latest.metrics[names.impressions];
  const ctr =
    ctrMetric !== undefined
      ? ctrMetric
      : clicks !== undefined && latestOwnImpressions !== undefined && latestOwnImpressions > 0
        ? clicks / latestOwnImpressions
        : null;
  const expectedCtr = position !== null ? expectedCtrAt(position, config) : null;

  const reasons: string[] = [];
  if (position !== null && position >= config.minPosition && position <= config.maxPosition) {
    reasons.push(
      `position ${round2(position)} is inside the horizon window ${config.minPosition}–${config.maxPosition} — page 1 is within reach`,
    );
  }
  if (
    impressionsGrowth !== null &&
    latestImpressions !== null &&
    latestImpressions >= config.minImpressions &&
    impressionsGrowth >= config.risingImpressionsFactor
  ) {
    reasons.push(
      impressionsGrowth === Infinity
        ? `${names.impressions} rose from 0 to ${round2(latestImpressions)} across ${usableImpressions.length} snapshots`
        : `${names.impressions} grew ${round2(impressionsGrowth)}× to ${round2(latestImpressions)} across ${usableImpressions.length} snapshots (≥ ${config.risingImpressionsFactor}×)`,
    );
  }
  if (ctr !== null && expectedCtr !== null && ctr < config.ctrShortfallFactor * expectedCtr) {
    reasons.push(
      `${names.ctr} ${round4(ctr)} is below ${config.ctrShortfallFactor}× the expected ${round4(expectedCtr)} at position ${round2(position!)}`,
    );
  }

  return {
    query: latest.query,
    page: latest.page,
    snapshots: sorted.length,
    position,
    impressionsGrowth,
    latestImpressions,
    ctr,
    expectedCtr,
    reasons,
    isOpportunity: reasons.length === 3,
  };
}

/**
 * Groups a driver's stored history by (query, page) and scores every
 * series. Deterministic order: first appearance in the (capture-ordered)
 * input.
 */
export function detectHorizonOpportunities(
  points: readonly SearchSnapshotPoint[],
  configInput: HorizonConfigInput = {},
): HorizonScore[] {
  const config = horizonConfigSchema.parse(configInput);
  const series = new Map<string, SearchSnapshotPoint[]>();
  for (const point of points) {
    const key = JSON.stringify([point.query, point.page]);
    const bucket = series.get(key) ?? [];
    bucket.push(point);
    series.set(key, bucket);
  }
  return [...series.values()].map((bucket) => scoreHorizonSeries(bucket, config));
}
