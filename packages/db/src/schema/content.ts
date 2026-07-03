import { DRAFT_STATUSES, SOURCE_KINDS } from "@thalon/contracts";
import { sql } from "drizzle-orm";
import {
  check,
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
    contentHash: text("content_hash").notNull(),
    meta: jsonb("meta").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("sources_tenant_created_idx").on(t.tenantId, t.createdAt),
    check("sources_kind_check", sql.raw(`kind in (${inList(SOURCE_KINDS)})`)),
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
  ],
);
