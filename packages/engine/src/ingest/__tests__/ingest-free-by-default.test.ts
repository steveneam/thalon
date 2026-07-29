import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EmbeddingDriver } from "../shell/embedder";
import type { TranscriptProvider } from "../transcript";

/**
 * TRANSCRIPTION IS FREE AND DETERMINISTIC BY DEFAULT (founder ruling, s79 —
 * it is HIS knowledge tool), with AI-enhance a per-ingest toggle.
 *
 * The ratchet this file exists to be: a default ingest makes ZERO metered
 * calls. Both passes, not one. Before this lane, `ingestVideoUrl` defaulted
 * to `createGatewayEmbeddingDriver` in TWO places — the chunk embed, and
 * `scoreAreaRelevance`, which embeds the tenant's monitored-area descriptions
 * — so gating only the first would have left half the spend in place while
 * the surface claimed to be free. Both are asserted here, separately, so a
 * half-fix goes red.
 *
 * The gateway driver is spied at CONSTRUCTION, not at call: it defers the
 * gateway lookup into `embed()`, so a constructed-but-unused driver throws
 * nothing and looks exactly like a free path. Construction is the only
 * moment the metered default is observable without spending.
 *
 * (The B4.4 metering-boundary ratchet greps for that lookup's NAME across the
 * repo, so it is deliberately not written out here — a doc mention in a test
 * would read to the scan as a new unguarded call site. Naming it would have
 * meant allowlisting this file, which is exactly the weakening that ratchet
 * exists to prevent.)
 *
 * Everything here runs on injected fakes — no key, no network, no spend.
 */

const gatewayDriversBuilt: string[] = [];
vi.mock("../shell/embedder", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../shell/embedder")>();
  return {
    ...actual,
    createGatewayEmbeddingDriver: (model: string) => {
      gatewayDriversBuilt.push(model);
      return actual.createGatewayEmbeddingDriver(model);
    },
  };
});

const { ingestVideoUrl } = await import("../ingest-video-url");
const { createFakeEmbeddingDriver } = await import("../shell/embedder");
const { topKSimilarChunks } = await import("../retrieve");

let handle: DbHandle | undefined;
let storeRoot: string | undefined;

beforeEach(() => {
  gatewayDriversBuilt.length = 0;
});

afterEach(async () => {
  await handle?.close();
  handle = undefined;
  if (storeRoot) {
    rmSync(storeRoot, { recursive: true, force: true });
    storeRoot = undefined;
  }
});

const SEGMENTS = [
  { startMs: 0, endMs: 2_000, text: "AI video tooling is moving to deterministic pipelines." },
  { startMs: 2_000, endMs: 5_000, text: "Replayable runs beat one-off vibes for production teams." },
];

const OTHER_SEGMENTS = [{ startMs: 0, endMs: 1_000, text: "A different video entirely." }];

function fakeProvider(segments = SEGMENTS): TranscriptProvider {
  return { name: "fake-fetching", fetchTranscript: async () => segments };
}

/** Networkless display-metadata seam — this file is about spend, not oEmbed. */
const noTitleFetcher = {
  fetchMeta: async () => ({
    title: null,
    thumbnailUrl: null,
    thumbnailWidth: null,
    thumbnailHeight: null,
  }),
};

/** A driver that records every embed call — catches "gated the chunk embed, forgot the area pass". */
function countingEmbedder(): EmbeddingDriver & { calls: string[][] } {
  const inner = createFakeEmbeddingDriver(1536);
  const calls: string[][] = [];
  return {
    model: inner.model,
    calls,
    async embed(texts) {
      calls.push(texts);
      return inner.embed(texts);
    },
  };
}

async function setup(): Promise<{ ctx: TenantCtx; repos: Repos; objectStore: LocalObjectStore }> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  const ctx = tenantCtx(tenant.id);
  // An ACTIVE monitored area, so the area-relevance pass has real work waiting
  // for it: without one it short-circuits and a missing gate would look fixed.
  await repos.monitoredAreas.create(ctx, {
    name: "AI video tooling",
    description: "AI video tooling, deterministic render pipelines, replayable content generation",
  });
  storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-ingest-free-"));
  return { ctx, repos, objectStore: new LocalObjectStore(storeRoot) };
}

describe("ingestVideoUrl — free + deterministic by default (s79)", () => {
  it("a default ingest builds NO gateway driver, records NO usage, and still produces the source", async () => {
    const { ctx, repos, objectStore } = await setup();

    // No embedder injected AT ALL: if anything wanted to embed, the only driver
    // available to it is the metered one.
    const result = await ingestVideoUrl(
      ctx,
      repos,
      { url: "https://platform.test/watch?v=free" },
      { transcriptProvider: fakeProvider(), titleFetcher: noTitleFetcher, objectStore, capTokens: 1_000_000 },
    );

    expect(gatewayDriversBuilt).toEqual([]);
    expect(await repos.usageLedger.totalForDay(ctx)).toMatchObject({ tokensIn: 0, tokensOut: 0 });

    // The transcript itself is fully there — free is not degraded ingest.
    expect(result.created).toBe(true);
    expect(result.enhanced).toBe(false);
    const chunks = await repos.sourceChunks.listBySource(ctx, result.sourceId);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].startMs).toBe(0);
    expect(chunks.every((chunk) => chunk.embedding == null)).toBe(true);
  });

  it("gating the chunk embed is not enough: the area-relevance pass must not fire either", async () => {
    const { ctx, repos, objectStore } = await setup();
    const embedder = countingEmbedder();

    await ingestVideoUrl(
      ctx,
      repos,
      { url: "https://platform.test/watch?v=free-2" },
      { transcriptProvider: fakeProvider(), embedder, objectStore, capTokens: 1_000_000 },
    );

    // An injected driver does not license spending either — free means free,
    // and the second pass is the one a half-fix leaves behind.
    expect(embedder.calls).toEqual([]);
  });

  it("no relevance score is WRITTEN rather than faked: the key stays absent, and the free choice is recorded", async () => {
    const { ctx, repos, objectStore } = await setup();
    const result = await ingestVideoUrl(
      ctx,
      repos,
      { url: "https://platform.test/watch?v=free-3" },
      { transcriptProvider: fakeProvider(), embedder: countingEmbedder(), objectStore, capTokens: 1_000_000 },
    );

    const meta = (await repos.sources.get(ctx, result.sourceId))!.meta as Record<string, unknown>;
    // Never a 0 that reads like a measurement.
    expect("areaRelevance" in meta).toBe(false);
    // But the CHOICE is recorded — that is what lets a reader tell "ingested
    // free" apart from "scored, nothing matched".
    expect(meta.aiEnhanced).toBe(false);
  });

  it("a caller cannot stamp `aiEnhanced: true` onto an ingest that embedded nothing", async () => {
    const { ctx, repos, objectStore } = await setup();
    const result = await ingestVideoUrl(
      ctx,
      repos,
      // `request.meta` is caller-supplied and spreads over the rider defaults —
      // but not over the record of what this ingest actually did.
      { url: "https://platform.test/watch?v=free-5", meta: { aiEnhanced: true } },
      { transcriptProvider: fakeProvider(), objectStore, capTokens: 1_000_000 },
    );

    const meta = (await repos.sources.get(ctx, result.sourceId))!.meta as Record<string, unknown>;
    expect(meta.aiEnhanced).toBe(false);
    expect(result.enhanced).toBe(false);
  });

  it("a free source is not semantically retrievable — and says so by simply not being there", async () => {
    const { ctx, repos, objectStore } = await setup();
    const deps = { objectStore, capTokens: 1_000_000 };

    const free = await ingestVideoUrl(
      ctx,
      repos,
      { url: "https://platform.test/watch?v=free-4" },
      { ...deps, transcriptProvider: fakeProvider(), embedder: createFakeEmbeddingDriver(1536) },
    );
    const enhanced = await ingestVideoUrl(
      ctx,
      repos,
      { url: "https://platform.test/watch?v=paid-4", aiEnhance: true },
      { ...deps, transcriptProvider: fakeProvider(OTHER_SEGMENTS), embedder: createFakeEmbeddingDriver(1536) },
    );

    const query = createFakeEmbeddingDriver(1536);
    const { vectors } = await query.embed(["deterministic pipelines"]);

    expect(
      await topKSimilarChunks(ctx, repos, { sourceIds: [free.sourceId], queryEmbedding: vectors[0] }),
    ).toEqual([]);
    expect(
      await topKSimilarChunks(ctx, repos, {
        sourceIds: [enhanced.sourceId],
        queryEmbedding: vectors[0],
      }),
    ).not.toEqual([]);
  });
});

describe("ingestVideoUrl — AI-enhance is the operator's per-ingest ask", () => {
  it("enhancing embeds the chunks AND scores the areas, in one ingest the operator asked for", async () => {
    const { ctx, repos, objectStore } = await setup();
    const embedder = countingEmbedder();

    const result = await ingestVideoUrl(
      ctx,
      repos,
      { url: "https://platform.test/watch?v=paid", aiEnhance: true },
      { transcriptProvider: fakeProvider(), embedder, objectStore, capTokens: 1_000_000 },
    );

    expect(result.enhanced).toBe(true);
    // Two passes, both through the injected driver: the chunks, then the areas.
    expect(embedder.calls).toHaveLength(2);
    expect(embedder.calls[1]).toEqual([
      "AI video tooling, deterministic render pipelines, replayable content generation",
    ]);
    // Still no METERED driver — the ask routes spend through whatever driver
    // the caller supplied, it does not reach past it.
    expect(gatewayDriversBuilt).toEqual([]);

    const meta = (await repos.sources.get(ctx, result.sourceId))!.meta as Record<string, unknown>;
    expect(meta.aiEnhanced).toBe(true);
    expect(Array.isArray(meta.areaRelevance)).toBe(true);
    const chunks = await repos.sourceChunks.listBySource(ctx, result.sourceId);
    expect(chunks.every((chunk) => chunk.embedding != null)).toBe(true);
    // The spend is on the ledger, where the budget guard can see it.
    expect((await repos.usageLedger.totalForDay(ctx)).tokensIn).toBeGreaterThan(0);
  });

  it("ONE ARTIFACT: free and enhanced are the same source shape, never a verbatim-plus-enhanced pair", async () => {
    const { ctx, repos, objectStore } = await setup();
    const free = await ingestVideoUrl(
      ctx,
      repos,
      { url: "https://platform.test/watch?v=shape-free" },
      { transcriptProvider: fakeProvider(), objectStore, capTokens: 1_000_000 },
    );
    const enhanced = await ingestVideoUrl(
      ctx,
      repos,
      { url: "https://platform.test/watch?v=shape-paid", aiEnhance: true },
      {
        transcriptProvider: fakeProvider(OTHER_SEGMENTS),
        embedder: createFakeEmbeddingDriver(1536),
        objectStore,
        capTokens: 1_000_000,
      },
    );

    const freeRow = (await repos.sources.get(ctx, free.sourceId))!;
    const enhancedRow = (await repos.sources.get(ctx, enhanced.sourceId))!;
    expect(freeRow.kind).toBe(enhancedRow.kind);
    expect(freeRow.rawRef).toMatch(/^transcripts\/.+\.json$/);
    expect(enhancedRow.rawRef).toMatch(/^transcripts\/.+\.json$/);

    // The enhanced row's meta is the free row's meta PLUS areaRelevance —
    // nothing else differs in shape, and neither carries a sibling row.
    const keys = (row: typeof freeRow) => Object.keys(row.meta as object).sort();
    expect(keys(enhancedRow)).toEqual([...keys(freeRow), "areaRelevance"].sort());
  });

  it("re-ingesting an existing transcript with the toggle on reports the ROW's state, not the ask", async () => {
    const { ctx, repos, objectStore } = await setup();
    const deps = {
      transcriptProvider: fakeProvider(),
      embedder: createFakeEmbeddingDriver(1536),
      objectStore,
      capTokens: 1_000_000,
    };

    const first = await ingestVideoUrl(ctx, repos, { url: "https://platform.test/v/dup" }, deps);
    const again = await ingestVideoUrl(
      ctx,
      repos,
      { url: "https://mirror.test/v/dup-reupload", aiEnhance: true },
      deps,
    );

    // Content identity is the transcript: the fast path re-processes nothing,
    // so the ask had NO effect and the result must not pretend otherwise.
    expect(again.created).toBe(false);
    expect(again.sourceId).toBe(first.sourceId);
    expect(again.enhanced).toBe(false);
    const chunks = await repos.sourceChunks.listBySource(ctx, again.sourceId);
    expect(chunks.every((chunk) => chunk.embedding == null)).toBe(true);
  });

  it("EXISTING ROWS ARE UNAFFECTED: an already-embedded source keeps its vectors and its retrievability", async () => {
    const { ctx, repos, objectStore } = await setup();
    const before = await ingestVideoUrl(
      ctx,
      repos,
      { url: "https://platform.test/v/legacy", aiEnhance: true },
      {
        transcriptProvider: fakeProvider(),
        embedder: createFakeEmbeddingDriver(1536),
        objectStore,
        capTokens: 1_000_000,
      },
    );

    // …then the shelf fills up with free ingests around it.
    await ingestVideoUrl(
      ctx,
      repos,
      { url: "https://platform.test/v/after" },
      { transcriptProvider: fakeProvider(OTHER_SEGMENTS), objectStore, capTokens: 1_000_000 },
    );

    const chunks = await repos.sourceChunks.listBySource(ctx, before.sourceId);
    expect(chunks.every((chunk) => chunk.embedding != null)).toBe(true);
    const { vectors } = await createFakeEmbeddingDriver(1536).embed(["deterministic pipelines"]);
    expect(
      await topKSimilarChunks(ctx, repos, {
        sourceIds: [before.sourceId],
        queryEmbedding: vectors[0],
      }),
    ).not.toEqual([]);
    const meta = (await repos.sources.get(ctx, before.sourceId))!.meta as Record<string, unknown>;
    expect(meta.aiEnhanced).toBe(true);
    expect(Array.isArray(meta.areaRelevance)).toBe(true);
  });
});
