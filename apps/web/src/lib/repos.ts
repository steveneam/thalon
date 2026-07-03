import { openDb, type Repos } from "@thalon/db";

let cached: Promise<Repos> | null = null;

/** The tenant-scoped repositories are the only database API (SPINE §2.6); openDb() itself caches the underlying handle per process. */
export function getRepos(): Promise<Repos> {
  if (!cached) cached = openDb().then((handle) => handle.repos);
  return cached;
}
