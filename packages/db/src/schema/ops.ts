import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { drafts } from "./content";
import { tenants } from "./tenancy";

/**
 * Schema lands at B0.3 per the charter; the worker is Sprint 3+ and NO
 * publish path is wired anywhere in Sprints 0–2 — there is deliberately no
 * repository for this table yet.
 */
export const publishQueue = pgTable(
  "publish_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    draftId: uuid("draft_id")
      .notNull()
      .references(() => drafts.id),
    platform: text("platform").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    status: text("status").notNull().default("pending"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("publish_queue_tenant_platform_scheduled_idx").on(
      t.tenantId,
      t.platform,
      t.scheduledAt,
    ),
    check(
      "publish_queue_status_check",
      sql.raw(`status in ('pending', 'processing', 'published', 'failed', 'cancelled')`),
    ),
  ],
);

/** Append-only audit spine, written by every state transition (invariant I4). Later: the analytics substrate and debugging timeline. */
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Total append order — created_at is the transaction timestamp, so rows written in one transaction tie on it. */
    seq: bigserial("seq", { mode: "number" }).notNull().unique(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    event: text("event").notNull(),
    payload: jsonb("payload").notNull().default({}),
    actor: text("actor"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("events_tenant_created_idx").on(t.tenantId, t.createdAt),
    index("events_entity_idx").on(t.entityType, t.entityId),
  ],
);

/** Per tenant × day × model. The gateway wrapper checks it BEFORE each shell call; over-budget ⇒ hard stop + event, never silent degradation (amendment A2). */
export const usageLedger = pgTable(
  "usage_ledger",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    day: date("day").notNull(),
    model: text("model").notNull(),
    tokensIn: bigint("tokens_in", { mode: "number" }).notNull().default(0),
    tokensOut: bigint("tokens_out", { mode: "number" }).notNull().default(0),
    costEstimate: doublePrecision("cost_estimate").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.day, t.model] })],
);

/** key = hash(prompt_version + model + params + input_hash). Identical generations skip the gateway; tenant_id is for accounting — keys are content-addressed. */
export const llmCache = pgTable("llm_cache", {
  key: text("key").primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  valueRef: text("value_ref").notNull(),
  hitCount: integer("hit_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastHitAt: timestamp("last_hit_at", { withTimezone: true }),
});

/** key = hash(source_set_hash + query_hash) → top-k result. */
export const retrievalCache = pgTable("retrieval_cache", {
  key: text("key").primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  result: jsonb("result").notNull(),
  hitCount: integer("hit_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastHitAt: timestamp("last_hit_at", { withTimezone: true }),
});
