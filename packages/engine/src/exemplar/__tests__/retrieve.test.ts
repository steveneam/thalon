import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import { createFakeEmbeddingDriver, type EmbeddingDriver } from "../../ingest/shell/embedder";
import { ingestExemplar } from "../ingest-exemplar";
import { retrieveExemplarContext } from "../retrieve";

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

async function setup(): Promise<{
  ctx: TenantCtx;
  repos: Repos;
  objectStore: LocalObjectStore;
  embedder: EmbeddingDriver;
}> {
  handle = await openTestDb();
  const tenant = await handle.repos.tenants.create({ slug: "self", name: "Self" });
  const ctx = tenantCtx(tenant.id);
  storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-exemplar-retrieve-"));
  const objectStore = new LocalObjectStore(storeRoot);
  const embedder = createFakeEmbeddingDriver(1536);
  return { ctx, repos: handle.repos, objectStore, embedder };
}

describe("retrieveExemplarContext (B2.4 retrieval scoped to exemplar/voice_sample sources only)", () => {
  it("returns empty context when the tenant has no exemplar/voice_sample sources yet", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    const result = await retrieveExemplarContext(
      ctx,
      repos,
      { queryText: "a launch announcement", capTokens: 1_000_000 },
      { embedder, objectStore },
    );
    expect(result).toEqual({ contextBlock: "", chunks: [], exemplarIds: [] });
  });

  it("retrieves only exemplar/voice_sample chunks, never a plain prompt/doc source's chunks", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    const exemplarResult = await ingestExemplar(
      ctx,
      repos,
      { kind: "exemplar", text: "Our repair clinic keeps usable gear out of landfill." },
      { embedder, objectStore, capTokens: 1_000_000 },
    );
    // A ordinary pillar source — must never surface in exemplar retrieval.
    await repos.sourceChunks.ingest(ctx, {
      kind: "prompt",
      contentHash: "pillar-hash",
      chunks: [
        {
          seq: 0,
          text: "This pillar source should never appear in exemplar context.",
          tokenCount: 8,
          contentHash: "pillar-chunk-hash",
        },
      ],
    });

    const result = await retrieveExemplarContext(
      ctx,
      repos,
      { queryText: "gear repair announcement", capTokens: 1_000_000 },
      { embedder, objectStore },
    );
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks.every((c) => c.sourceId === exemplarResult.sourceId)).toBe(true);
    expect(result.contextBlock).toContain("repair clinic");
    expect(result.exemplarIds).toEqual(
      result.chunks.map((c) => ({ sourceId: c.sourceId, chunkId: c.chunkId })),
    );
  });

  it("respects the k limit across exemplar + voice_sample sources", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    await ingestExemplar(
      ctx,
      repos,
      { kind: "exemplar", text: "First exemplar post about our gear repair clinic." },
      { embedder, objectStore, capTokens: 1_000_000 },
    );
    await ingestExemplar(
      ctx,
      repos,
      { kind: "voice_sample", text: "A voice sample describing our repair clinic in our own words." },
      { embedder, objectStore, capTokens: 1_000_000 },
    );

    const result = await retrieveExemplarContext(
      ctx,
      repos,
      { queryText: "repair clinic", k: 1, capTokens: 1_000_000 },
      { embedder, objectStore },
    );
    expect(result.chunks).toHaveLength(1);
  });
});
