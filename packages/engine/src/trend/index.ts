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
  areaExpansionConfigSchema,
  expandArea,
  expandAreas,
  mergeQueries,
  sweepAreaSchema,
  type AreaExpansionConfig,
  type AreaExpansionConfigInput,
  type AreaQueryExpansion,
  type AreasExpansion,
  type SweepArea,
  type SweepAreaInput,
} from "./area-expansion";
export {
  cosineSimilarity,
  rankCandidates,
  rankerConfigSchema,
  resolveRankerWeights,
  type RankableArea,
  type RankableCandidate,
  type RankedCandidate,
  type RankedComponents,
  type RankerConfig,
  type RankerConfigInput,
} from "./ranker";
export {
  runTrendIntake,
  type TrendIntakeDeps,
  type TrendIntakeRequest,
  type TrendIntakeResult,
} from "./intake";
