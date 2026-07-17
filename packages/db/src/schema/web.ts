import { index, pgTable, text, timestamp, uniqueIndex, uuid, integer } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { tenantIsolation } from "./rls";
import { tenants } from "./tenancy";

/**
 * B6.1 (amendment A12): the landing page's waitlist — the first real
 * user-facing write path. Tenant-scoped like everything else (rule 3): a
 * signup belongs to the tenant whose landing page captured it (tenant #0
 * for Thalon's own site), so the engine stays generic — any tenant's
 * generated landing can carry a waitlist. `position` is the monotonic
 * join order per tenant; the "referrals move you up" effective ordering is
 * MATH over `referred_by` counts, computed in core at read time — the
 * stored position never mutates (docs/FRONTEND.md §2: queue position +
 * referral link, no third-party marketing tool).
 */
export const waitlist = pgTable(
  "waitlist",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    email: text("email").notNull(),
    /** This entry's own shareable referral code — caller-generated, opaque. */
    referralCode: text("referral_code").notNull(),
    /** The entry whose referral link brought this signup; null for direct signups. */
    referredBy: uuid("referred_by").references((): AnyPgColumn => waitlist.id),
    /** Join order per tenant, assigned once at insert — never rewritten. */
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Signing up twice returns the existing entry — idempotency made structural.
    uniqueIndex("waitlist_tenant_email_idx").on(t.tenantId, t.email),
    // Referral links resolve by code.
    uniqueIndex("waitlist_tenant_referral_code_idx").on(t.tenantId, t.referralCode),
    // Hot path: referral counting for the effective-position math.
    index("waitlist_tenant_referred_by_idx").on(t.tenantId, t.referredBy),
    tenantIsolation(),
  ],
);
