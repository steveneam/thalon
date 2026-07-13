import { LEAD_SOURCES, LEAD_STATUSES } from "@thalon/contracts";
import { sql } from "drizzle-orm";
import {
  check,
  doublePrecision,
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
 * B-crm.1 (amendment A16 / ADR 0008): the leads spine. One row = one inbound
 * contact, tenant-scoped like everything else (rule 3). Sources are
 * official-API or operator-supplied ONLY (waitlist bridge, CSV import, api —
 * contracts LEAD_SOURCES); no scraping, no purchased lists — provenance is
 * checked at the schema door. `email_hash` (hash of the normalized address)
 * is the dedupe identity: import idempotency made structural, the waitlist
 * pattern. The lifecycle is deliberately minimal (new → scored → dismissed);
 * B-crm.4's outreach state machine arrives additively at its own window.
 */
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    /** Intake provenance (contracts LEAD_SOURCES) — first source wins, never rewritten. */
    source: text("source").notNull(),
    /** Stored trimmed as supplied (display fidelity); identity lives in emailHash. */
    email: text("email").notNull(),
    /** sha256 of contracts normalizeLeadEmail(email) — the structural dedupe key. */
    emailHash: text("email_hash").notNull(),
    name: text("name"),
    company: text("company"),
    role: text("role"),
    website: text("website"),
    notes: text("notes"),
    status: text("status").notNull().default("new"),
    /** Source-specific extras (waitlist referral context, unmapped CSV columns) — data, open shape. */
    meta: jsonb("meta").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Importing the same contact twice returns the existing lead —
    // idempotency made structural (the waitlist pattern).
    uniqueIndex("leads_tenant_email_hash_idx").on(t.tenantId, t.emailHash),
    // Hot paths: the scoring job reads NEW leads; the queue reads by status.
    index("leads_tenant_status_idx").on(t.tenantId, t.status),
    index("leads_tenant_created_idx").on(t.tenantId, t.createdAt),
    check("leads_source_check", sql.raw(`source in (${inList(LEAD_SOURCES)})`)),
    check("leads_status_check", sql.raw(`status in (${inList(LEAD_STATUSES)})`)),
  ],
);

/**
 * B-crm.2: scoring history, append-only like trend_snapshots — never UPDATE,
 * the queue reads the latest row per lead. One row = one deterministic
 * scoring pass: weight-normalized [0,1] `score`, one readable reason per
 * armed signal (`reasons` — the ranker convention, never a black box),
 * per-component `signals` for tuning, and `profile_hash` (hash of the ICP
 * block that produced the score) so re-score-on-profile-drift is detectable
 * cache-key style.
 */
export const leadScores = pgTable(
  "lead_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id),
    score: doublePrecision("score").notNull(),
    reasons: jsonb("reasons").notNull().default([]),
    signals: jsonb("signals").notNull().default({}),
    profileHash: text("profile_hash").notNull(),
    /** The scoring job's clock (deterministic, passed in — never read in core). */
    scoredAt: timestamp("scored_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // History is KEYED by tenant + lead + producing profile + scored-at:
    // replaying the same scoring run appends nothing — idempotency made
    // structural (the trend_snapshots convention).
    uniqueIndex("lead_scores_tenant_lead_profile_scored_idx").on(
      t.tenantId,
      t.leadId,
      t.profileHash,
      t.scoredAt,
    ),
    // Hot path: the queue's latest-score-per-lead read.
    index("lead_scores_tenant_lead_scored_idx").on(t.tenantId, t.leadId, t.scoredAt),
  ],
);
