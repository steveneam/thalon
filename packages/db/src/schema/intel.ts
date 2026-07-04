import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenancy";

/**
 * B4.3: per-tenant watchlists as durable runtime config (CHARTER B3.12 —
 * accounts/queries/niches the tenant watches — hardened per A10). Exactly the
 * shape the engine's trend/watchlist.ts zod schema already models: `source`
 * names the TrendSource driver serving this watchlist ("youtube", "bluesky",
 * "fake" — driver selection is data); accounts/queries are platform-native
 * strings. Config-as-data, never code (AGENTS.md rule 3).
 */
export const watchlists = pgTable(
  "watchlists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    /** TrendSource driver name this watchlist is served by. */
    source: text("source").notNull(),
    /** Account handles/channel ids to watch (platform-native strings — data). */
    accounts: jsonb("accounts").notNull().default([]),
    /** Search queries / niche terms to watch. */
    queries: jsonb("queries").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Hot path: the pass-3 poller loop fans out per tenant × driver.
    index("watchlists_tenant_source_idx").on(t.tenantId, t.source),
  ],
);

/**
 * B4.3 (founder-ratified, A10 decision 2): the dedicated intermediate table
 * where ALL watched items accrue timestamped engagement history — NOT
 * `sources` (only outliers ever become exemplar sources) and NOT
 * `source_metrics` (that spine is keyed to source rows). Append-only, never
 * UPDATE. One row = one watched item's engagement counters at one capture
 * instant, exactly as the B3.12 skeleton already computes them (TrendItem.
 * metrics — platform-generic name/value, SPINE §4.1). The longitudinal
 * outlier math (engine trend/longitudinal.ts) reads successive rows per item
 * for Δ-velocity against the account's stored baseline.
 */
export const trendSnapshots = pgTable(
  "trend_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    /** TrendSource driver name that captured this snapshot. */
    source: text("source").notNull(),
    /** Stable platform-native id (video id, post URI) — the watched-item identity. */
    externalId: text("external_id").notNull(),
    /** Account/author handle the item belongs to — the baseline group. */
    account: text("account").notNull(),
    /** The item's publish time — the single-snapshot velocity denominator. */
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    /** Engagement counters, platform-generic name/value (SPINE §4.1: metric names are data, never hard-coded). */
    metrics: jsonb("metrics").notNull().default({}),
    /** The sweep's clock (intake's `nowMs` argument — deterministic, never read in core). */
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // History is KEYED by tenant + watched item + captured-at (charter B4.3):
    // re-running the same sweep appends nothing — idempotency made structural.
    uniqueIndex("trend_snapshots_tenant_item_captured_idx").on(
      t.tenantId,
      t.source,
      t.externalId,
      t.capturedAt,
    ),
    // Hot path: an account's stored history in capture order — the
    // longitudinal baseline read.
    index("trend_snapshots_tenant_account_captured_idx").on(
      t.tenantId,
      t.source,
      t.account,
      t.capturedAt,
    ),
  ],
);
