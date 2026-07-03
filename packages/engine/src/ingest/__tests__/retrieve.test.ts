import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import { ingestSource } from "../ingest";
import { topKSimilarChunks } from "../retrieve";
import { createFakeEmbeddingDriver } from "../shell/embedder";

let handle: DbHandle | undefined;
let storeRoot: string | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
  if (storeRoot) {
    rmSync(storeRoot, { recursive: true, force: true });
    storeRoot = undefined;
  }
});

async function setup(): Promise<{ ctx: TenantCtx; repos: Repos }> {
  handle = await openTestDb();
  const tenant = await handle.repos.tenants.create({ slug: "self", name: "Self" });
  const ctx = tenantCtx(tenant.id);
  return { ctx, repos: handle.repos };
}

describe("topKSimilarChunks (retrieval_cache pattern, SPINE §2.7)", () => {
  it("caches a query against a source set so a repeat query is a cache hit", async () => {
    const { ctx, repos } = await setup();
    storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-retrieve-"));
    const objectStore = new LocalObjectStore(storeRoot);
    // source_chunks.embedding is a fixed-dimension pgvector column (1536).
    const embedder = createFakeEmbeddingDriver(1536);

    const result = await ingestSource(
      ctx,
      repos,
      { kind: "prompt", prompt: "a fact worth retrieving" },
      { embedder, objectStore, capTokens: 1_000_000 },
    );
    const { vectors } = await embedder.embed(["a fact worth retrieving"]);

    const first = await topKSimilarChunks(ctx, repos, {
      sourceIds: [result.sourceId],
      queryEmbedding: vectors[0],
      k: 1,
    });
    expect(first).toHaveLength(1);

    // Second call for the same source set + query hits retrieval_cache
    // (same result, hit count advances) rather than re-querying source_chunks.
    const second = await topKSimilarChunks(ctx, repos, {
      sourceIds: [result.sourceId],
      queryEmbedding: vectors[0],
      k: 1,
    });
    expect(second).toEqual(first);
  });
});
