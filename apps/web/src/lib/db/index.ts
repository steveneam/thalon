import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { resolveSeams } from "@/lib/env";

export type ThalonDb = BetterSQLite3Database;

let cached: ThalonDb | null = null;
let cachedSqlite: Database.Database | null = null;

/**
 * Database seam: sqlite (dev, zero-config file at <dataDir>/dev.db) → postgres/Aurora
 * (prod). The postgres driver lands with the schema bucket (B0.3) and AWS bootstrap
 * (B0.5); until then a set DATABASE_URL fails loud rather than silently using sqlite.
 */
export function getDb(): ThalonDb {
  if (cached) return cached;
  const seams = resolveSeams();
  if (seams.db === "postgres") {
    throw new Error(
      "DATABASE_URL is set but the postgres/Aurora driver is not wired yet (lands with B0.3/B0.5). Unset DATABASE_URL to use the sqlite dev seam.",
    );
  }
  const dir = path.resolve(seams.dataDir);
  mkdirSync(dir, { recursive: true });
  const sqlite = new Database(path.join(dir, "dev.db"));
  sqlite.pragma("journal_mode = WAL");
  cachedSqlite = sqlite;
  cached = drizzle(sqlite);
  return cached;
}

/** Closes the sqlite handle too — Windows can't delete a dir with an open db file. */
export function resetDbForTests(): void {
  cachedSqlite?.close();
  cachedSqlite = null;
  cached = null;
}
