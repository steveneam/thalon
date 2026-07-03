import { mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";

export type DbClient = PGlite;

/**
 * Embedded-Postgres driver (amendment A1): one SQL dialect and one migration
 * set dev→prod, pgvector available in dev for the grounding index, and each
 * worktree/test run gets its own throwaway database. The prod driver (Aurora
 * Serverless v2 Postgres) lands with B0.5 behind the same seam.
 */
export function createDbClient(opts: { dataDir: string }): DbClient {
  const dir = path.resolve(opts.dataDir, "pg");
  mkdirSync(dir, { recursive: true });
  return new PGlite(dir, { extensions: { vector } });
}

/** Fresh in-memory database — one per test, no files to clean up. */
export function createMemoryDbClient(): DbClient {
  return new PGlite({ extensions: { vector } });
}
