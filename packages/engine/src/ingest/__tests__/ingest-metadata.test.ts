import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import { centroid, scoreAreaRelevance, type AreaRelevance } from "../area-relevance";
import { ingestVideoUrl } from "../ingest-video-url";
import { createFakeEmbeddingDriver } from "../shell/embedder";
import type { TranscriptProvider } from "../transcript";
import { youTubeOEmbedTitleFetcher, type VideoTitleFetcher } from "../video-title";

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
  { startMs: 0, endMs: 2_000, text: "AI video tooling is moving to deterministic pipelines." },
  { startMs: 2_000, endMs: 5_000, text: "Replayable runs beat one-off vibes for production teams." },
];

function fakeProvider(): TranscriptProvider {
  return {
    name: "fake-fetching",
    async fetchTranscript() {
      return SEGMENTS;
    },
  };
}

function fixedTitleFetcher(title: string | null): VideoTitleFetcher {
  return { fetchTitle: async () => title };
}

async function setup(): Promise<{ ctx: TenantCtx; repos: Repos; objectStore: LocalObjectStore }> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-ingest-meta-"));
  return { ctx: tenantCtx(tenant.id), repos, objectStore: new LocalObjectStore(storeRoot) };
}

describe("ingestVideoUrl B6.6 rider — Library metadata mini-contract (keyless + networkless)", () => {
  it("stamps meta.title, meta.tags and meta.areaRelevance on a fresh ingest", async () => {
    const { ctx, repos, objectStore } = await setup();
    await repos.monitoredAreas.create(ctx, {
      name: "AI video tooling",
      description: "AI video tooling, deterministic render pipelines, replayable content generation",
    });
    await repos.monitoredAreas.create(ctx, {
      name: "Gardening",
      description: "Soil, compost, seasonal planting and garden care",
    });

    const result = await ingestVideoUrl(
      ctx,
      repos,
      { url: "https://platform.test/watch?v=1", tags: ["tooling", "video"] },
      {
        transcriptProvider: fakeProvider(),
        titleFetcher: fixedTitleFetcher("Deterministic pipelines, explained"),
        embedder: createFakeEmbeddingDriver(1536),
        objectStore,
        capTokens: 1_000_000,
      },
    );

    const meta = (await repos.sources.get(ctx, result.sourceId))!.meta as Record<string, unknown>;
    expect(meta.title).toBe("Deterministic pipelines, explained");
    expect(meta.tags).toEqual(["tooling", "video"]);

    const relevance = meta.areaRelevance as AreaRelevance[];
    expect(relevance).toHaveLength(2);
    // Score-descending, every entry in the ranker's reason grammar.
    expect(relevance[0].score).toBeGreaterThanOrEqual(relevance[1].score);
    for (const entry of relevance) {
      expect(entry.score).toBeGreaterThanOrEqual(0);
      expect(entry.score).toBeLessThanOrEqual(1);
      expect(entry.reason).toMatch(
        /^relevance \d+(\.\d+)? to area ".+" \(embedding cosine -?\d+(\.\d+)?\)$/,
      );
    }
    expect(new Set(relevance.map((r) => r.areaName))).toEqual(
      new Set(["AI video tooling", "Gardening"]),
    );
  });

  it("degrades honestly: title falls back to the URL, no tags key when unset, no areaRelevance without active areas", async () => {
    const { ctx, repos, objectStore } = await setup();
    const url = "https://platform.test/watch?v=2";

    const result = await ingestVideoUrl(
      ctx,
      repos,
      { url },
      {
        transcriptProvider: fakeProvider(),
        titleFetcher: fixedTitleFetcher(null),
        embedder: createFakeEmbeddingDriver(1536),
        objectStore,
        capTokens: 1_000_000,
      },
    );

    const meta = (await repos.sources.get(ctx, result.sourceId))!.meta as Record<string, unknown>;
    expect(meta.title).toBe(url);
    expect("tags" in meta).toBe(false);
    expect("areaRelevance" in meta).toBe(false);
  });

  it("a throwing title fetcher never blocks ingest", async () => {
    const { ctx, repos, objectStore } = await setup();
    const result = await ingestVideoUrl(
      ctx,
      repos,
      { url: "https://platform.test/watch?v=3" },
      {
        transcriptProvider: fakeProvider(),
        titleFetcher: {
          fetchTitle: async () => {
            throw new Error("oEmbed down");
          },
        },
        embedder: createFakeEmbeddingDriver(1536),
        objectStore,
        capTokens: 1_000_000,
      },
    );
    expect(result.created).toBe(true);
    const meta = (await repos.sources.get(ctx, result.sourceId))!.meta as Record<string, unknown>;
    expect(meta.title).toBe("https://platform.test/watch?v=3");
  });
});

describe("youTubeOEmbedTitleFetcher (injected fetch — networkless)", () => {
  it("asks oEmbed only for YouTube hosts and returns the title", async () => {
    const requested: string[] = [];
    const fetcher = youTubeOEmbedTitleFetcher(async (url) => {
      requested.push(url);
      return { ok: true, json: async () => ({ title: "A real title" }) };
    });
    expect(await fetcher.fetchTitle("https://www.youtube.com/watch?v=tZQ9SNw4TYQ")).toBe(
      "A real title",
    );
    expect(requested[0]).toBe(
      `https://www.youtube.com/oembed?url=${encodeURIComponent("https://www.youtube.com/watch?v=tZQ9SNw4TYQ")}&format=json`,
    );
    expect(await fetcher.fetchTitle("https://vimeo.com/123")).toBeNull();
    expect(requested).toHaveLength(1); // non-YouTube host never hits the network
  });

  it("returns null on HTTP failure, junk JSON, and thrown fetches — never throws", async () => {
    expect(
      await youTubeOEmbedTitleFetcher(async () => ({ ok: false, json: async () => ({}) })).fetchTitle(
        "https://youtu.be/x",
      ),
    ).toBeNull();
    expect(
      await youTubeOEmbedTitleFetcher(async () => ({ ok: true, json: async () => ({ title: "  " }) })).fetchTitle(
        "https://youtu.be/x",
      ),
    ).toBeNull();
    expect(
      await youTubeOEmbedTitleFetcher(async () => {
        throw new Error("network down");
      }).fetchTitle("https://youtu.be/x"),
    ).toBeNull();
    expect(await youTubeOEmbedTitleFetcher().fetchTitle("not a url")).toBeNull();
  });
});

describe("scoreAreaRelevance (pure-ish core: existing choke point, honest degrades)", () => {
  it("returns undefined with no vectors or no active areas; paused areas leave no residue", async () => {
    const { ctx, repos, objectStore } = await setup();
    expect(
      await scoreAreaRelevance(
        ctx,
        repos,
        { vectors: [], capTokens: 1_000 },
        { embedder: createFakeEmbeddingDriver(1536), objectStore },
      ),
    ).toBeUndefined();
    expect(
      await scoreAreaRelevance(
        ctx,
        repos,
        { vectors: [[1, 0, 0]], capTokens: 1_000 },
        { embedder: createFakeEmbeddingDriver(1536), objectStore },
      ),
    ).toBeUndefined();
  });

  it("centroid is the per-dimension mean", () => {
    expect(centroid([[1, 0], [0, 1]])).toEqual([0.5, 0.5]);
    expect(centroid([[2, 4, 6]])).toEqual([2, 4, 6]);
  });
});
