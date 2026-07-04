import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import type { Repos } from "@thalon/db";
import { readEnv } from "@thalon/platform";

/**
 * The web app operates as one tenant per process, selected by
 * `DEMO_TENANT_SLUG` (default `"self"` — tenant #0, charter ratified decision
 * 3). B2.1: which tenant is operated on is runtime config, never code. Real
 * operator → tenant resolution (Clerk org mapping) is a later bucket.
 */
export function demoTenantSlug(): string {
  return readEnv().DEMO_TENANT_SLUG;
}

/** Returns null when the configured tenant has not been seeded yet (fresh dev db) — callers render an empty state, not an error. */
export async function resolveTenantCtx(repos: Repos): Promise<TenantCtx | null> {
  const tenant = await repos.tenants.getBySlug(demoTenantSlug());
  return tenant ? tenantCtx(tenant.id) : null;
}
