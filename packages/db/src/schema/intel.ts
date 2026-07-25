import { MONITORED_AREA_STATUSES, CAPTURE_KINDS } from "@thalon/contracts";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { tenantIsolation } from "./rls";
import { tenants } from "./tenancy";

const inList = (values: readonly string[]) => values.map((v) => `'${v}'`).join(", ");

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

/**
 * Phase-I window (s61): the operator-action capture spine, persisted. The
 * workspace has run captures in memory since wave 3 (promote / dismiss /
 * target-this / lead-promote each record one; Create resolves context FROM
 * a capture id) — this table is that spine's durable home. Append-only in
 * spirit: a capture records an action that happened; nothing updates it.
 * The spine's station-02 list and the drafts.capture_id lineage read here.
 */
export const intelCaptures = pgTable(
  "intel_captures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    /** contracts CAPTURE_KINDS — the closed action vocabulary. */
    kind: text("kind").notNull(),
    /** The structured context the capture carries — open per-family shape (contracts intelCaptureSchema). */
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Station 02's hot path: a tenant's recent captures, newest first.
    index("intel_captures_tenant_created_idx").on(t.tenantId, t.createdAt),
    check("intel_captures_kind_check", sql.raw(`kind in (${inList(CAPTURE_KINDS)})`)),
    tenantIsolation(),
  ],
);

/**
 * B-learn L0 window (s73): the durable admission-cap ledger. One row = one
 * CLAIMED slot in an area's UTC-day admission cap (`maxAdmissionsPerDay`).
 * The engine's in-memory day-count (trend/admission.ts "Cap honesty"
 * header) can overshoot when two sweeps race one tenant; here a claim is
 * serialized by the unique (tenant, area, day, slot) index — racing
 * claimers collide loudly, re-read the committed count, and the cap can
 * never overshoot. `day` derives from the sweep's ARGUMENT clock (SPINE
 * §1), never the DB's row clock, so counts replay deterministically. The
 * second unique key (tenant, area, day, content_hash) makes re-claiming
 * the same content the same day an idempotent replay: a claim-then-failed-
 * ingest retried next sweep returns its EXISTING slot instead of burning
 * another. A slot claimed for an ingest that never completes stays claimed
 * — the conservative direction (undershoot, never overshoot).
 */
export const trendAdmissions = pgTable(
  "trend_admissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    areaId: uuid("area_id")
      .notNull()
      .references(() => monitoredAreas.id),
    /** UTC day of the sweep's argument clock, YYYY-MM-DD — the cap-ledger key. */
    day: text("day").notNull(),
    /** 1-based slot in the area's day cap — assigned monotonically; the unique index serializes racing claims. */
    slot: integer("slot").notNull(),
    /** sha256 of the PII-stripped text — the ingest door's own dedup identity; same-content re-claims replay. */
    contentHash: text("content_hash").notNull(),
    /** TrendSource driver name that claimed (provenance). */
    source: text("source").notNull(),
    /** Stable platform-native id of the claiming item (provenance). */
    externalId: text("external_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("trend_admissions_tenant_area_day_slot_idx").on(
      t.tenantId,
      t.areaId,
      t.day,
      t.slot,
    ),
    uniqueIndex("trend_admissions_tenant_area_day_content_idx").on(
      t.tenantId,
      t.areaId,
      t.day,
      t.contentHash,
    ),
    tenantIsolation(),
  ],
);

/**
 * Sprint-8 window (B-arm.1): the per-tenant sweep-schedule config row —
 * ONE row per tenant (unique on tenant_id), the timer contract between
 * "Sweep now" and live pollers. Cadence bounds live in contracts
 * (sweepScheduleConfigSchema — floor 15 min, ceiling 24 h, default 4 h);
 * the repo validates at the write door. `last_sweep_at` is the scheduler's
 * honest clock — set only when a sweep actually ran, so the Runs surface
 * never claims a sweep that didn't happen.
 */
export const sweepSchedules = pgTable(
  "sweep_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    enabled: boolean("enabled").notNull().default(false),
    cadenceMinutes: integer("cadence_minutes").notNull().default(240),
    lastSweepAt: timestamp("last_sweep_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("sweep_schedules_tenant_idx").on(t.tenantId), tenantIsolation()],
);
