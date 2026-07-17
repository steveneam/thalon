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
import { tenantIsolation } from "./rls";
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
    /** The lead's problem/need — what outreach can address (window-1b); joins the relevance embedding. */
    painPoint: text("pain_point"),
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
    tenantIsolation(),
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
    /**
     * B-crm.5: the learned weight state whose multipliers shaped this pass
     * (null = base weights). Provenance AND the re-score trigger: the
     * scoring job compares this against the current state to know exactly
     * which leads a weight change invalidates — no timestamp heuristics.
     */
    weightStateId: uuid("weight_state_id").references(() => leadWeightStates.id),
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
    tenantIsolation(),
  ],
);

/**
 * B-crm.5: the learn loop's output — per-tenant learned weight multipliers
 * derived from lead_triage eval rows (Beta posterior per signal + Wilson
 * gate; the research doc's no-new-data shortlist rec 1). Append-only like
 * lead_scores: every pass that changes the evidence lands a new version, so
 * "why did this weight move, and when" is answerable forever. `profile_hash`
 * is the ICP hash at compute time — application binds to it (drift disarms
 * a learned state until the loop re-runs, the lead_scores re-score
 * discipline). `evidence_hash` makes replays structural no-ops.
 */
export const leadWeightStates = pgTable(
  "lead_weight_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    profileHash: text("profile_hash").notNull(),
    /** Hash of {multipliers, evidence} — the structural idempotence key. */
    evidenceHash: text("evidence_hash").notNull(),
    /** Per-signal positive multipliers on the resolved weights (contracts leadWeightMultipliersSchema); 1 = neutral. */
    multipliers: jsonb("multipliers").notNull(),
    /** One readable line per signal (and per dealbreaker term) — WHY each weight moved or held. */
    reasons: jsonb("reasons").notNull().default([]),
    /** Counts, posteriors, Wilson bounds — the numbers behind the reasons. */
    evidence: jsonb("evidence").notNull().default({}),
    /** The learn job's clock (deterministic, passed in — never read in core). */
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Replaying the loop over the same verdicts appends nothing —
    // idempotency made structural (the lead_scores convention).
    uniqueIndex("lead_weight_states_tenant_profile_evidence_idx").on(
      t.tenantId,
      t.profileHash,
      t.evidenceHash,
    ),
    // Hot path: the scoring job's latest-state-for-current-profile read.
    index("lead_weight_states_tenant_profile_computed_idx").on(
      t.tenantId,
      t.profileHash,
      t.computedAt,
    ),
  ],
);
