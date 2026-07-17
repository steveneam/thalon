import { describe, expect, it } from "vitest";

/**
 * B0.5 real-server driver smoke — GATED (box-of-record, monthly-pass
 * entry, the THALON_FILM_REPLAY pattern): CI has no Postgres server, so
 * this runs only where one exists:
 *
 *   THALON_PG_TEST=1 DATABASE_URL=postgres://… npx vitest run pg-driver
 *
 * Read-only against the live dev database ON PURPOSE — it proves the
 * driver, the migrator (idempotent re-run), and the repo read path
 * without polluting dev data. Write-path proof is the dev workload
 * itself (same repos, same doors).
 */
const gated = process.env.THALON_PG_TEST === "1" && !!process.env.DATABASE_URL;

describe.skipIf(!gated)("postgres driver (B0.5, gated)", () => {
  it("opens the real server, migrates idempotently, and reads through repos", async () => {
    const { openDb, resetDbForTests } = await import("../client");
    const handle = await openDb();
    try {
      // Migrator ran at open (idempotent on a migrated database). A repo
      // read proves the full stack: pool → drizzle → schema → tenancy API.
      const missing = await handle.repos.tenants.getBySlug("__pg_driver_smoke_absent__");
      expect(missing).toBeNull();
      // The embedded-only export door refuses loudly on this driver.
      await expect(handle.dumpTo("/tmp/never-written.tgz")).rejects.toThrow(/pg_dump/);
    } finally {
      await resetDbForTests();
    }
  });
});
