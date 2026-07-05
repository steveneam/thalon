import { z } from "zod";

/**
 * B4.3 longitudinal outlier math — Δ-velocity between an item's SUCCESSIVE
 * stored snapshots vs the account's stored baseline (CHARTER B4.3; the
 * cross-sweep half of ./outliers.ts's single-sweep ratios). Pure tested
 * math, never model vibes: callers read `trend_snapshots` history rows
 * (db repos) and map them to `SnapshotPoint`s; nothing here touches a
 * clock, a db, or a driver. Wiring this rule into live intake sweeps is
 * pass-3 work — pass 2 stores the history and proves the math.
 *
 * Conventions mirror ./outliers.ts exactly: metric NAMES are config; a
 * missing metric disarms its rule for that item; intervals floor at
 * `minIntervalHours` so a tight double-poll can't divide by epsilon; the
 * account baseline only arms with `minBaselinePeers` OTHER items that have
 * measurable history.
 */

export const longitudinalConfigSchema = z.object({
  /** Platform-native name of the views-like counter (data, never hard-coded). */
  viewsMetric: z.string().min(1).default("views"),
  /** Fires when the item's latest Δ-velocity ≥ this multiple of the account baseline. */
  velocityMultiple: z.number().positive().default(3),
  /** Snapshot intervals floor here — a tight double-poll can't fabricate a spike. */
  minIntervalHours: z.number().positive().default(1),
  /** The baseline arms only with at least this many OTHER items carrying a measurable Δ. */
  minBaselinePeers: z.number().int().positive().default(2),
});

export type LongitudinalConfigInput = z.input<typeof longitudinalConfigSchema>;
export type LongitudinalConfig = z.infer<typeof longitudinalConfigSchema>;

/** One stored snapshot, db-agnostic (map a `trend_snapshots` row: capturedAt.getTime(), metrics). */
export interface SnapshotPoint {
  externalId: string;
  account: string;
  capturedAtMs: number;
  metrics: Record<string, number>;
}

export interface LongitudinalScore {
  /** The item's LATEST between-snapshots velocity (views gained / hours elapsed); null with <2 usable snapshots. */
  deltaVelocity: number | null;
  /** Median of the account's OTHER items' latest Δ-velocities; null below minBaselinePeers. */
  baselineDeltaVelocity: number | null;
  /** One human-readable line per rule that fired — the operator sees WHY. */
  reasons: string[];
  isOutlier: boolean;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Views gained per hour between an item's last two usable snapshots, in
 * capture order (input order is irrelevant — sorted here). A snapshot
 * missing the views metric is unusable and simply skipped; fewer than two
 * usable snapshots disarms the item (null).
 */
export function latestDeltaVelocity(
  points: readonly SnapshotPoint[],
  config: LongitudinalConfig,
): number | null {
  const usable = points
    .filter((p) => p.metrics[config.viewsMetric] !== undefined)
    .sort((a, b) => a.capturedAtMs - b.capturedAtMs);
  if (usable.length < 2) return null;
  const prev = usable[usable.length - 2];
  const last = usable[usable.length - 1];
  const hours = Math.max(
    (last.capturedAtMs - prev.capturedAtMs) / 3_600_000,
    config.minIntervalHours,
  );
  return (last.metrics[config.viewsMetric] - prev.metrics[config.viewsMetric]) / hours;
}

/**
 * Scores one item's stored history against its account's stored history
 * (`accountPoints` may include the item's own rows — they're excluded from
 * the baseline). Fires when the item's latest Δ-velocity ≥
 * `velocityMultiple` × the median of the other items' latest Δ-velocities.
 */
export function detectLongitudinalOutlier(
  itemPoints: readonly SnapshotPoint[],
  accountPoints: readonly SnapshotPoint[],
  configInput: LongitudinalConfigInput = {},
): LongitudinalScore {
  const config = longitudinalConfigSchema.parse(configInput);
  const deltaVelocity = latestDeltaVelocity(itemPoints, config);

  const itemId = itemPoints[0]?.externalId;
  const byPeer = new Map<string, SnapshotPoint[]>();
  for (const point of accountPoints) {
    if (point.externalId === itemId) continue;
    const bucket = byPeer.get(point.externalId) ?? [];
    bucket.push(point);
    byPeer.set(point.externalId, bucket);
  }
  const peerDeltas = [...byPeer.values()]
    .map((points) => latestDeltaVelocity(points, config))
    .filter((v): v is number => v !== null);
  const baselineDeltaVelocity =
    peerDeltas.length >= config.minBaselinePeers ? median(peerDeltas) : null;

  const reasons: string[] = [];
  if (
    deltaVelocity !== null &&
    baselineDeltaVelocity !== null &&
    baselineDeltaVelocity > 0 &&
    deltaVelocity >= config.velocityMultiple * baselineDeltaVelocity
  ) {
    reasons.push(
      `Δ-velocity ${round2(deltaVelocity)} ${config.viewsMetric}/h between snapshots is ≥ ${config.velocityMultiple}× the account's stored baseline ${round2(baselineDeltaVelocity)} ${config.viewsMetric}/h`,
    );
  }

  return { deltaVelocity, baselineDeltaVelocity, reasons, isOutlier: reasons.length > 0 };
}
