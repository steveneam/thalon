import { z } from "zod";
import type { TrendItem } from "./trend-source";

/**
 * B3.12 outlier detection — the operator blueprint's ratio formulas as
 * TESTED MATH in pure core, never model vibes (CHARTER B3.12 / amendment
 * A7). Three deterministic rules, each a reason string when it fires:
 *
 *  - velocity vs account baseline: views/hour ≥ `velocityMultiple` × the
 *    median views/hour of the account's OTHER items in the sweep;
 *  - share-to-view ratio ≥ `shareToViewThreshold`;
 *  - bookmark-efficiency (bookmarks/views) ≥ `bookmarkToViewThreshold`.
 *
 * Metric NAMES are config (SPINE §4.1: platform metric names arrive as
 * tenant data — "views" on one platform is "impressions" on another). A
 * missing metric simply disarms its rule for that item; ratios only arm at
 * `minViews` so tiny denominators can't fabricate outliers; the velocity
 * baseline only arms at `minBaselinePeers` peers. No clock in core: the
 * sweep's `nowMs` is an argument.
 */
export const outlierConfigSchema = z.object({
  metricNames: z
    .object({
      views: z.string().min(1),
      shares: z.string().min(1),
      bookmarks: z.string().min(1),
    })
    .default({ views: "views", shares: "shares", bookmarks: "bookmarks" }),
  velocityMultiple: z.number().positive().default(3),
  shareToViewThreshold: z.number().positive().default(0.01),
  bookmarkToViewThreshold: z.number().positive().default(0.02),
  /** Ratio rules arm only at this many views — below it, denominators are noise. */
  minViews: z.number().nonnegative().default(1_000),
  /** Velocity ages floor here so a just-published item can't divide by epsilon. */
  minAgeHours: z.number().positive().default(1),
  /** The account-baseline rule arms only with at least this many OTHER items from the same account in the sweep. */
  minBaselinePeers: z.number().int().positive().default(2),
});

export type OutlierConfigInput = z.input<typeof outlierConfigSchema>;
export type OutlierConfig = z.infer<typeof outlierConfigSchema>;

export interface ScoredItem {
  item: TrendItem;
  /** Views per hour since publish (age floored at minAgeHours); null when the views metric is absent. */
  velocity: number | null;
  /** Median velocity of the account's other items; null below minBaselinePeers or when peers lack views. */
  baselineVelocity: number | null;
  shareToView: number | null;
  bookmarkToView: number | null;
  /** One human-readable line per rule that fired — the operator sees WHY something was flagged. */
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

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

export function detectOutliers(
  items: readonly TrendItem[],
  config: OutlierConfig,
  nowMs: number,
): ScoredItem[] {
  const names = config.metricNames;
  const velocityOf = (item: TrendItem): number | null => {
    const views = item.metrics[names.views];
    if (views === undefined) return null;
    const ageHours = Math.max((nowMs - item.publishedAt) / 3_600_000, config.minAgeHours);
    return views / ageHours;
  };

  return items.map((item) => {
    const views = item.metrics[names.views];
    const shares = item.metrics[names.shares];
    const bookmarks = item.metrics[names.bookmarks];
    const velocity = velocityOf(item);

    const peerVelocities = items
      .filter((peer) => peer !== item && peer.account === item.account)
      .map(velocityOf)
      .filter((v): v is number => v !== null);
    const baselineVelocity =
      peerVelocities.length >= config.minBaselinePeers ? median(peerVelocities) : null;

    const ratiosArmed = views !== undefined && views >= config.minViews && views > 0;
    const shareToView = ratiosArmed && shares !== undefined ? shares / views : null;
    const bookmarkToView = ratiosArmed && bookmarks !== undefined ? bookmarks / views : null;

    const reasons: string[] = [];
    if (
      velocity !== null &&
      baselineVelocity !== null &&
      baselineVelocity > 0 &&
      velocity >= config.velocityMultiple * baselineVelocity
    ) {
      reasons.push(
        `velocity ${round2(velocity)} ${names.views}/h is ≥ ${config.velocityMultiple}× the account baseline ${round2(baselineVelocity)} ${names.views}/h`,
      );
    }
    if (shareToView !== null && shareToView >= config.shareToViewThreshold) {
      reasons.push(
        `${names.shares}-to-${names.views} ratio ${round4(shareToView)} is ≥ ${config.shareToViewThreshold}`,
      );
    }
    if (bookmarkToView !== null && bookmarkToView >= config.bookmarkToViewThreshold) {
      reasons.push(
        `${names.bookmarks}-to-${names.views} ratio ${round4(bookmarkToView)} is ≥ ${config.bookmarkToViewThreshold}`,
      );
    }

    return {
      item,
      velocity,
      baselineVelocity,
      shareToView,
      bookmarkToView,
      reasons,
      isOutlier: reasons.length > 0,
    };
  });
}
