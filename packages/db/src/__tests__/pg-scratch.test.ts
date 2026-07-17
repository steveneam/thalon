import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tenantCtx } from "@thalon/contracts";
import { createMemoryDbClient } from "@thalon/platform";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { migrate as migrateNodePg } from "drizzle-orm/node-postgres/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import pg from "pg";
import { describe, expect, it } from "vitest";
import { copyAllTables } from "../migrate-data";
import { createRepos } from "../repos";
import * as schema from "../schema";
import type { Db } from "../types";
import { runRlsIsolationChecks } from "./rls-harness";

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "drizzle",
);

/**
 * Real-server proof of the 0013 RLS policies AND the PGlite→Postgres copy —
 * GATED (the pg-driver.test.ts pattern): it needs an admin role that may
 * CREATE DATABASE, CREATE ROLE, and install pgvector in a scratch database
 * (in practice a local dev superuser — the shared dev role holds neither
 * CREATEDB nor CREATEROLE, s53 verified, and MUST NOT be pointed at here):
 *
 *   THALON_RLS_PG_TEST=1 THALON_RLS_PG_ADMIN_URL=postgres://…/postgres npx vitest run pg-scratch
 *
 * Everything it creates is uniquely suffixed and dropped in cleanup: two
 * scratch databases plus one probe role. It never touches an existing
 * database — the admin connection is used only to create/drop scratch ones.
 */
const gated = process.env.THALON_RLS_PG_TEST === "1" && !!process.env.THALON_RLS_PG_ADMIN_URL;

function scratchUrl(adminUrl: string, dbName: string): string {
  const u = new URL(adminUrl);
  u.pathname = `/${dbName}`;
  return u.toString();
}

describe.skipIf(!gated)("RLS + data copy on real Postgres (gated, scratch)", () => {
  it("proves tenancy isolation and the verified copy end-to-end on a real server", async () => {
    const adminUrl = process.env.THALON_RLS_PG_ADMIN_URL as string;
    const suffix = randomBytes(4).toString("hex");
    const rlsDbName = `thalon_rls_scratch_${suffix}`;
    const copyDbName = `thalon_copy_scratch_${suffix}`;
    const probeRole = `rls_probe_${suffix}`;

    const admin = new pg.Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`create database ${rlsDbName}`);
    await admin.query(`create database ${copyDbName}`);
    try {
      // --- isolation: single-connection pool so set role / set_config stick
      {
        const pool = new pg.Pool({ connectionString: scratchUrl(adminUrl, rlsDbName), max: 1 });
        try {
          const nodeDb = drizzleNodePg(pool, { schema });
          await migrateNodePg(nodeDb, { migrationsFolder });
          await runRlsIsolationChecks(nodeDb as unknown as Db, { role: probeRole });
        } finally {
          await pool.end();
        }
      }

      // --- copy: seeded memory PGlite → empty scratch server database
      {
        const sourceClient = createMemoryDbClient();
        const pool = new pg.Pool({ connectionString: scratchUrl(adminUrl, copyDbName) });
        try {
          const sourcePglite = drizzlePglite(sourceClient, { schema });
          await migratePglite(sourcePglite, { migrationsFolder });
          const source = sourcePglite as unknown as Db;
          const repos = createRepos(source);
          const tenant = await repos.tenants.create({ slug: "pg-copy", name: "PG Copy" });
          await repos.leads.add(tenantCtx(tenant.id), {
            source: "csv",
            email: "copied@pg-copy.example",
          });
          await source
            .insert(schema.events)
            .values({ tenantId: tenant.id, entityType: "pg_copy", entityId: tenant.id, event: "x" });

          const nodeDb = drizzleNodePg(pool, { schema });
          await migrateNodePg(nodeDb, { migrationsFolder });
          const target = nodeDb as unknown as Db;

          const dry = await copyAllTables(source, target, { execute: false });
          expect(dry.ok).toBe(true);
          const wet = await copyAllTables(source, target, { execute: true });
          expect(wet.ok).toBe(true);
          expect(wet.tables.every((t) => t.verified)).toBe(true);
          const back = await target.select().from(schema.leads);
          expect(back.map((l) => l.email)).toEqual(["copied@pg-copy.example"]);
        } finally {
          await pool.end();
          await sourceClient.close();
        }
      }
    } finally {
      await admin.query(`drop database if exists ${rlsDbName} with (force)`);
      await admin.query(`drop database if exists ${copyDbName} with (force)`);
      await admin.query(`drop role if exists ${probeRole}`);
      await admin.end();
    }
  }, 180_000);
});
