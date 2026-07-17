import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMemoryDbClient } from "@thalon/platform";
import { getTableName, is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../schema";
import type { Db } from "../types";

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "drizzle",
);

/**
 * RLS ratchet — INVARIANT class (tenancy; never loosened), the executable
 * side of migration 0013: every table in the schema barrel must carry
 * ENABLE ROW LEVEL SECURITY plus the tenant_isolation policy, checked
 * against the live catalog of a migrated database. Adding a table without
 * `tenantIsolation()` in its extras fails here by design. Exemptions are
 * deliberate, review-visible decisions with their reasons on record — the
 * tenant-id.test.ts exemption-map convention.
 */
const RLS_EXEMPT: Record<string, string> = {
  tenants: "identity anchor — slug→tenant resolution must precede tenant context",
  llm_cache: "content-addressed cross-tenant cache by documented design (repos/caches.ts)",
  retrieval_cache: "content-addressed cross-tenant cache by documented design (repos/caches.ts)",
};

function rows(res: unknown): Record<string, unknown>[] {
  return (res as { rows: Record<string, unknown>[] }).rows;
}

describe("RLS ratchet (invariant: tenancy)", () => {
  const tableNames = Object.values(schema)
    .filter((v) => is(v, PgTable))
    .map((t) => getTableName(t as PgTable));
  let client: ReturnType<typeof createMemoryDbClient>;
  let db: Db;
  let catalog: Map<string, { rls: boolean; force: boolean }>;
  let policies: { table: string; name: string; cmd: string; qual: string; withCheck: string }[];

  beforeAll(async () => {
    client = createMemoryDbClient();
    const pglite = drizzle(client, { schema });
    await migrate(pglite, { migrationsFolder });
    db = pglite as unknown as Db;
    catalog = new Map(
      rows(
        await db.execute(sql`
          select c.relname as name, c.relrowsecurity as rls, c.relforcerowsecurity as force
          from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r'
        `),
      ).map((r) => [String(r.name), { rls: Boolean(r.rls), force: Boolean(r.force) }]),
    );
    policies = rows(
      await db.execute(sql`
        select tablename, policyname, cmd, qual, with_check
        from pg_policies where schemaname = 'public'
      `),
    ).map((r) => ({
      table: String(r.tablename),
      name: String(r.policyname),
      cmd: String(r.cmd),
      qual: String(r.qual),
      withCheck: String(r.with_check),
    }));
  }, 60_000);

  afterAll(async () => {
    await client.close();
  });

  it("every non-exempt table has row security enabled with the tenant_isolation policy", () => {
    for (const name of tableNames) {
      const cat = catalog.get(name);
      expect(cat, `table "${name}" missing from the migrated catalog`).toBeTruthy();
      if (RLS_EXEMPT[name]) continue;
      expect(
        cat?.rls,
        `table "${name}" must have ROW LEVEL SECURITY enabled — add tenantIsolation() to its extras (schema/rls.ts), or exempt it here WITH a reason`,
      ).toBe(true);
      const pol = policies.find((p) => p.table === name && p.name === "tenant_isolation");
      expect(pol, `table "${name}" must carry the tenant_isolation policy`).toBeTruthy();
      expect(pol?.cmd, `"${name}" policy must cover ALL commands`).toBe("ALL");
      expect(pol?.qual, `"${name}" USING must key on the session tenant`).toMatch(/app\.tenant_id/);
      expect(pol?.withCheck, `"${name}" WITH CHECK must key on the session tenant`).toMatch(
        /app\.tenant_id/,
      );
    }
  });

  it("exempt tables stay fully RLS-disabled (half-enabling without a policy would deny everything)", () => {
    for (const name of Object.keys(RLS_EXEMPT)) {
      expect(tableNames, `stale exemption "${name}" — table no longer exists`).toContain(name);
      expect(catalog.get(name)?.rls, `"${name}" is exempt (${RLS_EXEMPT[name]})`).toBe(false);
      expect(policies.some((p) => p.table === name)).toBe(false);
    }
  });

  it("FORCE row security stays OFF until the app pins app.tenant_id on its connections", () => {
    // Flipping FORCE on (once the app-side session wiring lands) is the next
    // deliberate ratchet turn — update this expectation in that same change.
    // Until then FORCE would zero out owner-connection reads (0013 header).
    for (const name of tableNames) {
      expect(catalog.get(name)?.force, `"${name}" must not FORCE row security yet`).toBe(false);
    }
  });

  it("no stray policies exist beyond the tenant_isolation set", () => {
    for (const p of policies) {
      expect(p.name, `unexpected policy "${p.name}" on "${p.table}"`).toBe("tenant_isolation");
      expect(tableNames).toContain(p.table);
    }
  });
});
