import { describe, expect, it } from "vitest";
import { crawlSite, DEFAULT_CRAWL_CONFIG, type CrawlConfig } from "../crawl";
import { RobotsDisallowedError } from "../robots";
import type { CrawlFetchResult, CrawlFetcher } from "../fetcher";

const ORIGIN = "https://example.test";

class FixtureCrawlFetcher implements CrawlFetcher {
  public readonly calls: string[] = [];
  constructor(private readonly responses: Record<string, CrawlFetchResult>) {}
  async fetch(url: string): Promise<CrawlFetchResult> {
    this.calls.push(url);
    return this.responses[url] ?? { status: 404, html: "" };
  }
}

function noWaitDeps() {
  let clock = 0;
  return {
    rateLimiter: {
      now: () => clock,
      sleep: async (ms: number) => {
        clock += ms;
      },
    },
  };
}

const CONFIG: CrawlConfig = { maxPages: 50, maxDepth: 3, minDelayMs: 250, userAgent: "ThalonDemoBot" };

describe("crawlSite (B2.5 stage 1, keyless + networkless)", () => {
  it("BFS-crawls same-origin pages, following links up to maxDepth", async () => {
    const fetcher = new FixtureCrawlFetcher({
      [`${ORIGIN}/robots.txt`]: { status: 200, html: "User-agent: *\n" },
      [`${ORIGIN}/`]: {
        status: 200,
        html: `<a href="/docs">Docs</a><a href="https://external.test/x">External</a>`,
      },
      [`${ORIGIN}/docs`]: { status: 200, html: `<a href="/docs/page2">Page 2</a><a href="/">Home</a>` },
      [`${ORIGIN}/docs/page2`]: { status: 200, html: `no further links here` },
    });

    const result = await crawlSite(`${ORIGIN}/`, CONFIG, { fetcher, ...noWaitDeps() });

    expect(result.origin).toBe(ORIGIN);
    expect(result.pages.map((p) => p.url)).toEqual([
      `${ORIGIN}/`,
      `${ORIGIN}/docs`,
      `${ORIGIN}/docs/page2`,
    ]);
    expect(result.pages[0].links).toEqual([`${ORIGIN}/docs`]);
    expect(result.pages[2].depth).toBe(2);
    // External link never fetched, never queued.
    expect(fetcher.calls).not.toContain("https://external.test/x");
  });

  it("never revisits a page reachable through multiple links", async () => {
    const fetcher = new FixtureCrawlFetcher({
      [`${ORIGIN}/robots.txt`]: { status: 404, html: "" },
      [`${ORIGIN}/`]: { status: 200, html: `<a href="/a">A</a><a href="/b">B</a>` },
      [`${ORIGIN}/a`]: { status: 200, html: `<a href="/shared">Shared</a>` },
      [`${ORIGIN}/b`]: { status: 200, html: `<a href="/shared">Shared</a>` },
      [`${ORIGIN}/shared`]: { status: 200, html: `no links` },
    });
    const result = await crawlSite(`${ORIGIN}/`, CONFIG, { fetcher, ...noWaitDeps() });
    const sharedFetches = fetcher.calls.filter((u) => u === `${ORIGIN}/shared`);
    expect(sharedFetches).toHaveLength(1);
    expect(result.pages.filter((p) => p.url === `${ORIGIN}/shared`)).toHaveLength(1);
  });

  it("stops enqueueing new links past maxDepth", async () => {
    const fetcher = new FixtureCrawlFetcher({
      [`${ORIGIN}/robots.txt`]: { status: 404, html: "" },
      [`${ORIGIN}/`]: { status: 200, html: `<a href="/a">A</a>` },
      [`${ORIGIN}/a`]: { status: 200, html: `<a href="/b">B</a>` },
      [`${ORIGIN}/b`]: { status: 200, html: `<a href="/c">C</a>` },
    });
    const shallow: CrawlConfig = { ...CONFIG, maxDepth: 1 };
    const result = await crawlSite(`${ORIGIN}/`, shallow, { fetcher, ...noWaitDeps() });
    // depth 0 (seed) and depth 1 (/a) are crawled; /b (depth 2) is never enqueued.
    expect(result.pages.map((p) => p.url)).toEqual([`${ORIGIN}/`, `${ORIGIN}/a`]);
  });

  it("stops once maxPages is reached", async () => {
    const fetcher = new FixtureCrawlFetcher({
      [`${ORIGIN}/robots.txt`]: { status: 404, html: "" },
      [`${ORIGIN}/`]: { status: 200, html: `<a href="/a">A</a><a href="/b">B</a><a href="/c">C</a>` },
      [`${ORIGIN}/a`]: { status: 200, html: `` },
      [`${ORIGIN}/b`]: { status: 200, html: `` },
      [`${ORIGIN}/c`]: { status: 200, html: `` },
    });
    const capped: CrawlConfig = { ...CONFIG, maxPages: 2 };
    const result = await crawlSite(`${ORIGIN}/`, capped, { fetcher, ...noWaitDeps() });
    expect(result.pages).toHaveLength(2);
  });

  it("refuses loudly when robots.txt disallows the seed itself — never silently skipped", async () => {
    const fetcher = new FixtureCrawlFetcher({
      [`${ORIGIN}/robots.txt`]: { status: 200, html: "User-agent: *\nDisallow: /\n" },
      [`${ORIGIN}/`]: { status: 200, html: `should never be fetched` },
    });
    await expect(crawlSite(`${ORIGIN}/`, CONFIG, { fetcher, ...noWaitDeps() })).rejects.toThrow(
      RobotsDisallowedError,
    );
    expect(fetcher.calls).not.toContain(`${ORIGIN}/`);
  });

  it("refuses loudly when a page discovered mid-crawl is disallowed — never silently skipped", async () => {
    const fetcher = new FixtureCrawlFetcher({
      [`${ORIGIN}/robots.txt`]: { status: 200, html: "User-agent: *\nDisallow: /blog\n" },
      [`${ORIGIN}/`]: { status: 200, html: `<a href="/blog">Blog</a><a href="/docs">Docs</a>` },
      [`${ORIGIN}/blog`]: { status: 200, html: `should never be fetched` },
      [`${ORIGIN}/docs`]: { status: 200, html: `fine` },
    });
    await expect(crawlSite(`${ORIGIN}/`, CONFIG, { fetcher, ...noWaitDeps() })).rejects.toThrow(
      RobotsDisallowedError,
    );
  });

  it("treats a missing robots.txt (404) as allow-everything", async () => {
    const fetcher = new FixtureCrawlFetcher({
      [`${ORIGIN}/robots.txt`]: { status: 404, html: "" },
      [`${ORIGIN}/`]: { status: 200, html: `no links` },
    });
    const result = await crawlSite(`${ORIGIN}/`, CONFIG, { fetcher, ...noWaitDeps() });
    expect(result.pages).toHaveLength(1);
  });

  it("uses DEFAULT_CRAWL_CONFIG when no config is passed", async () => {
    const fetcher = new FixtureCrawlFetcher({
      [`${ORIGIN}/robots.txt`]: { status: 404, html: "" },
      [`${ORIGIN}/`]: { status: 200, html: `no links` },
    });
    const result = await crawlSite(`${ORIGIN}/`, DEFAULT_CRAWL_CONFIG, { fetcher, ...noWaitDeps() });
    expect(result.config).toEqual(DEFAULT_CRAWL_CONFIG);
    expect(result.pages).toHaveLength(1);
  });
});
