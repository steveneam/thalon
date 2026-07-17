import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMemoryDbClient } from "@thalon/platform";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import * as schema from "../schema";
import { withTenantSession } from "../tenant-session";
import type { Db } from "../types";
import { runRlsIsolationChecks } from "./rls-harness";

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "drizzle",
);

/**
 * Tenancy isolation under migration 0013's policies, proven on PGlite (real
 * Postgres under the hood; PGlite's own session user is the `postgres`
 * superuser, so the harness switches to a created non-owner role — the only
 * kind of role the policies bind, per 0013's honest-scope header). The same
 * harness runs against a real server in pg-scratch.test.ts (gated).
 */
describe("RLS tenancy isolation (PGlite, enforcing role)", () => {
  it("blocks cross-tenant SELECT/UPDATE/DELETE/INSERT; withTenantSession is the only unlock", async () => {
    const client = createMemoryDbClient();
    try {
      const pglite = drizzle(client, { schema });
      await migrate(pglite, { migrationsFolder });
      await runRlsIsolationChecks(pglite as unknown as Db, { role: "rls_probe" });
    } finally {
      await client.close();
    }
  }, 60_000);

  it("withTenantSession refuses an empty tenant id (deny loud, not fail open)", async () => {
    const client = createMemoryDbClient();
    try {
      const pglite = drizzle(client, { schema });
      await migrate(pglite, { migrationsFolder });
      await expect(
        withTenantSession(pglite as unknown as Db, { tenantId: "" }, async () => "unreachable"),
      ).rejects.toThrow(/non-empty tenantId/);
    } finally {
      await client.close();
    }
  }, 60_000);
});
