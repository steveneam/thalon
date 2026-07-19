import { planTierSchema, type PlanTier } from "@thalon/contracts";
import { eq } from "drizzle-orm";
import { NotFoundError } from "../errors";
import { tenants } from "../schema";
import type { Db, Tenant } from "../types";
import { appendEvent } from "./events";

/** Tenant provisioning is a system-level operation — the one repo without a TenantCtx argument. */
export function tenantsRepo(db: Db) {
  return {
    /**
     * NEW tenants default to the LOWEST paid tier — the schema column's
     * `internal` default exists only for the pre-window backfill (every
     * pre-Sprint-8 row is the self/dogfood tenant). Entitlement to gated
     * surfaces is then plan defaults + per-tenant overrides (entitlements
     * repo), never code.
     */
    async create(input: { slug: string; name: string; plan?: PlanTier }): Promise<Tenant> {
      const plan = planTierSchema.parse(input.plan ?? "starter");
      const [row] = await db
        .insert(tenants)
        .values({ slug: input.slug, name: input.name, plan })
        .returning();
      return row;
    },

    /** Idempotent create — used by dev/demo seeding. An existing row keeps its plan. */
    async ensure(input: { slug: string; name: string; plan?: PlanTier }): Promise<Tenant> {
      const plan = planTierSchema.parse(input.plan ?? "starter");
      const [inserted] = await db
        .insert(tenants)
        .values({ slug: input.slug, name: input.name, plan })
        .onConflictDoNothing({ target: tenants.slug })
        .returning();
      if (inserted) return inserted;
      const existing = await this.getBySlug(input.slug);
      if (!existing) throw new Error(`tenant "${input.slug}" vanished mid-ensure`);
      return existing;
    },

    /**
     * The tier flip (system-level admin door). Same-value writes are
     * idempotent replays (no write, no event); a real change emits into
     * the changed tenant's own event stream in the same transaction.
     */
    async setPlan(id: string, plan: PlanTier): Promise<Tenant> {
      const valid = planTierSchema.parse(plan);
      return db.transaction(async (tx) => {
        const [existing] = await tx.select().from(tenants).where(eq(tenants.id, id)).limit(1);
        if (!existing) throw new NotFoundError("tenant", id);
        if (existing.plan === valid) return existing;
        const [row] = await tx
          .update(tenants)
          .set({ plan: valid })
          .where(eq(tenants.id, id))
          .returning();
        await appendEvent(
          tx,
          { tenantId: id },
          {
            entityType: "tenant",
            entityId: id,
            event: "tenant.plan_changed",
            payload: { from: existing.plan, to: valid },
          },
        );
        return row;
      });
    },

    /** B4.6: system-level enumeration for the object-store orphan sweep (refs must be collected across EVERY tenant before anything is called an orphan). */
    async list(): Promise<Tenant[]> {
      return db.select().from(tenants);
    },

    async getBySlug(slug: string): Promise<Tenant | null> {
      const [row] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.slug, slug))
        .limit(1);
      return row ?? null;
    },
  };
}

export type TenantsRepo = ReturnType<typeof tenantsRepo>;
