import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import { createFakeEmbeddingDriver, type EmbeddingDriver } from "../../ingest/shell/embedder";
import type { CrawlFetchResult, CrawlFetcher } from "../fetcher";
import { loadCrawlPages, runSiteCrawl } from "../ingest-crawl";

const ORIGIN = "https://example.test";

class FixtureCrawlFetcher implements CrawlFetcher {
  constructor(private readonly responses: Record<string, CrawlFetchResult>) {}
  async fetch(url: string): Promise<CrawlFetchResult> {
    return this.responses[url] ?? { status: 404, html: "" };
  }
}

function fastRateLimiterDeps() {
  let clock = 0;
  return {
    now: () => clock,
    sleep: async (ms: number) => {
      clock += ms;
    },
  };
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
  storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-demo-crawl-"));
  const objectStore = new LocalObjectStore(storeRoot);
  const embedder = createFakeEmbeddingDriver(1536);
  return { ctx, repos: handle.repos, objectStore, embedder };
}

const HOME_HTML = `<a href="/docs">Docs</a>`;
const DOCS_HTML = `<a href="/">Home</a> Docs content about the product.`;

function fetcherFixture(): CrawlFetcher {
  return new FixtureCrawlFetcher({
    [`${ORIGIN}/robots.txt`]: { status: 404, html: "" },
    [`${ORIGIN}/`]: { status: 200, html: HOME_HTML },
    [`${ORIGIN}/docs`]: { status: 200, html: DOCS_HTML },
  });
}

describe("runSiteCrawl (B2.5 stage 1 end-to-end, keyless + networkless)", () => {
  it("persists a site_crawl source + chunked/embedded source_chunks", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    const result = await runSiteCrawl(
      ctx,
      repos,
      { seedUrl: `${ORIGIN}/` },
      { fetcher: fetcherFixture(), objectStore, embedder, capTokens: 1_000_000, rateLimiter: fastRateLimiterDeps() },
    );

    expect(result.created).toBe(true);
    expect(result.pageUrls).toEqual([`${ORIGIN}/`, `${ORIGIN}/docs`]);
    expect(result.chunkCount).toBeGreaterThan(0);

    const source = await repos.sources.get(ctx, result.sourceId);
    expect(source?.kind).toBe("site_crawl");
    expect(source?.uri).toBe(`${ORIGIN}/`);
    expect(source?.rawRef).toMatch(/^crawl-pages\//);
    const meta = source?.meta as Record<string, unknown>;
    expect(meta.pageUrls).toEqual([`${ORIGIN}/`, `${ORIGIN}/docs`]);

    const chunks = await repos.sourceChunks.listBySource(ctx, result.sourceId);
    expect(chunks).toHaveLength(result.chunkCount);
    expect(chunks[0].embedding).toHaveLength(1536);
  });

  it("is idempotent on re-crawling identical site content: no duplicate source or chunks", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    const first = await runSiteCrawl(
      ctx,
      repos,
      { seedUrl: `${ORIGIN}/` },
      { fetcher: fetcherFixture(), objectStore, embedder, capTokens: 1_000_000, rateLimiter: fastRateLimiterDeps() },
    );
    const second = await runSiteCrawl(
      ctx,
      repos,
      { seedUrl: `${ORIGIN}/` },
      { fetcher: fetcherFixture(), objectStore, embedder, capTokens: 1_000_000, rateLimiter: fastRateLimiterDeps() },
    );
    expect(second.created).toBe(false);
    expect(second.sourceId).toBe(first.sourceId);
    const chunks = await repos.sourceChunks.listBySource(ctx, first.sourceId);
    expect(chunks).toHaveLength(first.chunkCount);
  });

  it("loadCrawlPages reconstructs the exact crawled pages without touching the network", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    const result = await runSiteCrawl(
      ctx,
      repos,
      { seedUrl: `${ORIGIN}/` },
      { fetcher: fetcherFixture(), objectStore, embedder, capTokens: 1_000_000, rateLimiter: fastRateLimiterDeps() },
    );

    const pages = await loadCrawlPages(ctx, repos, result.sourceId, { objectStore });
    expect(pages).toEqual([
      { url: `${ORIGIN}/`, html: HOME_HTML },
      { url: `${ORIGIN}/docs`, html: DOCS_HTML },
    ]);
  });

  it("loadCrawlPages throws for a source that is not kind site_crawl", async () => {
    const { ctx, repos } = await setup();
    const source = await repos.sources.create(ctx, {
      kind: "prompt",
      contentHash: "deadbeef",
    });
    await expect(loadCrawlPages(ctx, repos, source.id)).rejects.toThrow(/expected "site_crawl"/);
  });
});
