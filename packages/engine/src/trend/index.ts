export { watchlistSchema, type Watchlist, type WatchlistInput } from "./watchlist";
export type { TrendItem, TrendSource } from "./trend-source";
export { createFakeTrendSource } from "./fake-source";
export {
  detectOutliers,
  outlierConfigSchema,
  type OutlierConfig,
  type OutlierConfigInput,
  type ScoredItem,
} from "./outliers";
export {
  detectLongitudinalOutlier,
  latestDeltaVelocity,
  longitudinalConfigSchema,
  type LongitudinalConfig,
  type LongitudinalConfigInput,
  type LongitudinalScore,
  type SnapshotPoint,
} from "./longitudinal";
export {
  runTrendIntake,
  type TrendIntakeDeps,
  type TrendIntakeRequest,
  type TrendIntakeResult,
} from "./intake";
