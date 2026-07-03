import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import type { Fetcher } from "../fetcher";
import { ingestSource } from "../ingest";
import { topKSimilarChunks } from "../retrieve";
import { createFakeEmbeddingDriver, type EmbeddingDriver } from "../shell/embedder";

class FixtureFetcher implements Fetcher {
  constructor(private readonly pages: Record<string, string>) {}

  async fetch(url: string) {
    const html = this.pages[url];
    if (html === undefined) throw new Error(`no fixture registered for "${url}"`);
    return { html };
  }
}

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
  storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-ingest-"));
  const objectStore = new LocalObjectStore(storeRoot);
  // source_chunks.embedding is a fixed-dimension pgvector column (1536) — the
  // fake driver must match it exactly, same as the real embedding models would.
  const embedder = createFakeEmbeddingDriver(1536);
  return { ctx, repos: handle.repos, objectStore, embedder };
}

describe("ingestSource (B1.1 end-to-end, keyless + networkless)", () => {
  it("ingests a prompt source into sources + source_chunks", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    const result = await ingestSource(
      ctx,
      repos,
      { kind: "prompt", prompt: "We shipped a thing today. ".repeat(40) },
      { embedder, objectStore, capTokens: 1_000_000 },
    );
    expect(result.created).toBe(true);
    expect(result.chunkCount).toBeGreaterThan(0);

    const source = await repos.sources.get(ctx, result.sourceId);
    expect(source?.kind).toBe("prompt");
    expect(source?.rawRef).toBeNull();

    const chunks = await repos.sourceChunks.listBySource(ctx, result.sourceId);
    expect(chunks).toHaveLength(result.chunkCount);
    expect(chunks[0].embedding).toHaveLength(1536);
  });

  it("ingests a doc source and stores the raw payload via the object-store seam", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    const result = await ingestSource(
      ctx,
      repos,
      { kind: "doc", doc: "Release notes for v2. ".repeat(40) },
      { embedder, objectStore, capTokens: 1_000_000 },
    );
    expect(result.created).toBe(true);
    const source = await repos.sources.get(ctx, result.sourceId);
    expect(source?.rawRef).toMatch(/^sources\//);
  });

  it("ingests a URL source via the fetcher seam (fixture, no network)", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    const fetcher = new FixtureFetcher({
      "https://example.test/launch": "<html><body><h1>Launch</h1><p>It shipped.</p></body></html>",
    });
    const result = await ingestSource(
      ctx,
      repos,
      { kind: "url", url: "https://example.test/launch" },
      { embedder, objectStore, fetcher, capTokens: 1_000_000 },
    );
    expect(result.created).toBe(true);
    const source = await repos.sources.get(ctx, result.sourceId);
    expect(source?.uri).toBe("https://example.test/launch");
    const chunks = await repos.sourceChunks.listBySource(ctx, result.sourceId);
    expect(chunks[0].text).toContain("Launch");
  });

  it("is idempotent: re-ingesting identical content does not duplicate rows", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    const prompt = "We shipped a thing today.";
    const first = await ingestSource(
      ctx,
      repos,
      { kind: "prompt", prompt },
      { embedder, objectStore, capTokens: 1_000_000 },
    );
    const second = await ingestSource(
      ctx,
      repos,
      { kind: "prompt", prompt },
      { embedder, objectStore, capTokens: 1_000_000 },
    );
    expect(second.sourceId).toBe(first.sourceId);
    expect(second.created).toBe(false);
    const chunks = await repos.sourceChunks.listBySource(ctx, first.sourceId);
    expect(chunks).toHaveLength(first.chunkCount);
  });

  it("returns top-k similar chunks for a query embedding", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    const doc = [Array(30).fill("alpha").join(" "), Array(30).fill("bravo").join(" ")].join(" ");
    const result = await ingestSource(
      ctx,
      repos,
      { kind: "doc", doc },
      { embedder, objectStore, capTokens: 1_000_000, chunkConfig: { targetTokens: 30 } },
    );
    expect(result.chunkCount).toBe(2);

    const chunks = await repos.sourceChunks.listBySource(ctx, result.sourceId);
    const bravoChunk = chunks.find((c) => c.text.includes("bravo"));
    expect(bravoChunk).toBeDefined();

    const { vectors } = await embedder.embed([bravoChunk!.text]);
    const top = await topKSimilarChunks(ctx, repos, {
      sourceIds: [result.sourceId],
      queryEmbedding: vectors[0],
      k: 1,
    });
    expect(top).toHaveLength(1);
    expect(top[0].chunkId).toBe(bravoChunk!.id);
    expect(top[0].score).toBeCloseTo(1, 5);
  });
});
