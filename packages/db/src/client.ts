import { fileURLToPath } from "node:url";
import {
  createDbClient,
  createMemoryDbClient,
  resolveSeams,
  type DbClient,
} from "@thalon/platform";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { createRepos, type Repos } from "./repos";
import * as schema from "./schema";

// Resolved relative to this source file; revisit if a bundler ever consumes
// openDb directly (apps/web reaches the db only through engine/judge services,
// which run in Node).
const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

export interface DbHandle {
  /** Tenant-scoped repositories — the ONLY database API this package exports (SPINE §2.6). */
  repos: Repos;
  close(): Promise<void>;
}

async function open(client: DbClient): Promise<DbHandle> {
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return {
    repos: createRepos(db),
    close: () => client.close(),
  };
}

let cached: Promise<DbHandle> | null = null;

/**
 * Opens (and migrates) the seam-resolved database: embedded Postgres under
 * <dataDir>/pg in dev — each worktree gets its own — Aurora once B0.5 wires
 * the prod driver. Cached per process.
 */
export function openDb(): Promise<DbHandle> {
  if (cached) return cached;
  const seams = resolveSeams();
  if (seams.db === "postgres") {
    return Promise.reject(
      new Error(
        "DATABASE_URL is set but the Aurora/Postgres driver lands with B0.5. Unset DATABASE_URL to use the embedded dev database.",
      ),
    );
  }
  cached = open(createDbClient({ dataDir: seams.dataDir }));
  return cached;
}

/** Fresh, fully-migrated in-memory database — one per test, close() when done. */
export function openTestDb(): Promise<DbHandle> {
  return open(createMemoryDbClient());
}

export async function resetDbForTests(): Promise<void> {
  const pending = cached;
  cached = null;
  if (pending) await (await pending).close();
}
