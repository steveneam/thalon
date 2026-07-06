import { SEARCH_TARGET_ORIGINS, SEARCH_TARGET_STATUSES } from "@thalon/contracts";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenancy";

const inList = (values: readonly string[]) => values.map((v) => `'${v}'`).join(", ");

/**
 * B6.8 (amendment A13 / ADR 0006): search intel — Intel's second half.
 * `search_targets` mirrors `watchlists` (tenant-scoped runtime config: the
 * compiled keyword list the tenant targets); `search_snapshots` mirrors
 * `trend_snapshots` (append-only, structurally idempotent engagement
 * history — here search-performance counters per query). The deterministic
 * "peering over the horizon" opportunity math reads successive rows per
 * query, exactly as the longitudinal Δ-velocity math reads trend history.
 */

export const searchTargets = pgTable(
  "search_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    /** Canonical query string the tenant targets. */
    keyword: text("keyword").notNull(),
    /** Compilation provenance (contracts SEARCH_TARGET_ORIGINS) — first origin wins, never rewritten. */
    origin: text("origin").notNull(),
    /** Dismissed, never deleted — dismissals are operator signal (→ eval rows). */
    status: text("status").notNull().default("active"),
    /** Compiler provenance (seeding profile fields, question form, …) — open shape, data not code. */
    meta: jsonb("meta").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Recompiling is idempotent: one row per tenant × keyword, structural.
    uniqueIndex("search_targets_tenant_keyword_idx").on(t.tenantId, t.keyword),
    // Hot path: generation context + the Search tab read ACTIVE targets.
    index("search_targets_tenant_status_idx").on(t.tenantId, t.status),
    check("search_targets_origin_check", sql.raw(`origin in (${inList(SEARCH_TARGET_ORIGINS)})`)),
    check("search_targets_status_check", sql.raw(`status in (${inList(SEARCH_TARGET_STATUSES)})`)),
  ],
);

/**
 * Append-only, never UPDATE. One row = one query's search-performance
 * counters (clicks · impressions · ctr · position — platform-generic
 * name/value, SPINE §4.1) at one capture instant, as reported by a
 * `SearchIntelSource` driver (GSC first; the fake in tests). `page` is the
 * URL dimension; '' = the site-level aggregate — non-null so the structural
 * idempotency key stays total (Postgres treats NULLs as distinct in unique
 * indexes, which would break replay-appends-nothing).
 */
export const searchSnapshots = pgTable(
  "search_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    /** SearchIntelSource driver name that captured this snapshot ("gsc", "fake"). */
    source: text("source").notNull(),
    /** The search query as the driver reports it — the watched-item identity. */
    query: text("query").notNull(),
    /** Page/URL dimension; '' = site-level aggregate. */
    page: text("page").notNull().default(""),
    /** Search-performance counters, platform-generic name/value (SPINE §4.1). */
    metrics: jsonb("metrics").notNull().default({}),
    /** The sweep's clock (intake's `nowMs` argument — deterministic, never read in core). */
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // History is KEYED by tenant + query + page + captured-at: re-running the
    // same sweep appends nothing — idempotency made structural (the
    // trend_snapshots convention).
    uniqueIndex("search_snapshots_tenant_query_captured_idx").on(
      t.tenantId,
      t.source,
      t.query,
      t.page,
      t.capturedAt,
    ),
    // Hot path: a sweep's full capture in time order — the horizon math's
    // rising-impressions read across queries.
    index("search_snapshots_tenant_source_captured_idx").on(t.tenantId, t.source, t.capturedAt),
  ],
);
