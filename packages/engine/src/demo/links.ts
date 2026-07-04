/**
 * Pure core (B2.5 stage 1/2): extracts same-origin absolute links from an
 * HTML page. Given the same html + pageUrl, always the same links, in
 * document order, de-duplicated (fragment-only differences collapse to one
 * link — a demo storyboard never needs to distinguish `#section`s).
 */
const HREF_RE = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi;

export function extractLinks(html: string, pageUrl: string): string[] {
  const origin = new URL(pageUrl).origin;
  const seen = new Set<string>();
  const links: string[] = [];
  for (const match of html.matchAll(HREF_RE)) {
    const href = match[1];
    if (!href || href.startsWith("#") || /^(mailto|javascript|tel):/i.test(href)) continue;
    let resolved: URL;
    try {
      resolved = new URL(href, pageUrl);
    } catch {
      continue;
    }
    if (resolved.origin !== origin) continue;
    resolved.hash = "";
    const normalized = resolved.toString();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    links.push(normalized);
  }
  return links;
}
