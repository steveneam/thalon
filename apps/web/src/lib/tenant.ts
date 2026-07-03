import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import type { Repos } from "@thalon/db";

/**
 * Sprint-1 dogfood tenant (charter ratified decision 3: tenant #0 = self/demo,
 * matching the `slug: "self"` convention seeded by the B0.4 test fixtures).
 * Real operator -> tenant resolution (Clerk org mapping) is a later bucket;
 * this hardcode is scoped to apps/web only and easy to replace with one.
 */
const DEMO_TENANT_SLUG = "self";

/** Returns null when the demo tenant has not been seeded yet (fresh dev db) — callers render an empty state, not an error. */
export async function resolveTenantCtx(repos: Repos): Promise<TenantCtx | null> {
  const tenant = await repos.tenants.getBySlug(DEMO_TENANT_SLUG);
  return tenant ? tenantCtx(tenant.id) : null;
}
