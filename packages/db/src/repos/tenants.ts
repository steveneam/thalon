import { eq } from "drizzle-orm";
import { tenants } from "../schema";
import type { Db, Tenant } from "../types";

/** Tenant provisioning is a system-level operation — the one repo without a TenantCtx argument. */
export function tenantsRepo(db: Db) {
  return {
    async create(input: { slug: string; name: string }): Promise<Tenant> {
      const [row] = await db
        .insert(tenants)
        .values({ slug: input.slug, name: input.name })
        .returning();
      return row;
    },

    /** Idempotent create — used by dev/demo seeding. */
    async ensure(input: { slug: string; name: string }): Promise<Tenant> {
      const [inserted] = await db
        .insert(tenants)
        .values({ slug: input.slug, name: input.name })
        .onConflictDoNothing({ target: tenants.slug })
        .returning();
      if (inserted) return inserted;
      const existing = await this.getBySlug(input.slug);
      if (!existing) throw new Error(`tenant "${input.slug}" vanished mid-ensure`);
      return existing;
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
