import { DRAFT_STATUSES, SOURCE_KINDS } from "@thalon/contracts";
import { sql } from "drizzle-orm";
import {
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import { tenantIsolation } from "./rls";
import { brandProfiles, tenants } from "./tenancy";

const inList = (values: readonly string[]) =>
  values.map((v) => `'${v}'`).join(", ");

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    kind: text("kind").notNull(),
    uri: text("uri"),
    /** Object-store key of the raw payload (doc upload, fetched page). */
    rawRef: text("raw_ref"),
    /** B2.2: open-ended by design (like judge_results.gate) — known values in contracts SOURCE_MODALITIES; future tiers need zero migrations. */
    modality: text("modality").notNull().default("text"),
    /** B2.2: object-store key of the rendered visual artifact — the B3.7 visual-ingest seam; null until that tier lands. */
    visualRef: text("visual_ref"),
    contentHash: text("content_hash").notNull(),
    meta: jsonb("meta").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("sources_tenant_created_idx").on(t.tenantId, t.createdAt),
    // B2.2: the engine's get-or-create idempotency, made structural.
    uniqueIndex("sources_tenant_content_hash_idx").on(t.tenantId, t.contentHash),
    check("sources_kind_check", sql.raw(`kind in (${inList(SOURCE_KINDS)})`)),
    tenantIsolation(),
  ],
);

/** The grounding index — materialized at ingest, never re-embedded per judge call (SPINE §2.7). HNSW in prod; same pgvector ops in dev via PGlite. */
export const sourceChunks = pgTable(
  "source_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id),
    seq: integer("seq").notNull(),
    text: text("text").notNull(),
    /** B2.2 time-coded sources: milliseconds into the media; null for untimed text. */
    startMs: integer("start_ms"),
    endMs: integer("end_ms"),
    embedding: vector("embedding", { dimensions: 1536 }),
    tokenCount: integer("token_count"),
    contentHash: text("content_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("source_chunks_source_seq_idx").on(t.sourceId, t.seq),
    index("source_chunks_embedding_hnsw_idx").using(
      "hnsw",
      t.embedding.op("vector_cosine_ops"),
    ),
    tenantIsolation(),
  ],
);

/**
 * B2.2 (A5): generic per-source engagement metrics — `metric_name` /
 * `metric_value` only; platform metric names arrive as tenant data, never
 * hard-coded (the SPINE §4.1 deferred-analytics rule). Append-only, never
 * UPDATE; exemplar retrieval (B2.4) and the analytics join (B3.5) read it.
 */
export const sourceMetrics = pgTable(
  "source_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id),
    metricName: text("metric_name").notNull(),
    metricValue: doublePrecision("metric_value").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("source_metrics_tenant_source_idx").on(t.tenantId, t.sourceId),
    tenantIsolation(),
  ],
);

/** One row per fan-out invocation: the idempotency + provenance anchor; groups the N drafts of one run (the Approve batch unit). */
export const fanoutRuns = pgTable(
  "fanout_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id),
    brandProfileId: uuid("brand_profile_id")
      .notNull()
      .references(() => brandProfiles.id),
    brandProfileVersion: integer("brand_profile_version").notNull(),
    platforms: jsonb("platforms").notNull().default([]),
    promptVersion: text("prompt_version").notNull(),
    model: text("model").notNull(),
    params: jsonb("params").notNull().default({}),
    generationKey: text("generation_key").notNull().unique(),
    status: text("status").notNull().default("pending"),
    /** B4.5 operator triage: the LAST irrecoverable failure on this run, verbatim; null once a later pass on the same run succeeds. Written only via fanoutRuns.recordLastError (events-audited). */
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("fanout_runs_tenant_created_idx").on(t.tenantId, t.createdAt),
    check(
      "fanout_runs_status_check",
      sql.raw(`status in ('pending', 'running', 'complete', 'failed')`),
    ),
    tenantIsolation(),
  ],
);

export const drafts = pgTable(
  "drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    fanoutRunId: uuid("fanout_run_id")
      .notNull()
      .references(() => fanoutRuns.id),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id),
    platform: text("platform").notNull(),
    format: text("format"),
    body: text("body").notNull(),
    bodyHash: text("body_hash").notNull(),
    /** hook_type, template ids — the future analytics join keys (SPINE §2.5). */
    meta: jsonb("meta").notNull().default({}),
    /** Written ONLY by the transition function in repos/drafts.ts (SPINE §1.1). */
    status: text("status").notNull().default("generated"),
    generationKey: text("generation_key").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("drafts_tenant_status_idx").on(t.tenantId, t.status),
    index("drafts_tenant_created_idx").on(t.tenantId, t.createdAt),
    check("drafts_status_check", sql.raw(`status in (${inList(DRAFT_STATUSES)})`)),
    tenantIsolation(),
  ],
);
