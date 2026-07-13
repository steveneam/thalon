import { APPROVAL_ACTIONS, VERDICTS } from "@thalon/contracts";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { drafts } from "./content";
import { tenants } from "./tenancy";

const inList = (values: readonly string[]) =>
  values.map((v) => `'${v}'`).join(", ");

/**
 * Append-only. Verdicts bind to CONTENT (`body_hash`), not just draft id —
 * editing a draft invalidates its verdicts (invariant I1; SPINE risk 5).
 * `gate` is open-ended text so G2/G4/G5 need zero migrations later.
 */
export const judgeResults = pgTable(
  "judge_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    draftId: uuid("draft_id")
      .notNull()
      .references(() => drafts.id),
    gate: text("gate").notNull(),
    verdict: text("verdict").notNull(),
    bodyHash: text("body_hash").notNull(),
    /** Per-claim structured verdicts (contracts judgeEvidenceSchema). */
    evidence: jsonb("evidence").notNull().default({}),
    model: text("model"),
    promptVersion: text("prompt_version"),
    latencyMs: integer("latency_ms"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("judge_results_draft_hash_idx").on(t.draftId, t.bodyHash),
    check("judge_results_verdict_check", sql.raw(`verdict in (${inList(VERDICTS)})`)),
  ],
);

/** Append-only operator decisions. */
export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    draftId: uuid("draft_id")
      .notNull()
      .references(() => drafts.id),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    editedBody: text("edited_body"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("approvals_tenant_created_idx").on(t.tenantId, t.createdAt),
    check("approvals_action_check", sql.raw(`action in (${inList(APPROVAL_ACTIONS)})`)),
  ],
);

/** Captured on EVERY operator touch — the dominant training signal pre-audience (SPINE §4.3). */
export const editDiffs = pgTable(
  "edit_diffs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    draftId: uuid("draft_id")
      .notNull()
      .references(() => drafts.id),
    approvalId: uuid("approval_id")
      .notNull()
      .references(() => approvals.id),
    beforeHash: text("before_hash").notNull(),
    afterHash: text("after_hash").notNull(),
    diff: text("diff").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("edit_diffs_tenant_created_idx").on(t.tenantId, t.createdAt)],
);

/** An edit_diffs insert creates its eval row in the SAME transaction — "every override becomes an eval row" as a mechanism, not a habit. */
export const evalCases = pgTable(
  "eval_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    kind: text("kind").notNull(),
    input: jsonb("input").notNull(),
    expected: jsonb("expected").notNull(),
    origin: text("origin").notNull(),
    sourceRef: text("source_ref"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("eval_cases_tenant_created_idx").on(t.tenantId, t.createdAt),
    // B6.7 (carried from ADR 0005): 'intel_dismiss' = the intel-triage
    // learning door — mechanism-written from an operator dismissal, its own
    // origin by design (disguising it as 'manual' would corrupt the
    // taxonomy separating mechanism-written from human-authored rows).
    // 'lead_triage' (B-crm.2, window-1a amendment): the leads-queue door —
    // operator dismiss/pin of a ranked lead, same taxonomy honesty rule.
    check(
      "eval_cases_origin_check",
      sql.raw(`origin in ('edit_diff', 'golden', 'manual', 'intel_dismiss', 'lead_triage')`),
    ),
  ],
);
