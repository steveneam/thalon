import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, sha256Hex, type DbHandle, type Repos } from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import type { CrawlFetcher } from "../../demo/fetcher";
import { crawl4aiDriver, parseCrawl4aiOutput, type Crawl4aiRunner } from "../crawl4ai-driver";
import { ingestWebUrl } from "../ingest-web-url";
import { createFakeEmbeddingDriver } from "../shell/embedder";
import { fetchExtractDriver, getWebIngestDriver, type WebIngestDriver } from "../web-ingest";

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

async function setup(): Promise<{ ctx: TenantCtx; repos: Repos; objectStore: LocalObjectStore }> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  const ctx = tenantCtx(tenant.id);
  storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-web-ingest-"));
  return { ctx, repos, objectStore: new LocalObjectStore(storeRoot) };
}

/** Status-aware robots fixture fetcher — never touches the network. */
function robotsFetcher(rules: string | null): CrawlFetcher & { requests: string[] } {
  const requests: string[] = [];
  return {
    requests,
    async fetch(url) {
      requests.push(url);
      if (rules === null) return { status: 404, html: "not found" };
      return { status: 200, html: rules };
    },
  };
}

function fakeDriver(content: string): WebIngestDriver & { urls: string[] } {
  const urls: string[] = [];
  return {
    name: "fake-web",
    urls,
    async fetchPage(request) {
      urls.push(request.url);
      return { content };
    },
  };
}

const CONTENT = "Thalon turns one source into judged platform drafts. The engine gates every draft.";

describe("ingestWebUrl (B6.6 grounding web ingest, keyless + networkless)", () => {
  it("robots-allowed URL -> a chunked, embedded `url` source with driver provenance", async () => {
    const { ctx, repos, objectStore } = await setup();
    const robots = robotsFetcher(null); // 404 = allow-all
    const driver = fakeDriver(CONTENT);

    const result = await ingestWebUrl(
      ctx,
      repos,
      { url: "https://example.com/docs" },
      {
        webIngestDriver: driver,
        robotsFetcher: robots,
        rateLimiter: { now: () => 0, sleep: async () => {} },
        embedder: createFakeEmbeddingDriver(),
        objectStore,
      },
    );

    expect(result.created).toBe(true);
    expect(result.driver).toBe("fake-web");
    expect(result.chunkCount).toBeGreaterThan(0);
    expect(robots.requests).toEqual(["https://example.com/robots.txt"]);
    expect(driver.urls).toEqual(["https://example.com/docs"]);

    const source = await repos.sources.get(ctx, result.sourceId);
    expect(source?.kind).toBe("url");
    expect(source?.uri).toBe("https://example.com/docs");
    expect((source?.meta as Record<string, unknown>).webIngestDriver).toBe("fake-web");
    expect(source?.rawRef).toBe(`sources/${sha256Hex(CONTENT)}`);
    expect((await objectStore.get(source!.rawRef!))?.toString("utf8")).toBe(CONTENT);

    const chunks = await repos.sourceChunks.listBySource(ctx, result.sourceId);
    expect(chunks[0].embedding).not.toBeNull();
  });

  it("refuses a robots-disallowed target LOUDLY before the driver ever runs", async () => {
    const { ctx, repos, objectStore } = await setup();
    const driver = fakeDriver(CONTENT);

    await expect(
      ingestWebUrl(
        ctx,
        repos,
        { url: "https://example.com/private/report" },
        {
          webIngestDriver: driver,
          robotsFetcher: robotsFetcher("User-agent: *\nDisallow: /private/"),
          rateLimiter: { now: () => 0, sleep: async () => {} },
          embedder: createFakeEmbeddingDriver(),
          objectStore,
        },
      ),
    ).rejects.toThrow(/robots\.txt/i);
    expect(driver.urls).toEqual([]); // fails by construction — no fetch happened
  });

  it("re-ingesting unchanged content is a zero-embed replay on the same source", async () => {
    const { ctx, repos, objectStore } = await setup();
    const deps = {
      webIngestDriver: fakeDriver(CONTENT),
      robotsFetcher: robotsFetcher(null),
      rateLimiter: { now: () => 0, sleep: async () => {} },
      embedder: createFakeEmbeddingDriver(),
      objectStore,
    };

    const first = await ingestWebUrl(ctx, repos, { url: "https://example.com/a" }, deps);
    const second = await ingestWebUrl(ctx, repos, { url: "https://mirror.example.org/a" }, deps);

    expect(second.created).toBe(false);
    expect(second.sourceId).toBe(first.sourceId);
  });

  it("refuses empty driver content and non-http(s) URLs loudly", async () => {
    const { ctx, repos, objectStore } = await setup();
    const deps = {
      webIngestDriver: fakeDriver("   "),
      robotsFetcher: robotsFetcher(null),
      rateLimiter: { now: () => 0, sleep: async () => {} },
      embedder: createFakeEmbeddingDriver(),
      objectStore,
    };
    await expect(ingestWebUrl(ctx, repos, { url: "https://example.com/x" }, deps)).rejects.toThrow(
      /returned no content/,
    );
    await expect(ingestWebUrl(ctx, repos, { url: "file:///etc/passwd" }, deps)).rejects.toThrow(
      /http\(s\) URL/,
    );
  });
});

describe("web-ingest driver registry", () => {
  it("defaults to fetch-extract and refuses unknown names with the registry listed", () => {
    expect(getWebIngestDriver().name).toBe("fetch-extract");
    expect(getWebIngestDriver("crawl4ai").name).toBe("crawl4ai");
    expect(() => getWebIngestDriver("scrapey")).toThrow(/fetch-extract, crawl4ai/);
  });

  it("fetch-extract strips markup through the existing extractor", async () => {
    const driver = fetchExtractDriver({
      fetcher: {
        async fetch() {
          return { html: "<html><body><h1>Title</h1><p>Body copy.</p><script>x()</script></body></html>" };
        },
      },
    });
    const page = await driver.fetchPage({ url: "https://example.com" });
    expect(page.content).toContain("Title");
    expect(page.content).toContain("Body copy.");
    expect(page.content).not.toContain("x()");
  });
});

describe("crawl4ai subprocess contract (fixture-tested, no python)", () => {
  it("parses the LAST valid JSON line out of chatty stdout", () => {
    const stdout = [
      "[INIT].... → Crawl4AI 0.9.0",
      '{"progress": 40}',
      '{"content": "# Docs\\n\\nClean markdown."}',
      "",
    ].join("\n");
    expect(parseCrawl4aiOutput(stdout)).toBe("# Docs\n\nClean markdown.");
  });

  it("fails loud when no contract line is present", () => {
    expect(() => parseCrawl4aiOutput("Traceback (most recent call last): boom")).toThrow(
      /no \{"content": string\} JSON line/,
    );
  });

  it("drives the injectable runner and returns the parsed content", async () => {
    const calls: string[] = [];
    const runner: Crawl4aiRunner = {
      async run(url) {
        calls.push(url);
        return '{"content": "markdown body"}';
      },
    };
    const driver = crawl4aiDriver({ runner });
    expect(driver.name).toBe("crawl4ai");
    expect((await driver.fetchPage({ url: "https://example.com/docs" })).content).toBe("markdown body");
    expect(calls).toEqual(["https://example.com/docs"]);
  });
});
