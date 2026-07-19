import { z } from "zod";

/**
 * Sprint-8 window: the ENTITLEMENTS SEAM (founder directive s64, clarified
 * same session) — which product surfaces a tenant can see is CONFIG-DATA,
 * flippable per tier (edit the defaults map here) or per tenant (an
 * override row in `tenant_entitlements`), never a build stopper and never
 * hard-coded in feature code. Durable storage: `tenants.plan` +
 * `tenant_entitlements` (packages/db schema/tenancy.ts); the repo's
 * `getEffective` resolves override → plan default via `isEntitled` below.
 */

/**
 * The plan ladder. `internal` = the self/dogfood tenant (the founder) —
 * outside the paid ladder, entitled to everything a defaults row grants it
 * explicitly. Paid tiers ascend starter → growth → max. Marketing names are
 * a rendering concern; these are stable config keys.
 */
export const PLAN_TIERS = ["internal", "starter", "growth", "max"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];
export const planTierSchema = z.enum(PLAN_TIERS);

/**
 * Gated surfaces. Extending this list (plus a defaults row and the check
 * constraint's regenerated migration) is the WHOLE cost of gating a new
 * surface — additive by design.
 */
export const ENTITLEMENT_FEATURES = ["sites_templates", "crm", "social_publishing"] as const;
export type EntitlementFeature = (typeof ENTITLEMENT_FEATURES)[number];
export const entitlementFeatureSchema = z.enum(ENTITLEMENT_FEATURES);

/**
 * Per-tier defaults — the founder's s64 call verbatim: the landing-page
 * templates surface and the CRM component ship founder-only or highest
 * paid tier. Flipping a feature for a tier = editing this map (config
 * change, no code change anywhere else).
 */
export const DEFAULT_PLAN_ENTITLEMENTS: Record<EntitlementFeature, readonly PlanTier[]> = {
  sites_templates: ["internal", "max"],
  crm: ["internal", "max"],
  /**
   * Sprint-8 window 2: social publishing joins the ladder conservatively
   * (the founder's sites_templates/crm pattern — flip by config when the
   * Integrations surface prices it). No door reads this key yet: dogfood
   * arming is env-based self-only; the Integrations charter (Phase 2 of the
   * transition plan) gates on it.
   */
  social_publishing: ["internal", "max"],
};

/** The per-tenant override shape at the write door (repo validates before storing). */
export const entitlementOverrideSchema = z.object({
  feature: entitlementFeatureSchema,
  enabled: z.boolean(),
});
export type EntitlementOverride = z.infer<typeof entitlementOverrideSchema>;

/**
 * Effective-entitlement resolution: a tenant override always wins; absent
 * one, the tier defaults decide. Pure — both the repo and any UI badge
 * logic call this one function, so the rule cannot fork.
 */
export function isEntitled(
  plan: PlanTier,
  feature: EntitlementFeature,
  overrides: readonly EntitlementOverride[] = [],
): boolean {
  const override = overrides.find((o) => o.feature === feature);
  if (override) return override.enabled;
  return DEFAULT_PLAN_ENTITLEMENTS[feature].includes(plan);
}
