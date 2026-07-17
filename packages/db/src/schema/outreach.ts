import { OUTREACH_SEND_PROVIDERS } from "@thalon/contracts";
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
} from "drizzle-orm/pg-core";
import { drafts } from "./content";
import { leads } from "./leads";
import { tenantIsolation } from "./rls";
import { tenants } from "./tenancy";

const inList = (values: readonly string[]) => values.map((v) => `'${v}'`).join(", ");

/**
 * B-crm.4 back half (s54 window): the send ledger. One row = one
 * provider-ACCEPTED send of one APPROVED outreach draft — append-only,
 * never updated; failures live in events/op errors, never here.
 *
 * Structural invariants (the reason this is a table and not meta):
 * - `(tenant_id, draft_id)` UNIQUE — a draft is sent at most ONCE, ever.
 *   Re-sending content means a new draft through the full judge gate; a
 *   racing double-send loses the insert and FAILS LOUD (the waitlist
 *   collision convention, not idempotent replay — the provider call
 *   already happened, so a conflict is an incident, not a replay).
 * - `recipient_email` + `body_hash` snapshot what actually left at send
 *   time — the audit answer to "what did we send them" survives any later
 *   draft/lead edits.
 * - Cadence state (which touch is next, when due) is DERIVED from this
 *   ledger + the tenant's `outreach` config block — there is deliberately
 *   no mutable cadence-state table to drift from it. `touch_index` records
 *   which touch a send WAS; the ≤cap/day count reads `(tenant_id, sent_at)`.
 */
export const outreachSends = pgTable(
  "outreach_sends",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id),
    draftId: uuid("draft_id")
      .notNull()
      .references(() => drafts.id),
    /** Who carried it (contracts OUTREACH_SEND_PROVIDERS — the s28 Resend decision). */
    provider: text("provider").notNull(),
    /** The provider's accepted-message id — required: a row exists only for a real send. */
    providerMessageId: text("provider_message_id").notNull(),
    /** Audit snapshot: the address the message actually went to, at send time. */
    recipientEmail: text("recipient_email").notNull(),
    /** Audit snapshot: hash of the judged body that went out (the I1 convention). */
    bodyHash: text("body_hash").notNull(),
    /** Which cadence touch this send was (0-based; D0 = 0). */
    touchIndex: integer("touch_index").notNull().default(0),
    /** Provider extras (batch tags, idempotency echoes) — data, open shape. */
    meta: jsonb("meta").notNull().default({}),
    /** The send door's clock (deterministic, passed in — never read in core). */
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // One send per draft, ever — double-send made structurally impossible.
    uniqueIndex("outreach_sends_tenant_draft_idx").on(t.tenantId, t.draftId),
    // Hot path: the ≤cap/day batch count.
    index("outreach_sends_tenant_sent_idx").on(t.tenantId, t.sentAt),
    // Hot path: cadence derivation — a lead's touch history in send order.
    index("outreach_sends_tenant_lead_sent_idx").on(t.tenantId, t.leadId, t.sentAt),
    check("outreach_sends_provider_check", sql.raw(`provider in (${inList(OUTREACH_SEND_PROVIDERS)})`)),
    tenantIsolation(),
  ],
);
