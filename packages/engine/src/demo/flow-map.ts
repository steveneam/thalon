import { extractAffordances, type FlowMapAffordance } from "./affordances";
import { extractLinks } from "./links";

export interface FlowMapPageInput {
  url: string;
  html: string;
}

export interface FlowMapPage {
  url: string;
  links: string[];
  affordances: FlowMapAffordance[];
}

export interface FlowMap {
  pages: FlowMapPage[];
}

/**
 * Pure core (B2.5 stage 2, CHARTER B2.5): derives the page graph (same-origin
 * links between crawled pages) + interactive affordances per page from a
 * site crawl's pages. Given the same pages, always the same flow map — no
 * I/O, no clock, no randomness. Accepts anything shaped like `{url, html}`,
 * so both a fresh `CrawlResult.pages` (stage 1, same call — see ./crawl.ts)
 * and a page bundle reconstructed from the object store (a later call — see
 * `loadCrawlPages` in ./ingest-crawl.ts) produce an identical flow map.
 */
export function deriveFlowMap(pages: readonly FlowMapPageInput[]): FlowMap {
  return {
    pages: pages.map((page) => ({
      url: page.url,
      links: extractLinks(page.html, page.url),
      affordances: extractAffordances(page.html),
    })),
  };
}

/** Every crawled page URL — the set a storyboard's `goto` steps may target (./validate-shell-output.ts). */
export function flowMapPageUrls(flowMap: FlowMap): string[] {
  return flowMap.pages.map((p) => p.url);
}

/** Every affordance selector across every page — the set a storyboard's non-`goto` steps may target. */
export function flowMapSelectors(flowMap: FlowMap): string[] {
  return [...new Set(flowMap.pages.flatMap((p) => p.affordances.map((a) => a.selector)))];
}
