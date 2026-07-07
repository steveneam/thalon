import { openDb, type DbHandle, type Repos } from "@thalon/db";

let cached: Promise<DbHandle> | null = null;

/** The process-cached db handle — routes that need more than repos (today: only the backup dump hook) go through here so tests can swap ONE accessor. */
export function getDbHandle(): Promise<DbHandle> {
  if (!cached) cached = openDb();
  return cached;
}

/** The tenant-scoped repositories are the only database QUERY API (SPINE §2.6). */
export function getRepos(): Promise<Repos> {
  return getDbHandle().then((handle) => handle.repos);
}
