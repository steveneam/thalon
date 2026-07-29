/**
 * D2 (s87): own-post analytics — the engine spine that turns
 * `social_publications` rows into `publication_metrics` time series, honestly
 * per platform.
 *
 *   capability.ts — what each platform will TELL us, as data with a
 *                   `verifiedOn` stamp, and why an absence is absent.
 *   registry.ts   — the reader seam. A reader cannot post; that is the point.
 *   errors.ts     — the metrics refusal taxonomy (its own tree, not publish's).
 *   parse.ts      — the shared floor: a number is a number, never a coercion.
 *   tick.ts       — the disarmed collection pass.
 *   read-model.ts — the Analytics surface's shape, honesty already applied.
 */
export {
  audienceAbsence,
  METRIC_CAPABILITIES,
  METRIC_FAMILIES,
  METRIC_LABELS,
  metricCapability,
  platformsReportingAudience,
  reportedLabels,
  type MetricAbsence,
  type MetricFamily,
  type MetricLabel,
  type MetricRefused,
  type MetricReported,
  type PlatformMetricCapability,
} from "./capability";
export {
  SocialMetricsGatedError,
  SocialMetricsPermissionError,
  SocialMetricsRefusedError,
  SocialMetricsUnavailableError,
  SocialMetricsUnreadableError,
} from "./errors";
export { collectSample, finiteNumber, reclassifyMetricsError } from "./parse";
export {
  createFakeSocialMetricsReader,
  isRefusingSocialMetricsReader,
  refusingSocialMetricsReader,
  resolveSocialMetricsReader,
  type FakeSocialMetricsReader,
  type PostMetricSample,
  type PostMetricsReport,
  type PostMetricsRequest,
  type RefusingSocialMetricsReader,
  type SocialMetricsReader,
  type SocialMetricsReaderFactory,
} from "./registry";
export {
  collectPublicationMetrics,
  metricsWindowStart,
  type CollectPublicationMetricsDeps,
  type CollectPublicationMetricsResult,
  type MetricsCandidate,
  type MetricsFailure,
  type MetricsMeasured,
  type MetricsRefusal,
} from "./tick";
export {
  analyticsReadModel,
  type AnalyticsReadModel,
  type AnalyticsReadModelDeps,
  type AnalyticsReadModelInput,
  type AnalyticsTile,
  type ChannelAnalyticsRow,
  type MetricCell,
  type PostAnalyticsRow,
} from "./read-model";
