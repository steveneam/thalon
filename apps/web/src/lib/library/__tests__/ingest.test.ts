import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import {
  captionFileProvider,
  createFakeEmbeddingDriver,
  type EmbeddingDriver,
} from "@thalon/engine";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runVideoIngest, videoIngestInputSchema } from "@/lib/library/ingest";

/**
 * THE REQUEST PATH FOR THE PER-INGEST TOGGLE (s79).
 *
 * The founder's ruling is that AI-enhance is HIS choice each time — not an env
 * var, not a tenant setting. That only holds if the choice actually crosses the
 * wire, so this pins the two halves the wire can get wrong: a body WITHOUT the
 * flag must reach the engine as free (an old client, a curl, a replayed
 * request must never start spending), and a body WITH it must reach the engine
 * as the ask.
 *
 * Zero spend: every embed goes through an injected fake driver, and the free
 * cases assert that not even the fake is called.
 */

let handle: DbHandle | undefined;
let repos: Repos | undefined;
let dataDir: string | undefined;
let savedDataDir: string | undefined;

beforeEach(async () => {
  handle = await openTestDb();
  repos = handle.repos;
  savedDataDir = process.env.THALON_DATA_DIR;
  dataDir = mkdtempSync(path.join(tmpdir(), "thalon-lib-ingest-"));
  process.env.THALON_DATA_DIR = dataDir;
});

afterEach(async () => {
  repos = undefined;
  await handle?.close();
  handle = undefined;
  if (savedDataDir === undefined) delete process.env.THALON_DATA_DIR;
  else process.env.THALON_DATA_DIR = savedDataDir;
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
  dataDir = undefined;
});

const SRT = `1
00:00:00,037 --> 00:00:01,357
Deterministic pipelines beat one-off vibes.

2
00:00:01,357 --> 00:00:03,307
Replayable runs are the whole point.
`;

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

async function ctxWithArea() {
  const tenant = await repos!.tenants.create({ slug: "self", name: "Self" });
  const ctx = { tenantId: tenant.id };
  // An active area, so the second (area-relevance) embed pass has work waiting.
  await repos!.monitoredAreas.create(ctx, {
    name: "AI video tooling",
    description: "AI video tooling and deterministic render pipelines",
  });
  return ctx;
}

describe("videoIngestInputSchema — aiEnhance rides the body", () => {
  it("is optional, and absent stays ABSENT rather than defaulting either way", () => {
    const parsed = videoIngestInputSchema.parse({ url: "https://example.com/v" });
    expect("aiEnhance" in parsed).toBe(false);
    expect(parsed.aiEnhance).toBeUndefined();
  });

  it("carries the operator's choice, both ways round", () => {
    expect(
      videoIngestInputSchema.parse({ url: "https://example.com/v", aiEnhance: true }).aiEnhance,
    ).toBe(true);
    expect(
      videoIngestInputSchema.parse({ url: "https://example.com/v", aiEnhance: false }).aiEnhance,
    ).toBe(false);
  });

  it("refuses a non-boolean rather than coercing it — a truthy string must not become spend", () => {
    expect(
      videoIngestInputSchema.safeParse({ url: "https://example.com/v", aiEnhance: "yes" }).success,
    ).toBe(false);
    expect(
      videoIngestInputSchema.safeParse({ url: "https://example.com/v", aiEnhance: 1 }).success,
    ).toBe(false);
  });
});

describe("runVideoIngest — the default that reaches the engine", () => {
  it("a body with no aiEnhance ingests FREE: nothing embedded, no relevance score", async () => {
    const ctx = await ctxWithArea();
    const embedder = countingEmbedder();

    const result = await runVideoIngest(
      repos!,
      ctx,
      videoIngestInputSchema.parse({ url: "https://www.youtube.com/watch?v=free", captions: SRT }),
      { transcriptProvider: captionFileProvider(), embedder },
    );

    expect(embedder.calls).toEqual([]);
    expect(result.enhanced).toBe(false);
    const meta = (await repos!.sources.get(ctx, result.sourceId))!.meta as Record<string, unknown>;
    expect(meta.aiEnhanced).toBe(false);
    expect("areaRelevance" in meta).toBe(false);
    const chunks = await repos!.sourceChunks.listBySource(ctx, result.sourceId);
    expect(chunks.every((chunk) => chunk.embedding == null)).toBe(true);
  });

  it("aiEnhance:true is carried through to the engine — chunks embedded, areas scored", async () => {
    const ctx = await ctxWithArea();
    const embedder = countingEmbedder();

    const result = await runVideoIngest(
      repos!,
      ctx,
      videoIngestInputSchema.parse({
        url: "https://www.youtube.com/watch?v=paid",
        captions: SRT,
        aiEnhance: true,
      }),
      { transcriptProvider: captionFileProvider(), embedder },
    );

    // Both passes: the chunks, then the monitored-area descriptions.
    expect(embedder.calls).toHaveLength(2);
    expect(result.enhanced).toBe(true);
    const meta = (await repos!.sources.get(ctx, result.sourceId))!.meta as Record<string, unknown>;
    expect(meta.aiEnhanced).toBe(true);
    expect(Array.isArray(meta.areaRelevance)).toBe(true);
  });

  it("aiEnhance:false is as free as omitting it — no path turns an explicit no into a yes", async () => {
    const ctx = await ctxWithArea();
    const embedder = countingEmbedder();
    const result = await runVideoIngest(
      repos!,
      ctx,
      videoIngestInputSchema.parse({
        url: "https://www.youtube.com/watch?v=explicit-no",
        captions: SRT,
        aiEnhance: false,
      }),
      { transcriptProvider: captionFileProvider(), embedder },
    );
    expect(embedder.calls).toEqual([]);
    expect(result.enhanced).toBe(false);
  });
});
