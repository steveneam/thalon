import { crawl4aiDriver } from "./crawl4ai-driver";
import { extractHtml } from "./extract";
import { getFetcher, type Fetcher } from "./fetcher";

/**
 * The web-ingest seam (B6.6; ADR 0005/workspace-ux-v2 §7 step 4): how an
 * operator site / docs URL becomes clean grounding text is a swappable
 * driver, exactly like the B4.8 transcript registry:
 *
 *   fetch-extract — zero-dep default: plain HTTP fetch + the existing
 *                   extractHtml text extraction (./extract.ts)
 *   crawl4ai      — local Crawl4AI (Apache-2.0, user-scope pip install)
 *                   behind a SUBPROCESS contract (./crawl4ai-driver.ts) —
 *                   URL → LLM-ready markdown; the engine knows the driver
 *                   name and the JSON stdout shape, never imports the
 *                   library
 *
 * Selection is data: an explicit name per call (unknown names fail loud
 * with the registry listed). robots.txt + rate limiting are NOT driver
 * concerns — the core caller (./ingest-web-url.ts) enforces both BEFORE
 * any driver runs, so a disallowed target fails by construction no matter
 * which driver is selected.
 */

export interface WebIngestRequest {
  url: string;
}

export interface WebIngestPage {
  /** Clean text/markdown for grounding — the driver's whole contract. */
  content: string;
}

export interface WebIngestDriver {
  readonly name: string;
  fetchPage(request: WebIngestRequest): Promise<WebIngestPage>;
}

export function fetchExtractDriver(deps: { fetcher?: Fetcher } = {}): WebIngestDriver {
  const fetcher = deps.fetcher ?? getFetcher();
  return {
    name: "fetch-extract",
    async fetchPage(request) {
      const page = await fetcher.fetch(request.url);
      return { content: extractHtml(page.html).text };
    },
  };
}

const DRIVER_REGISTRY: Record<string, () => WebIngestDriver> = {
  "fetch-extract": () => fetchExtractDriver(),
  crawl4ai: () => crawl4aiDriver(),
};

export function registeredWebIngestDrivers(): string[] {
  return Object.keys(DRIVER_REGISTRY);
}

/** Seam resolution: explicit name > the zero-dep fetch-extract default. Unknown names fail loud with the registry listed. */
export function getWebIngestDriver(name?: string): WebIngestDriver {
  const selected = name?.trim() || "fetch-extract";
  const factory = DRIVER_REGISTRY[selected];
  if (!factory) {
    throw new Error(
      `unknown web-ingest driver "${selected}" — registered: ${registeredWebIngestDrivers().join(", ")} (drivers are config, never new ingest code paths)`,
    );
  }
  return factory();
}
