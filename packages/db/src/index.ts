// Public surface of @thalon/db. Raw drizzle/PGlite handles are deliberately
// NOT exported (SPINE §2.6) — the tenant-scoped repos on DbHandle are the API.
export { openDb, openTestDb, resetDbForTests, type DbHandle } from "./client";
export { TENANT_SESSION_SETTING } from "./tenant-session";
export {
  migratePgliteToPostgres,
  MigratePreconditionError,
  type MigratePgliteToPostgresOptions,
  type MigrateReport,
  type TableReport,
} from "./migrate-data";
export * from "./errors";
export { llmCacheKey, retrievalCacheKey, sha256Hex, stableStringify } from "./hash";
export type { Repos } from "./repos";
export { leadEmailHash } from "./repos/leads";
export type { Lead as LeadRow } from "./repos/leads";
export type { LeadScore as LeadScoreRow } from "./repos/lead-scores";
export type { LeadWeightState as LeadWeightStateRow } from "./repos/lead-weight-states";
export type { MonitoredArea as MonitoredAreaRow } from "./repos/monitored-areas";
export { DuplicatePublicationError } from "./repos/social-publications";
export type { SocialPublication as SocialPublicationRow } from "./repos/social-publications";
export type { TenantEntitlement as TenantEntitlementRow, EffectiveEntitlements } from "./repos/entitlements";
export type { SweepSchedule as SweepScheduleRow } from "./repos/sweep-schedules";
export type { TrendAdmission as TrendAdmissionRow } from "./repos/trend-admissions";
export { admissionDay } from "./repos/trend-admissions";
export { DuplicateSendError } from "./repos/outreach-sends";
export type { OutreachSend as OutreachSendRow } from "./repos/outreach-sends";
export type { SearchSnapshot } from "./repos/search-snapshots";
export type { SearchTarget as SearchTargetRow } from "./repos/search-targets";
export type { TrendSnapshot } from "./repos/trend-snapshots";
export type { VideoCutRow } from "./repos/video-cuts";
export type { IntelCaptureRow } from "./repos/intel-captures";
export type { TenantCredential } from "./repos/tenant-credentials";
export type { PlannedSlotRow } from "./repos/planned-slots";
export type { SavedViewRow } from "./repos/saved-views";
export type { VideoProject as VideoProjectRow } from "./repos/video-projects";
export type { VideoTakeRow } from "./repos/video-takes";
export type { WaitlistEntry } from "./repos/waitlist";
export type { Watchlist as WatchlistRow } from "./repos/watchlists";
export type {
  Approval,
  BrandProfile,
  Draft,
  EditDiff,
  EvalCase,
  EventRow,
  FanoutRun,
  JudgeResult,
  Source,
  SourceChunk,
  SourceMetric,
  Tenant,
  UsageLedgerRow,
} from "./types";
