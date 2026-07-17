import { sql } from "drizzle-orm";
import { pgPolicy } from "drizzle-orm/pg-core";

/**
 * The session setting the RLS policies key on. Pinned transaction-locally by
 * DbHandle.withTenantSession (src/tenant-session.ts) — never session-globally,
 * because pooled connections are shared across tenants.
 */
export const TENANT_SESSION_SETTING = "app.tenant_id";

/**
 * Missing or empty setting ⇒ NULL ⇒ the comparison is never true — an
 * enforcing role with no tenant context sees and writes NOTHING. Deny by
 * default, never fail open.
 */
const sessionTenantId = sql.raw(
  `(nullif(current_setting('${TENANT_SESSION_SETTING}', true), ''))::uuid`,
);

/**
 * Tenancy RLS ratchet — INVARIANT class (never loosened). Every tenant-scoped
 * table attaches this policy; the executable list lives in
 * __tests__/rls-ratchet.test.ts with the three exemptions and their reasons
 * (tenants: identity anchor, pre-context by definition; llm_cache /
 * retrieval_cache: content-addressed cross-tenant caches by documented
 * design — see repos/caches.ts).
 *
 * HONEST ENFORCEMENT SCOPE: a policy binds only roles that neither own the
 * table nor hold SUPERUSER/BYPASSRLS. Dev PGlite runs as the `postgres`
 * superuser and the dev server driver connects as the table owner, so in
 * both of today's environments this is a latent second belt — primary
 * enforcement remains the TenantCtx repo layer (contracts/src/tenant.ts).
 * It bites the moment the app connects as a dedicated non-owner role (the
 * staging/production posture). FORCE ROW LEVEL SECURITY is deliberately NOT
 * set: the app does not yet pin app.tenant_id on its connections, so FORCE
 * would zero out owner-connection reads; turning it on after the app-side
 * wiring is the next ratchet turn — a one-line ALTER per table, never the
 * reverse.
 */
export function tenantIsolation() {
  return pgPolicy("tenant_isolation", {
    as: "permissive",
    for: "all",
    using: sql`tenant_id = ${sessionTenantId}`,
    withCheck: sql`tenant_id = ${sessionTenantId}`,
  });
}
