// Public surface of @thalon/db. Raw drizzle/PGlite handles are deliberately
// NOT exported (SPINE §2.6) — the tenant-scoped repos on DbHandle are the API.
export { openDb, openTestDb, resetDbForTests, type DbHandle } from "./client";
export * from "./errors";
export { llmCacheKey, retrievalCacheKey, sha256Hex, stableStringify } from "./hash";
export type { Repos } from "./repos";
export { leadEmailHash } from "./repos/leads";
export type { Lead as LeadRow } from "./repos/leads";
export type { LeadScore as LeadScoreRow } from "./repos/lead-scores";
export type { MonitoredArea as MonitoredAreaRow } from "./repos/monitored-areas";
export type { SearchSnapshot } from "./repos/search-snapshots";
export type { SearchTarget as SearchTargetRow } from "./repos/search-targets";
export type { TrendSnapshot } from "./repos/trend-snapshots";
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
