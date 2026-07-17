import type { TenantCtx } from "@thalon/contracts";
import { sql } from "drizzle-orm";
import { createRepos, type Repos } from "./repos";
import { TENANT_SESSION_SETTING } from "./schema/rls";
import type { Db } from "./types";

export { TENANT_SESSION_SETTING };

/**
 * The 0013 RLS second belt's write-side mechanism: runs `fn` inside a
 * transaction whose `app.tenant_id` setting is pinned to the ctx tenant —
 * transaction-locally (`set_config(..., true)`), because pooled connections
 * are shared across tenants and a session-global setting would leak between
 * requests. The repos handed to `fn` are bound to that transaction, so every
 * statement inside carries the session tenant; under an RLS-enforcing role
 * the database itself then refuses cross-tenant rows, doubling the TenantCtx
 * scoping the repos already apply (contracts/src/tenant.ts).
 *
 * Adopting this wrapper is incremental by design: repos called the plain way
 * keep working (owner/superuser connections bypass the policies — see
 * migration 0013's header for the honest enforcement scope).
 */
export async function withTenantSession<T>(
  db: Db,
  ctx: TenantCtx,
  fn: (repos: Repos) => Promise<T>,
): Promise<T> {
  if (!ctx.tenantId) throw new Error("withTenantSession requires a non-empty tenantId");
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config(${TENANT_SESSION_SETTING}, ${ctx.tenantId}, true)`,
    );
    return fn(createRepos(tx));
  });
}
