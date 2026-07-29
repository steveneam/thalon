import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, sha256Hex, stableStringify, type DbHandle, type Repos } from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import { ingestVideoUrl } from "../ingest-video-url";
import { createFakeEmbeddingDriver } from "../shell/embedder";
import type { TranscriptProvider } from "../transcript";

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

const SEGMENTS = [
  { startMs: 0, endMs: 2_000, text: "The hook line of the video." },
  { startMs: 2_000, endMs: 5_000, text: "The body explains the idea." },
];

function fakeFetchingProvider(): TranscriptProvider & { uris: string[] } {
  const uris: string[] = [];
  return {
    name: "fake-fetching",
    uris,
    async fetchTranscript(request) {
      uris.push(request.uri ?? "");
      return SEGMENTS;
    },
  };
}

async function setup(): Promise<{ ctx: TenantCtx; repos: Repos; objectStore: LocalObjectStore }> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-video-url-"));
  return { ctx: tenantCtx(tenant.id), repos, objectStore: new LocalObjectStore(storeRoot) };
}

describe("ingestVideoUrl (B4.8 — URL in, timed video_transcript source out; keyless + networkless)", () => {
  it("URL → provider segments → timed embedded chunks, provenance recorded, transcript persisted content-addressed", async () => {
    const { ctx, repos, objectStore } = await setup();
    const provider = fakeFetchingProvider();
    const url = "https://platform.test/watch?v=own-video";

    const result = await ingestVideoUrl(
      ctx,
      repos,
      // Enhanced: this case is about the EMBEDDED chunk shape, which only the
      // operator's per-ingest ask produces (the free path is pinned next door
      // in ingest-free-by-default.test.ts).
      { url, aiEnhance: true, meta: { note: "operator-permitted" } },
      { transcriptProvider: provider, embedder: createFakeEmbeddingDriver(1536), objectStore, capTokens: 1_000_000 },
    );

    expect(result.created).toBe(true);
    expect(result.provider).toBe("fake-fetching");
    expect(provider.uris).toEqual([url]);

    const source = await repos.sources.get(ctx, result.sourceId);
    expect(source!.kind).toBe("video_transcript");
    expect(source!.uri).toBe(url);
    expect(source!.contentHash).toBe(sha256Hex(stableStringify(SEGMENTS)));
    expect(source!.meta).toMatchObject({ transcriptProvider: "fake-fetching", segmentCount: 2, note: "operator-permitted" });

    // The raw transcript bundle is durably referenced (B4.6 sweep-safe).
    expect(source!.rawRef).toBe(`transcripts/${source!.contentHash}.json`);
    const stored = await objectStore.get(source!.rawRef!);
    expect(JSON.parse(stored!.toString("utf8"))).toEqual(SEGMENTS);

    // Chunks carry the media time window (the B2.2 timed-ingest contract).
    const chunks = await repos.sourceChunks.listBySource(ctx, result.sourceId);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].startMs).toBe(0);
    expect(chunks[chunks.length - 1].endMs).toBe(5_000);
  });

  it("re-ingesting the same transcript is a zero-embed fast path — content identity is the transcript, not the URL", async () => {
    const { ctx, repos, objectStore } = await setup();
    const provider = fakeFetchingProvider();
    const deps = { transcriptProvider: provider, embedder: createFakeEmbeddingDriver(1536), objectStore, capTokens: 1_000_000 };

    const first = await ingestVideoUrl(ctx, repos, { url: "https://platform.test/v/1" }, deps);
    const second = await ingestVideoUrl(ctx, repos, { url: "https://mirror.test/v/1-reupload" }, deps);

    expect(second.created).toBe(false);
    expect(second.sourceId).toBe(first.sourceId);
  });

  it("caption-file remains the default provider: operator captions ingest without any fetching driver", async () => {
    const { ctx, repos, objectStore } = await setup();
    const result = await ingestVideoUrl(
      ctx,
      repos,
      {
        url: "https://platform.test/v/own",
        captions: "1\n00:00:00,000 --> 00:00:02,000\nHello from the pillar.\n",
      },
      { embedder: createFakeEmbeddingDriver(1536), objectStore, capTokens: 1_000_000 },
    );
    expect(result.created).toBe(true);
    expect(result.provider).toBe("caption-file");
    const chunks = await repos.sourceChunks.listBySource(ctx, result.sourceId);
    expect(chunks[0].text).toContain("Hello from the pillar.");
  });

  it("an empty transcript fails loudly — nothing to ingest, nothing persisted", async () => {
    const { ctx, repos, objectStore } = await setup();
    const empty: TranscriptProvider = { name: "empty", fetchTranscript: async () => [] };
    await expect(
      ingestVideoUrl(
        ctx,
        repos,
        { url: "https://platform.test/v/void" },
        { transcriptProvider: empty, embedder: createFakeEmbeddingDriver(1536), objectStore },
      ),
    ).rejects.toThrow(/returned no segments/);
    expect(await repos.sources.getByContentHash(ctx, sha256Hex(stableStringify([])))).toBeNull();
  });
});
