import { MONITORED_AREA_STATUSES } from "@thalon/contracts";
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
import { tenantIsolation } from "./rls";
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
    tenantIsolation(),
  ],
);

/**
 * B6.4 (amendment A12 / ADR 0005): operator-described monitored AREAS — the
 * "niches" third of the chartered B3.12 watchlist, durable per-tenant
 * runtime config. The free-text `description` is load-bearing data: it
 * seeds the deterministic area→query expansion and anchors the ranker's
 * relevance embedding. `config` holds the zod-validated per-area tuning
 * (contracts monitoredAreaConfigSchema: ranker weight overrides, per-sweep
 * query ration). Paused areas stop expanding into queries but keep their
 * history — area provenance on ingested exemplars rides `sources.meta`,
 * so no intel table changes are needed for tagging.
 */
export const monitoredAreas = pgTable(
  "monitored_areas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    /** Free text: what the operator watches and why — expansion seed + relevance-embedding anchor. */
    description: text("description").notNull(),
    /** contracts monitoredAreaConfigSchema — validated at the repo boundary, stored as data. */
    config: jsonb("config").notNull().default({}),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("monitored_areas_tenant_name_idx").on(t.tenantId, t.name),
    // Hot path: the sweep loop expands every ACTIVE area per tenant.
    index("monitored_areas_tenant_status_idx").on(t.tenantId, t.status),
    check(
      "monitored_areas_status_check",
      sql.raw(`status in (${MONITORED_AREA_STATUSES.map((s) => `'${s}'`).join(", ")})`),
    ),
    tenantIsolation(),
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
    tenantIsolation(),
  ],
);
