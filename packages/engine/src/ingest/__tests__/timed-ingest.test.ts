import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import { ingestSource } from "../ingest";
import { createFakeEmbeddingDriver, type EmbeddingDriver } from "../shell/embedder";

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
  storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-timed-ingest-"));
  const objectStore = new LocalObjectStore(storeRoot);
  const embedder = createFakeEmbeddingDriver(1536);
  return { ctx, repos: handle.repos, objectStore, embedder };
}

const SRT = [
  "1",
  "00:00:00,000 --> 00:00:04,500",
  "Welcome back to the workshop.",
  "",
  "2",
  "00:00:04,500 --> 00:00:09,000",
  "Today we repair a torn tent seam.",
  "",
].join("\n");

describe("ingestSource kind=video_transcript (B2.2 end-to-end, keyless + networkless)", () => {
  it("ingests captions into time-coded, embedded source_chunks with provenance", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    const result = await ingestSource(
      ctx,
      repos,
      {
        kind: "video_transcript",
        captions: SRT,
        uri: "https://videos.example/workshop-episode-1",
        meta: { title: "Workshop episode 1" },
      },
      { embedder, objectStore, capTokens: 1_000_000, chunkConfig: { targetTokens: 6 } },
    );
    expect(result.created).toBe(true);
    expect(result.chunkCount).toBeGreaterThan(0);

    const source = await repos.sources.get(ctx, result.sourceId);
    expect(source?.kind).toBe("video_transcript");
    expect(source?.uri).toBe("https://videos.example/workshop-episode-1");
    expect(source?.modality).toBe("text");
    expect(source?.rawRef).toBeTruthy();
    expect(source?.meta).toMatchObject({
      transcriptProvider: "caption-file",
      segmentCount: 2,
      title: "Workshop episode 1",
    });

    const chunks = await repos.sourceChunks.listBySource(ctx, result.sourceId);
    expect(chunks.length).toBe(result.chunkCount);
    expect(chunks[0].startMs).toBe(0);
    expect(chunks.at(-1)?.endMs).toBe(9000);
    for (const chunk of chunks) {
      expect(chunk.embedding).not.toBeNull();
      expect(chunk.startMs).not.toBeNull();
      expect(chunk.endMs).not.toBeNull();
    }
  });

  it("is idempotent on content_hash — replaying the same captions returns the original source", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    const deps = { embedder, objectStore, capTokens: 1_000_000 };
    const request = { kind: "video_transcript", captions: SRT } as const;
    const first = await ingestSource(ctx, repos, request, deps);
    const replay = await ingestSource(ctx, repos, request, deps);
    expect(replay.created).toBe(false);
    expect(replay.sourceId).toBe(first.sourceId);
    expect(replay.chunkCount).toBe(first.chunkCount);
  });
});
