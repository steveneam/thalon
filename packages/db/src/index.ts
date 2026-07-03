// Public surface of @thalon/db. Raw drizzle/PGlite handles are deliberately
// NOT exported (SPINE §2.6) — the tenant-scoped repos on DbHandle are the API.
export { openDb, openTestDb, resetDbForTests, type DbHandle } from "./client";
export * from "./errors";
export { llmCacheKey, retrievalCacheKey, sha256Hex, stableStringify } from "./hash";
export type { Repos } from "./repos";
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
  Tenant,
  UsageLedgerRow,
} from "./types";
