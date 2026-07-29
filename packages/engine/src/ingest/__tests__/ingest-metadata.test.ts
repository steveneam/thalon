import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { deriveOrientation, sourceThumbnailEnvelope, tenantCtx, type TenantCtx } from "@thalon/contracts";
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

function fixedTitleFetcher(
  title: string | null,
  thumbnailUrl: string | null = null,
  dimensions: { width: number; height: number } | null = null,
): VideoTitleFetcher {
  return {
    fetchMeta: async () => ({
      title,
      thumbnailUrl,
      thumbnailWidth: dimensions?.width ?? null,
      thumbnailHeight: dimensions?.height ?? null,
    }),
  };
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
      // areaRelevance is an ENHANCED-path key — a free ingest has no vectors to
      // score, so the rider only has anything to write when the operator asked.
      { url: "https://platform.test/watch?v=1", tags: ["tooling", "video"], aiEnhance: true },
      {
        transcriptProvider: fakeProvider(),
        titleFetcher: fixedTitleFetcher(
          "Deterministic pipelines, explained",
          "https://img.platform.test/v1/hq.jpg",
          { width: 480, height: 360 },
        ),
        embedder: createFakeEmbeddingDriver(1536),
        objectStore,
        capTokens: 1_000_000,
      },
    );

    const meta = (await repos.sources.get(ctx, result.sourceId))!.meta as Record<string, unknown>;
    expect(meta.title).toBe("Deterministic pipelines, explained");
    expect(meta.thumbnailUrl).toBe("https://img.platform.test/v1/hq.jpg");
    expect(meta.thumbnailWidth).toBe(480);
    expect(meta.thumbnailHeight).toBe(360);
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
      // Enhanced, so the missing areaRelevance is attributable to "no active
      // areas" and not merely to the free path having no vectors.
      { url, aiEnhance: true },
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
    expect("thumbnailUrl" in meta).toBe(false);
    expect("thumbnailWidth" in meta).toBe(false);
    expect("thumbnailHeight" in meta).toBe(false);
    expect("tags" in meta).toBe(false);
    expect("areaRelevance" in meta).toBe(false);
  });

  it("writes the dimensions only as a PAIR — a lone width never reaches the row", async () => {
    const { ctx, repos, objectStore } = await setup();
    const result = await ingestVideoUrl(
      ctx,
      repos,
      { url: "https://platform.test/watch?v=4" },
      {
        transcriptProvider: fakeProvider(),
        // A platform that reported a width and no height: half a measurement.
        titleFetcher: {
          fetchMeta: async () => ({
            title: "Half measured",
            thumbnailUrl: "https://img.platform.test/v4/hq.jpg",
            thumbnailWidth: 480,
            thumbnailHeight: null,
          }),
        },
        embedder: createFakeEmbeddingDriver(1536),
        objectStore,
        capTokens: 1_000_000,
      },
    );

    const meta = (await repos.sources.get(ctx, result.sourceId))!.meta as Record<string, unknown>;
    expect(meta.thumbnailUrl).toBe("https://img.platform.test/v4/hq.jpg");
    expect("thumbnailWidth" in meta).toBe(false);
    expect("thumbnailHeight" in meta).toBe(false);
    // The reader still resolves the thumbnail — just without an orientation.
    const envelope = sourceThumbnailEnvelope(meta)!;
    expect(envelope.ref).toEqual({ kind: "external", url: "https://img.platform.test/v4/hq.jpg" });
    expect(deriveOrientation(envelope.ref.width, envelope.ref.height)).toBe("unknown");
  });

  it("what the writer stamps is what the contract's reader reads (the mini-contract, both ends)", async () => {
    const { ctx, repos, objectStore } = await setup();
    const result = await ingestVideoUrl(
      ctx,
      repos,
      { url: "https://platform.test/watch?v=5" },
      {
        transcriptProvider: fakeProvider(),
        // A 9:16 Short — the exact case the portrait crop-vs-contain call needs.
        titleFetcher: fixedTitleFetcher("A Short", "https://img.platform.test/v5/hq.jpg", {
          width: 1080,
          height: 1920,
        }),
        embedder: createFakeEmbeddingDriver(1536),
        objectStore,
        capTokens: 1_000_000,
      },
    );

    const row = (await repos.sources.get(ctx, result.sourceId))!;
    const envelope = sourceThumbnailEnvelope(row.meta, row.createdAt);
    expect(envelope).not.toBeNull();
    expect(envelope!.provenance).toBe("captured");
    expect(envelope!.ref).toMatchObject({
      kind: "external",
      url: "https://img.platform.test/v5/hq.jpg",
      width: 1080,
      height: 1920,
    });
    expect(deriveOrientation(envelope!.ref.width, envelope!.ref.height)).toBe("portrait");
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
          fetchMeta: async () => {
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

const NO_META = {
  title: null,
  thumbnailUrl: null,
  thumbnailWidth: null,
  thumbnailHeight: null,
};

describe("youTubeOEmbedTitleFetcher (injected fetch — networkless)", () => {
  it("asks oEmbed only for YouTube hosts and returns title + thumbnail + dimensions from the ONE call", async () => {
    const requested: string[] = [];
    const fetcher = youTubeOEmbedTitleFetcher(async (url) => {
      requested.push(url);
      return {
        ok: true,
        json: async () => ({
          title: "A real title",
          thumbnail_url: "https://i.ytimg.test/vi/x/hq.jpg",
          // The two keys the fetcher discarded until s77 — same reply, zero quota.
          thumbnail_width: 480,
          thumbnail_height: 360,
        }),
      };
    });
    expect(await fetcher.fetchMeta("https://www.youtube.com/watch?v=tZQ9SNw4TYQ")).toEqual({
      title: "A real title",
      thumbnailUrl: "https://i.ytimg.test/vi/x/hq.jpg",
      thumbnailWidth: 480,
      thumbnailHeight: 360,
    });
    expect(requested[0]).toBe(
      `https://www.youtube.com/oembed?url=${encodeURIComponent("https://www.youtube.com/watch?v=tZQ9SNw4TYQ")}&format=json`,
    );
    expect(await fetcher.fetchMeta("https://vimeo.com/123")).toEqual(NO_META);
    expect(requested).toHaveLength(1); // non-YouTube host never hits the network
  });

  it("the pair rides together: a lone dimension, a fractional one, or one without a URL is dropped whole", async () => {
    const reply = (body: Record<string, unknown>) =>
      youTubeOEmbedTitleFetcher(async () => ({ ok: true, json: async () => body })).fetchMeta(
        "https://youtu.be/x",
      );

    // Height missing → neither dimension survives.
    expect(
      await reply({ title: "t", thumbnail_url: "https://i.ytimg.test/a.jpg", thumbnail_width: 480 }),
    ).toEqual({
      title: "t",
      thumbnailUrl: "https://i.ytimg.test/a.jpg",
      thumbnailWidth: null,
      thumbnailHeight: null,
    });
    // A fractional or zero pixel count is not a measurement.
    expect(
      await reply({
        title: "t",
        thumbnail_url: "https://i.ytimg.test/a.jpg",
        thumbnail_width: 480.5,
        thumbnail_height: 360,
      }),
    ).toMatchObject({ thumbnailWidth: null, thumbnailHeight: null });
    expect(
      await reply({
        title: "t",
        thumbnail_url: "https://i.ytimg.test/a.jpg",
        thumbnail_width: 0,
        thumbnail_height: 0,
      }),
    ).toMatchObject({ thumbnailWidth: null, thumbnailHeight: null });
    // Dimensions of a thumbnail we do not have measure nothing.
    expect(await reply({ title: "t", thumbnail_width: 480, thumbnail_height: 360 })).toEqual({
      title: "t",
      thumbnailUrl: null,
      thumbnailWidth: null,
      thumbnailHeight: null,
    });
  });

  it("degrades field-by-field: non-https thumbnail dropped, blank title dropped", async () => {
    expect(
      await youTubeOEmbedTitleFetcher(async () => ({
        ok: true,
        json: async () => ({
          title: "  ",
          thumbnail_url: "http://insecure.test/t.jpg",
          thumbnail_width: 480,
          thumbnail_height: 360,
        }),
      })).fetchMeta("https://youtu.be/x"),
    ).toEqual(NO_META);
  });

  it("returns nulls on HTTP failure, junk JSON, and thrown fetches — never throws", async () => {
    expect(
      await youTubeOEmbedTitleFetcher(async () => ({ ok: false, json: async () => ({}) })).fetchMeta(
        "https://youtu.be/x",
      ),
    ).toEqual(NO_META);
    expect(
      await youTubeOEmbedTitleFetcher(async () => {
        throw new Error("network down");
      }).fetchMeta("https://youtu.be/x"),
    ).toEqual(NO_META);
    expect(await youTubeOEmbedTitleFetcher().fetchMeta("not a url")).toEqual(NO_META);
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
