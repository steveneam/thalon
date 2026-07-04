import { existsSync } from "node:fs";
import path from "node:path";
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

/**
 * Never use `new URL("<rel>", import.meta.url)` for this: Turbopack
 * statically analyzes that exact pattern (through const indirection too) and
 * fails the build trying to bundle the directory as an asset — found the
 * first time apps/web booted against the real DB path (B1.5 dogfood).
 * Plain Node (tsx CLIs, vitest) resolves relative to this source file; a
 * bundled route (apps/web) has a rewritten import.meta.url, so fall back to
 * walking up from cwd to the workspace's packages/db/drizzle.
 */
function resolveMigrationsFolder(): string {
  try {
    const fromSource = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "drizzle");
    if (existsSync(fromSource)) return fromSource;
  } catch {
    // import.meta.url is not a usable file URL in this context — fall through.
  }
  let dir = process.cwd();
  for (;;) {
    const candidate = path.join(dir, "packages", "db", "drizzle");
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        "could not locate the packages/db/drizzle migrations folder from this process (source-relative and cwd-upward lookups both failed)",
      );
    }
    dir = parent;
  }
}

const migrationsFolder = resolveMigrationsFolder();

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
