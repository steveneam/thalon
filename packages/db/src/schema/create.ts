import { CREATE_FAMILIES, CREATE_RUN_STATUSES } from "@thalon/contracts";
import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { tenantIsolation } from "./rls";
import { tenants } from "./tenancy";

const inList = (values: readonly string[]) => values.map((v) => `'${v}'`).join(", ");

/**
 * s87 window (B-create.1): ONE row per Create run — the record that makes
 * "Brief → Plan → Generate → Composer → Approve" a thing the product can
 * point at, rather than five generation doors that each remember their own
 * half. Charter: `docs/create-engine/spec.md` (APPROVED) R1.
 *
 * **What this table deliberately does NOT hold**, because each already has a
 * home and a second copy would drift from it:
 *
 *  - the drafts (they hang off `fanout_runs` as they always have),
 *  - the brand profile id/version (the child fan-out row records the
 *    provenance an eval reads; recording it twice invites the two to
 *    disagree),
 *  - anything the judge decides (judging stays inside the family engines —
 *    the orchestrator dispatches, it never gates).
 *
 * It holds the operator's ASK (`brief`), what we resolved that into
 * (`plan`), and what came back (`children`). That is the whole job.
 */
export const createRuns = pgTable(
  "create_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    /** Output family from contracts CREATE_FAMILIES — the dispatch key, hence a closed check. */
    family: text("family").notNull(),
    /** `prompt` | `wizard` — which door authored the brief (contracts CREATE_MODES). */
    mode: text("mode").notNull(),
    /** The operator's ask, validated at the write door (contracts createBriefSchema). */
    brief: jsonb("brief").notNull().default({}),
    /** What derivation resolved the brief into — platforms, gates, cost preview (createPlanSchema). */
    plan: jsonb("plan").notNull().default({}),
    /** `{kind, id, error?}[]` — what the dispatch produced (createChildRefsSchema). */
    children: jsonb("children").notNull().default([]),
    /**
     * Lifecycle word from CREATE_RUN_STATUSES. Operator telemetry only — the
     * `fanout_runs.status` doctrine verbatim: nothing branches on it, so its
     * writer validates the word and audits the change but enforces no
     * transition graph. Bookkeeping must never veto a live run.
     */
    status: text("status").notNull().default("pending"),
    /** The last irrecoverable failure on the RUN itself (per-child failures ride `children[].error`). */
    lastError: text("last_error"),
    /**
     * The idempotency anchor (the `fanout_runs.generation_key` pattern, and
     * for a sharper reason here): a Create run SPENDS — video mints, metered
     * gateway calls. Without a key, a double-clicked Generate is a doubled
     * bill with two runs to reconcile. Derived by the orchestrator from the
     * brief; a replay returns the original row untouched.
     */
    generationKey: text("generation_key").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // The "Latest runs" read on Create home, and the Runs surface.
    index("create_runs_tenant_created_idx").on(t.tenantId, t.createdAt),
    check("create_runs_family_check", sql.raw(`family in (${inList(CREATE_FAMILIES)})`)),
    check("create_runs_status_check", sql.raw(`status in (${inList(CREATE_RUN_STATUSES)})`)),
    tenantIsolation(),
  ],
);
