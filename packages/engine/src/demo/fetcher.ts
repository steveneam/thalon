/**
 * Crawl fetcher seam (B2.5 stage 1) — mirrors ../ingest/fetcher.ts: isolates
 * URL fetching so tests inject fixtures instead of touching the network.
 * Unlike ingest's fetcher, a non-2xx response is RETURNED here (never
 * thrown) — the crawler needs to see robots.txt's 404 (meaning "no rules")
 * without aborting the whole crawl.
 */
export interface CrawlFetchResult {
  status: number;
  html: string;
  contentType?: string;
}

export interface CrawlFetcher {
  fetch(url: string): Promise<CrawlFetchResult>;
}

export class HttpCrawlFetcher implements CrawlFetcher {
  async fetch(url: string): Promise<CrawlFetchResult> {
    const res = await fetch(url);
    const html = await res.text();
    return { status: res.status, html, contentType: res.headers.get("content-type") ?? undefined };
  }
}

export function getCrawlFetcher(): CrawlFetcher {
  return new HttpCrawlFetcher();
}
