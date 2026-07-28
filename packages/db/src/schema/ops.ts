import { PUBLISH_QUEUE_STATUSES } from "@thalon/contracts";
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
import { tenantIsolation } from "./rls";
import { tenants } from "./tenancy";

/** Status words come from contracts, so the vocabulary and its check constraint stay one source of truth (the `content.ts` convention). */
const inList = (values: readonly string[]) => values.map((v) => `'${v}'`).join(", ");

/**
 * Schema landed at B0.3 per the charter, and stayed DORMANT through
 * Sprints 0–7: a queue with neither end wired (no repo, no producer, no
 * consumer). The s82 window (W1) gives it its repository — `repos/
 * publish-queue.ts` — for the Schedule verb and the disarmed consumer tick.
 * The columns below are the B0.3 originals plus two additive s82 fields; the
 * status vocabulary now comes from contracts (`inList`), so the words and the
 * constraint cannot drift apart.
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
    /**
     * Nullable since B0.3 and deliberately left so — a dormant column is not
     * tightened outside a mandate. The write door requires a time
     * (`publishQueueEnqueueSchema`), and `listDue` treats a NULL as due
     * immediately, so no row can hide from the consumer.
     */
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    status: text("status").notNull().default("pending"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /**
     * s82 (additive): stamped by every state transition. This is what makes a
     * stale claim recoverable — a consumer that dies mid-tick leaves its row
     * in `processing`, and without a claim clock that row is stranded
     * forever (the `missing.post` recovery pattern, carried from day one).
     */
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    /**
     * s82 (additive): why a row failed, verbatim, where the operator reads
     * the queue. The event spine carries the same reason — this is the
     * current-state projection, so a failed-rows view needs no per-row events
     * query. It differs deliberately from `sweepSchedules.markFailed`, which
     * is event-only: a sweep failure has no durable failed STATE (the tenant
     * stays due and retries), whereas a failed queue row is terminal and must
     * say why on its face.
     */
    lastError: text("last_error"),
  },
  (t) => [
    index("publish_queue_tenant_platform_scheduled_idx").on(
      t.tenantId,
      t.platform,
      t.scheduledAt,
    ),
    check(
      "publish_queue_status_check",
      sql.raw(`status in (${inList(PUBLISH_QUEUE_STATUSES)})`),
    ),
    tenantIsolation(),
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
    tenantIsolation(),
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
  (t) => [primaryKey({ columns: [t.tenantId, t.day, t.model] }), tenantIsolation()],
);

/**
 * key = hash(prompt_version + model + params + input_hash). Identical
 * generations skip the gateway; tenant_id is for accounting — keys are
 * content-addressed. NO tenantIsolation() policy on the two caches, on
 * purpose: repos/caches.ts reads them cross-tenant by design ("a hit is a
 * hit whoever warmed it" — a key is only reachable by re-deriving it from
 * the full input, so a cross-tenant hit reveals nothing the caller couldn't
 * regenerate). Isolating them would silently turn every cross-tenant hit
 * into a miss. Exemption pinned in __tests__/rls-ratchet.test.ts.
 */
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

/** key = hash(source_set_hash + query_hash) → top-k result. Same deliberate RLS exemption as llm_cache (source_set_hash makes keys tenant-salted in practice). */
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
