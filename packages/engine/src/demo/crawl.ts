import { extractHtml } from "../ingest";
import { getCrawlFetcher, type CrawlFetcher } from "./fetcher";
import { extractLinks } from "./links";
import { createRateLimiter, type RateLimiterDeps } from "./rate-limiter";
import { assertPathAllowed, parseRobotsTxt, type RobotsRules } from "./robots";

export interface CrawlConfig {
  maxPages: number;
  maxDepth: number;
  minDelayMs: number;
  userAgent: string;
}

/** Sane defaults for a bounded, polite demo-site crawl. */
export const DEFAULT_CRAWL_CONFIG: CrawlConfig = {
  maxPages: 50,
  maxDepth: 3,
  minDelayMs: 250,
  userAgent: "ThalonDemoBot",
};

export interface CrawledPage {
  url: string;
  depth: number;
  html: string;
  text: string;
  /** Same-origin links found on this page (the page-graph edges — see ./flow-map.ts). */
  links: string[];
}

export interface CrawlResult {
  origin: string;
  seedUrl: string;
  config: CrawlConfig;
  pages: CrawledPage[];
}

export interface CrawlDeps {
  fetcher?: CrawlFetcher;
  rateLimiter?: RateLimiterDeps;
}

function normalizeUrl(url: string): string {
  const u = new URL(url);
  u.hash = "";
  return u.toString();
}

function robotsPath(url: string): string {
  const u = new URL(url);
  return u.pathname + u.search;
}

/**
 * B2.5 stage 1 (CHARTER B2.5): same-origin BFS from `seedUrl`, honoring
 * robots.txt and the configured rate limit — both safety invariants, tested
 * thoroughly as the pure functions in ./robots.ts and ./rate-limiter.ts. A
 * page robots.txt disallows is refused LOUDLY (`RobotsDisallowedError`),
 * never silently skipped past — including the seed itself: the throw
 * propagates out of the whole crawl rather than quietly omitting the page
 * from the flow map. HTTP fetching goes through the ./fetcher.ts seam so
 * this function never touches the network directly — tests inject fixture
 * responses.
 */
export async function crawlSite(
  seedUrl: string,
  config: CrawlConfig = DEFAULT_CRAWL_CONFIG,
  deps: CrawlDeps = {},
): Promise<CrawlResult> {
  const fetcher = deps.fetcher ?? getCrawlFetcher();
  const origin = new URL(seedUrl).origin;
  const robotsRes = await fetcher.fetch(`${origin}/robots.txt`);
  const robots: RobotsRules =
    robotsRes.status >= 200 && robotsRes.status < 300
      ? parseRobotsTxt(robotsRes.html)
      : { groups: [] };

  const rateLimiter = createRateLimiter(config.minDelayMs, deps.rateLimiter);
  const visited = new Set<string>();
  const queued = new Set<string>();
  const normalizedSeed = normalizeUrl(seedUrl);
  const queue: { url: string; depth: number }[] = [{ url: normalizedSeed, depth: 0 }];
  queued.add(normalizedSeed);
  const pages: CrawledPage[] = [];

  while (queue.length > 0 && pages.length < config.maxPages) {
    const next = queue.shift();
    if (!next) break;
    if (visited.has(next.url)) continue;
    visited.add(next.url);

    assertPathAllowed(robots, config.userAgent, robotsPath(next.url), next.url);

    await rateLimiter.beforeRequest();
    const res = await fetcher.fetch(next.url);
    const text = extractHtml(res.html).text;
    const links = extractLinks(res.html, next.url);
    pages.push({ url: next.url, depth: next.depth, html: res.html, text, links });

    if (next.depth < config.maxDepth) {
      for (const link of links) {
        const normalized = normalizeUrl(link);
        if (visited.has(normalized) || queued.has(normalized)) continue;
        queued.add(normalized);
        queue.push({ url: normalized, depth: next.depth + 1 });
      }
    }
  }

  return { origin, seedUrl: normalizedSeed, config, pages };
}
