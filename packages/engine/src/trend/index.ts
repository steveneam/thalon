export { watchlistSchema, type Watchlist, type WatchlistInput } from "./watchlist";
export type { TrendItem, TrendSource } from "./trend-source";
export { createFakeTrendSource } from "./fake-source";
export {
  blueskyConfigSchema,
  blueskyTrendSource,
  type BlueskyConfig,
  type BlueskyConfigInput,
  type BlueskySourceDeps,
} from "./bluesky-source";
export {
  youtubeConfigSchema,
  youtubeTrendSource,
  type YoutubeConfig,
  type YoutubeConfigInput,
  type YoutubeSourceDeps,
} from "./youtube-source";
export { getTrendSource, registeredTrendSources } from "./source-registry";
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
export {
  readSweepBundle,
  runTrendSweep,
  SWEEP_BUNDLE_VERSION,
  sweepBundleKey,
  sweepBundleSchema,
  type SweepBundle,
  type SweepCard,
  type TrendSweepDeps,
  type TrendSweepRequest,
  type TrendSweepResult,
} from "./sweep";
