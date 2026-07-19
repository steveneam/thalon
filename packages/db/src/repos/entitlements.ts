import {
  entitlementOverrideSchema,
  isEntitled,
  planTierSchema,
  ENTITLEMENT_FEATURES,
  type EntitlementFeature,
  type PlanTier,
  type TenantCtx,
} from "@thalon/contracts";
import { and, eq } from "drizzle-orm";
import { NotFoundError } from "../errors";
import { tenantEntitlements, tenants } from "../schema";
import type { Db } from "../types";
import { appendEvent } from "./events";

/** One per-tenant override row (Sprint-8 window) — the flip switch that beats the tier default. */
export type TenantEntitlement = typeof tenantEntitlements.$inferSelect;

/** The resolved answer the app asks for: the tenant's plan + every feature's effective flag. */
export interface EffectiveEntitlements {
  plan: PlanTier;
  features: Record<EntitlementFeature, boolean>;
}

export function entitlementsRepo(db: Db) {
  return {
    /**
     * The one read the gated surfaces call. Resolution is contracts
     * `isEntitled` (override wins, else tier default) — never re-derived
     * here or in any UI.
     */
    async getEffective(ctx: TenantCtx): Promise<EffectiveEntitlements> {
      const [tenant] = await db
        .select({ plan: tenants.plan })
        .from(tenants)
        .where(eq(tenants.id, ctx.tenantId))
        .limit(1);
      if (!tenant) throw new NotFoundError("tenant", ctx.tenantId);
      const plan = planTierSchema.parse(tenant.plan);
      const overrides = await db
        .select()
        .from(tenantEntitlements)
        .where(eq(tenantEntitlements.tenantId, ctx.tenantId));
      const parsed = overrides.map((o) =>
        entitlementOverrideSchema.parse({ feature: o.feature, enabled: o.enabled }),
      );
      const features = Object.fromEntries(
        ENTITLEMENT_FEATURES.map((f) => [f, isEntitled(plan, f, parsed)]),
      ) as Record<EntitlementFeature, boolean>;
      return { plan, features };
    },

    async listOverrides(ctx: TenantCtx): Promise<TenantEntitlement[]> {
      return db
        .select()
        .from(tenantEntitlements)
        .where(eq(tenantEntitlements.tenantId, ctx.tenantId));
    },

    /**
     * Upsert one override — validated at the write door; setting the value
     * an existing row already holds is an idempotent replay (no write, no
     * event). A real change emits in the same transaction.
     */
    async setOverride(
      ctx: TenantCtx,
      input: { feature: string; enabled: boolean },
    ): Promise<TenantEntitlement> {
      const valid = entitlementOverrideSchema.parse(input);
      return db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(tenantEntitlements)
          .where(
            and(
              eq(tenantEntitlements.tenantId, ctx.tenantId),
              eq(tenantEntitlements.feature, valid.feature),
            ),
          )
          .limit(1);
        if (existing && existing.enabled === valid.enabled) return existing;
        const [row] = await tx
          .insert(tenantEntitlements)
          .values({
            tenantId: ctx.tenantId,
            feature: valid.feature,
            enabled: valid.enabled,
          })
          .onConflictDoUpdate({
            target: [tenantEntitlements.tenantId, tenantEntitlements.feature],
            set: { enabled: valid.enabled, updatedAt: new Date() },
          })
          .returning();
        await appendEvent(tx, ctx, {
          entityType: "tenant_entitlement",
          entityId: row.id,
          event: "entitlement.override_set",
          payload: { feature: valid.feature, enabled: valid.enabled },
        });
        return row;
      });
    },

    /** Remove an override — the tier default takes back over. Absent row = idempotent no-op. */
    async clearOverride(ctx: TenantCtx, feature: string): Promise<void> {
      const valid = entitlementOverrideSchema.shape.feature.parse(feature);
      await db.transaction(async (tx) => {
        const [row] = await tx
          .delete(tenantEntitlements)
          .where(
            and(
              eq(tenantEntitlements.tenantId, ctx.tenantId),
              eq(tenantEntitlements.feature, valid),
            ),
          )
          .returning();
        if (!row) return;
        await appendEvent(tx, ctx, {
          entityType: "tenant_entitlement",
          entityId: row.id,
          event: "entitlement.override_cleared",
          payload: { feature: valid },
        });
      });
    },
  };
}

export type EntitlementsRepo = ReturnType<typeof entitlementsRepo>;
