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
export {
  getTrendSource,
  getTrendSources,
  registeredTrendSources,
  type TrendSourceDeps,
} from "./source-registry";
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
  admissionConfigSchema,
  admissionKnobOverridesSchema,
  admissionKnobsSchema,
  admissionOrigin,
  decideAdmission,
  emptyAdmissions,
  resolveAdmissionKnobs,
  runAdmissions,
  type AdmissionConfig,
  type AdmissionConfigInput,
  type AdmissionDecision,
  type AdmissionKnobOverrides,
  type AdmissionKnobs,
  type AdmissionKnobsInput,
  type AdmissionRefusal,
  type AdmissionsResult,
  type AreaAdmissionSummary,
  type RunAdmissionsArgs,
  type RunAdmissionsDeps,
} from "./admission";
export {
  runTrendIntake,
  type TrendIntakeDeps,
  type TrendIntakeRequest,
  type TrendIntakeResult,
} from "./intake";
export {
  mergeSweepCards,
  readSweepBundle,
  readSweepBundles,
  runTrendSweep,
  SWEEP_BUNDLE_VERSION,
  sweepBundleKey,
  sweepBundleSchema,
  sweepSourceBundleKey,
  type SweepBundle,
  type SweepCard,
  type TrendSweepDeps,
  type TrendSweepRequest,
  type TrendSweepResult,
} from "./sweep";
export {
  envAdmissionConfig,
  findDueTenants,
  runDueSweeps,
  tenantTrendSources,
  type DueSweepFailure,
  type RunDueSweepsDeps,
  type RunDueSweepsResult,
  type SweepScheduleLike,
} from "./sweep-scheduler";
export {
  generateTrendDossiers,
  type DossierCardInput,
  type GenerateDossiersDeps,
  type GenerateDossiersResult,
  type TrendDossier,
} from "./dossier";
export {
  trendDossierShellOutputSchema,
  type TrendDossierShellOutput,
} from "./dossier-schemas";
export {
  createFakeDossierDriver,
  gatewayDossierDriver,
  trendDossierPromptVersion,
  type DossierDriver,
  type DossierShellCall,
  type DossierShellRequest,
} from "./shell/dossier";
