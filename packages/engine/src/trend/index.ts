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
  runTrendIntake,
  type TrendIntakeDeps,
  type TrendIntakeRequest,
  type TrendIntakeResult,
} from "./intake";
