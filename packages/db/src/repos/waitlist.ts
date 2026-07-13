import type { TenantCtx } from "@thalon/contracts";
import { and, asc, count, eq, max } from "drizzle-orm";
import { waitlist } from "../schema";
import type { Db } from "../types";
import { appendEvent } from "./events";

/** One waitlist signup (B6.1) — the landing page's first user-facing write path. */
export type WaitlistEntry = typeof waitlist.$inferSelect;

export interface JoinWaitlistInput {
  email: string;
  /** This entry's own shareable code — caller-generated, opaque. */
  referralCode: string;
  /** waitlist.id of the entry whose referral link brought this signup. */
  referredBy?: string;
}

export function waitlistRepo(db: Db) {
  return {
    /**
     * Idempotent on the structural key `(tenant, email)`: signing up twice
     * returns the EXISTING entry (its original code and position) with
     * `created: false` — the landing API needs no pre-read. `position` is
     * assigned max+1 in the same transaction. Only the email index is the
     * conflict arbiter, so a caller-generated referral-code collision
     * surfaces as the raw unique violation — loud, never silently attaching
     * the signup to someone else's code; the caller regenerates and retries.
     */
    async join(
      ctx: TenantCtx,
      input: JoinWaitlistInput,
    ): Promise<{ entry: WaitlistEntry; created: boolean }> {
      return db.transaction(async (tx) => {
        const [{ maxPosition }] = await tx
          .select({ maxPosition: max(waitlist.position) })
          .from(waitlist)
          .where(eq(waitlist.tenantId, ctx.tenantId));
        const [inserted] = await tx
          .insert(waitlist)
          .values({
            tenantId: ctx.tenantId,
            email: input.email,
            referralCode: input.referralCode,
            referredBy: input.referredBy ?? null,
            position: (maxPosition ?? 0) + 1,
          })
          .onConflictDoNothing({ target: [waitlist.tenantId, waitlist.email] })
          .returning();
        if (!inserted) {
          const [existing] = await tx
            .select()
            .from(waitlist)
            .where(and(eq(waitlist.tenantId, ctx.tenantId), eq(waitlist.email, input.email)))
            .limit(1);
          if (!existing) {
            throw new Error(
              `waitlist join for tenant ${ctx.tenantId} conflicted on email but cannot be read back — cross-tenant key collision?`,
            );
          }
          return { entry: existing, created: false };
        }
        await appendEvent(tx, ctx, {
          entityType: "waitlist",
          entityId: inserted.id,
          event: "waitlist.joined",
          payload: { position: inserted.position, referred: inserted.referredBy !== null },
        });
        return { entry: inserted, created: true };
      });
    },

    async getByEmail(ctx: TenantCtx, email: string): Promise<WaitlistEntry | null> {
      const [row] = await db
        .select()
        .from(waitlist)
        .where(and(eq(waitlist.tenantId, ctx.tenantId), eq(waitlist.email, email)))
        .limit(1);
      return row ?? null;
    },

    /** Resolves an incoming referral link to the referring entry. */
    async getByReferralCode(ctx: TenantCtx, code: string): Promise<WaitlistEntry | null> {
      const [row] = await db
        .select()
        .from(waitlist)
        .where(and(eq(waitlist.tenantId, ctx.tenantId), eq(waitlist.referralCode, code)))
        .limit(1);
      return row ?? null;
    },

    /** Referral tally for one entry — the effective-position ("skip the line") math runs in core over this. */
    async countReferrals(ctx: TenantCtx, id: string): Promise<number> {
      const [{ value }] = await db
        .select({ value: count() })
        .from(waitlist)
        .where(and(eq(waitlist.tenantId, ctx.tenantId), eq(waitlist.referredBy, id)));
      return value;
    },

    /** All entries in join order — the B-crm.1 waitlist→leads bridge's read. */
    async list(ctx: TenantCtx): Promise<WaitlistEntry[]> {
      return db
        .select()
        .from(waitlist)
        .where(eq(waitlist.tenantId, ctx.tenantId))
        .orderBy(asc(waitlist.position));
    },

    /** Total queue length for the tenant. */
    async count(ctx: TenantCtx): Promise<number> {
      const [{ value }] = await db
        .select({ value: count() })
        .from(waitlist)
        .where(eq(waitlist.tenantId, ctx.tenantId));
      return value;
    },
  };
}

export type WaitlistRepo = ReturnType<typeof waitlistRepo>;
