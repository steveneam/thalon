import { pathToFileURL } from "node:url";
import { resolveDraftFormatSpec, tenantCtx } from "@thalon/contracts";
import { openDb, type Repos } from "@thalon/db";
import { findOrphans, getObjectStore, type ObjectStore } from "@thalon/platform";
import { assertSoleDbWriter, loadEnvLocal, useWebAppDataDir } from "./env-local";

/**
 * B4.6 orphan sweep — the documented GC stance's executable half (the
 * stance itself lives in @thalon/platform/object-keys.ts, the one file
 * every key passes through). Collects every object-store ref the db still
 * points at — across EVERY tenant — and reports keys nothing references.
 *
 *   npm run -w @thalon/eval sweep              # dry-run: report only
 *   npm run -w @thalon/eval sweep -- --delete  # actually delete orphans
 *
 * `embeddings/` is a protected cache family: evict-safe by construction but
 * swept only by explicit human decision, never by this tool.
 */

/** `sweeps/` (B6.5) is a mutable latest-sweep pointer per tenant — no db row references it by design, so orphan math must never see it. */
const PROTECTED_PREFIXES = ["embeddings/", "sweeps/"] as const;
const SHA256_TAIL = /[0-9a-f]{64}$/;

export async function collectReferencedRefs(repos: Repos): Promise<Set<string>> {
  const referenced = new Set<string>();
  const add = (ref: unknown) => {
    if (typeof ref !== "string" || ref.length === 0) return;
    referenced.add(ref);
    // A prefix-directory artifact (renders/pillar/<hash>/manifest.json) keeps
    // its sibling files alive through the content-addressed parent prefix.
    const dir = ref.slice(0, ref.lastIndexOf("/"));
    if (SHA256_TAIL.test(dir)) referenced.add(dir);
  };

  for (const tenant of await repos.tenants.list()) {
    const ctx = tenantCtx(tenant.id);
    for (const source of await repos.sources.list(ctx)) add(source.rawRef);
    for (const run of await repos.fanoutRuns.list(ctx, { limit: 100_000 })) {
      for (const draft of await repos.drafts.listByRun(ctx, run.id)) {
        const spec = resolveDraftFormatSpec(draft.format);
        const meta = (draft.meta ?? {}) as Record<string, unknown>;
        for (const field of spec.artifactRefFields) add(meta[field]);
      }
    }
  }
  return referenced;
}

export async function sweepObjectStore(
  repos: Repos,
  store: ObjectStore,
  opts: { deleteOrphans?: boolean } = {},
): Promise<{ total: number; referenced: number; orphans: string[]; deleted: number }> {
  const referenced = await collectReferencedRefs(repos);
  const allKeys = await store.list("");
  const orphans = findOrphans(allKeys, referenced, {
    protectedPrefixes: [...PROTECTED_PREFIXES],
  });
  let deleted = 0;
  if (opts.deleteOrphans) {
    for (const key of orphans) {
      await store.delete(key);
      deleted++;
    }
  }
  return { total: allKeys.length, referenced: referenced.size, orphans, deleted };
}

async function main(): Promise<void> {
  const deleteOrphans = process.argv.includes("--delete");
  loadEnvLocal();
  useWebAppDataDir();
  await assertSoleDbWriter();
  const handle = await openDb();
  try {
    const result = await sweepObjectStore(handle.repos, getObjectStore(), { deleteOrphans });
    console.log(
      `object-store sweep: ${result.total} key(s) in store, ${result.referenced} ref(s) held by the db, ${result.orphans.length} orphan(s)` +
        ` (protected: ${PROTECTED_PREFIXES.join(", ")})`,
    );
    for (const key of result.orphans) console.log(`  ${deleteOrphans ? "deleted" : "orphan"}: ${key}`);
    if (!deleteOrphans && result.orphans.length > 0) {
      console.log("dry-run only — re-run with `-- --delete` to remove them.");
    }
  } finally {
    await handle.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
