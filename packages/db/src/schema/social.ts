import { SOCIAL_PLATFORMS } from "@thalon/contracts";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { drafts } from "./content";
import { tenantIsolation } from "./rls";
import { tenants } from "./tenancy";

const inList = (values: readonly string[]) => values.map((v) => `'${v}'`).join(", ");

/**
 * Sprint-8 window (B-pub): the social publication ledger — the
 * outreach_sends pattern applied to platform posting. One row = one
 * platform-ACCEPTED publication of one APPROVED draft — append-only, never
 * updated; failures live in events/op errors, never here.
 *
 * Structural invariants (the reason this is a table and not meta):
 * - `(tenant_id, draft_id, platform)` UNIQUE — a draft posts to a platform
 *   at most ONCE, ever. Reposting content means a new draft through the
 *   full judge gate; a racing double-post loses the insert and FAILS LOUD
 *   (the platform call already happened — a conflict is an incident, not a
 *   replay). Cross-posting the SAME draft to different platforms remains
 *   legal by design — the platform column is part of the key.
 * - `external_post_id` + `body_hash` snapshot what actually went out —
 *   the audit answer survives later draft edits.
 * - Cadence state is DERIVED from this ledger + the tenant's social config
 *   block (contracts socialPublishConfigSchema) — deliberately no mutable
 *   cadence-state table to drift from it.
 */
export const socialPublications = pgTable(
  "social_publications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    draftId: uuid("draft_id")
      .notNull()
      .references(() => drafts.id),
    /** Destination platform (contracts SOCIAL_PLATFORMS). */
    platform: text("platform").notNull(),
    /** The platform's accepted post id — required: a row exists only for a real publication. */
    externalPostId: text("external_post_id").notNull(),
    /** Audit snapshot: hash of the judged body that went out (the I1 convention). */
    bodyHash: text("body_hash").notNull(),
    /** Platform extras (permalinks, media ids, API echoes) — data, open shape. */
    meta: jsonb("meta").notNull().default({}),
    /** The publish door's clock (deterministic, passed in — never read in core). */
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // One publication per draft per platform, ever — double-post made structurally impossible.
    uniqueIndex("social_publications_tenant_draft_platform_idx").on(
      t.tenantId,
      t.draftId,
      t.platform,
    ),
    // Hot path: the per-platform ≤cap/day count.
    index("social_publications_tenant_platform_published_idx").on(
      t.tenantId,
      t.platform,
      t.publishedAt,
    ),
    check(
      "social_publications_platform_check",
      sql.raw(`platform in (${inList(SOCIAL_PLATFORMS)})`),
    ),
    tenantIsolation(),
  ],
);
