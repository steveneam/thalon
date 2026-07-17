import { existsSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createDbClient,
  createMemoryDbClient,
  readEnv,
  resolveSeams,
  type DbClient,
} from "@thalon/platform";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { migrate as migrateNodePg } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import pg from "pg";
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
  /** Tenant-scoped repositories — the ONLY database QUERY API this package exports (SPINE §2.6). */
  repos: Repos;
  /**
   * B6.7 backup hook (ADR 0007 decision 5): writes a consistent gzip
   * tarball of the embedded database to `targetPath`. PGlite has no server
   * socket, so `pg_dump` cannot attach from outside, and a raw file-level
   * snapshot of a live data dir can be torn mid-write — the export must
   * come from the ONE process that owns the database. Temp-file + rename
   * so a concurrently running backup pass never sees a half-written dump.
   * Export-only by design — never a query side door around repos.
   */
  dumpTo(targetPath: string): Promise<{ bytes: number }>;
  close(): Promise<void>;
}

async function open(client: DbClient): Promise<DbHandle> {
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return {
    repos: createRepos(db),
    dumpTo: async (targetPath: string) => {
      const blob = await client.dumpDataDir("gzip");
      const bytes = Buffer.from(await blob.arrayBuffer());
      await mkdir(path.dirname(targetPath), { recursive: true });
      const tmpPath = `${targetPath}.tmp`;
      await writeFile(tmpPath, bytes);
      await rename(tmpPath, targetPath);
      return { bytes: bytes.byteLength };
    },
    close: () => client.close(),
  };
}

/**
 * B0.5: the real-server driver (node-postgres over DATABASE_URL). Same
 * migrations folder, same repos — only the transport differs. `dumpTo`
 * refuses LOUDLY here: a server-owned database is dumped by `pg_dump`
 * (the box's pre-backup hook does exactly that); the export door exists
 * for the EMBEDDED engine, where no external tool can attach.
 */
async function openPostgres(connectionString: string): Promise<DbHandle> {
  const pool = new pg.Pool({ connectionString });
  const db = drizzleNodePg(pool, { schema });
  await migrateNodePg(db, { migrationsFolder });
  return {
    repos: createRepos(db),
    dumpTo: async () => {
      throw new Error(
        "postgres driver: dump the server with pg_dump (backup hooks own consistency) — the in-process export door is embedded-only",
      );
    },
    close: () => pool.end(),
  };
}

let cached: Promise<DbHandle> | null = null;

/**
 * Opens (and migrates) the seam-resolved database. `DATABASE_URL` set →
 * the real Postgres server (B0.5 driver — dev daily driver on this box,
 * Aurora-shaped for later). Unset → embedded Postgres under <dataDir>/pg
 * (each worktree gets its own; tests + fresh clones stay zero-config).
 * Cached per process.
 */
export function openDb(): Promise<DbHandle> {
  if (cached) return cached;
  const seams = resolveSeams();
  if (seams.db === "postgres") {
    const url = readEnv().DATABASE_URL;
    if (!url) {
      return Promise.reject(
        new Error("db seam resolved to postgres but DATABASE_URL is empty — seam/env mismatch"),
      );
    }
    cached = openPostgres(url);
    return cached;
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
