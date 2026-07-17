import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/**
 * B0.5: the driver-agnostic database type — PGlite (embedded dev/test) and
 * node-postgres (real server) both extend PgDatabase, so every repo works
 * over either without change. The concrete driver is client.ts's concern.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Repos accept either the root handle or an open transaction so multi-step invariants (I1–I4, edit→eval) compose atomically. */
export type Executor = Db | Tx;

export type Tenant = typeof schema.tenants.$inferSelect;
export type BrandProfile = typeof schema.brandProfiles.$inferSelect;
export type Source = typeof schema.sources.$inferSelect;
export type SourceChunk = typeof schema.sourceChunks.$inferSelect;
export type SourceMetric = typeof schema.sourceMetrics.$inferSelect;
export type FanoutRun = typeof schema.fanoutRuns.$inferSelect;
export type Draft = typeof schema.drafts.$inferSelect;
export type JudgeResult = typeof schema.judgeResults.$inferSelect;
export type Approval = typeof schema.approvals.$inferSelect;
export type EditDiff = typeof schema.editDiffs.$inferSelect;
export type EvalCase = typeof schema.evalCases.$inferSelect;
export type EventRow = typeof schema.events.$inferSelect;
export type UsageLedgerRow = typeof schema.usageLedger.$inferSelect;
