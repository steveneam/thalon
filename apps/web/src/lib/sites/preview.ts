/**
 * The site-preview seam (B-sites.1, s76) — the ONE place that decides what
 * URL a browser resolves portfolio media against.
 *
 * The bug this replaces: `previewOrigin` used to be an ABSOLUTE origin
 * (`http://127.0.0.1:8899` in dev), stamped straight into every gallery
 * `<img src>` and the dossier iframe. On the box that works; from any other
 * machine `127.0.0.1` is *that viewer's* loopback, so every thumbnail and
 * the whole dossier preview is broken — which is exactly what the founder
 * saw at s75. An env override only moves the problem, because the correct
 * origin differs per viewer.
 *
 * So the workspace serves the previews ITSELF, same-origin: every media URL
 * is `/api/sites/preview/<path>`, relative to whatever host the workspace is
 * loaded from. The route behind it reads the local template directory in dev
 * and proxies the configured origin on staging/prod (the same two sources
 * `loadSites` already knows), so there is one answer per deployment and zero
 * per-viewer configuration.
 *
 * This module is deliberately dependency-free (no `node:` imports): the
 * client surfaces import PREVIEW_BASE, the server route imports the rest.
 */

/** The same-origin prefix every preview URL is built from. */
export const PREVIEW_BASE = "/api/sites/preview";

/** `sparkwright/assets/hero.webp` → `/api/sites/preview/sparkwright/assets/hero.webp`. */
export function previewUrl(pathUnderOrigin: string): string {
  return `${PREVIEW_BASE}/${pathUnderOrigin.replace(/^\/+/, "")}`;
}

/**
 * A site's own page, as a canonical document URL. It ends in `index.html`
 * on purpose: a page's relative links (`assets/…`, `guide/`) and the guide's
 * `../fonts/…` only resolve correctly when the document URL carries the
 * directory it lives in, and Next strips a trailing slash before a route
 * handler ever sees it.
 */
export function sitePageUrl(slug: string, page: "site" | "guide" = "site"): string {
  return page === "guide"
    ? `${PREVIEW_BASE}/${slug}/guide/index.html`
    : `${PREVIEW_BASE}/${slug}/index.html`;
}

/**
 * The catch-all's segments, validated into a relative path — or null if the
 * request could reach outside the portfolio. Next has already percent-decoded
 * each segment by the time we see it, so `%2e%2e` and `%2f` are caught here
 * as `..` and an embedded slash rather than sneaking through as bytes.
 */
export function safePreviewSegments(segments: string[]): string[] | null {
  if (segments.length === 0) return null;
  for (const segment of segments) {
    if (segment === "" || segment === "." || segment === "..") return null;
    if (segment.includes("/") || segment.includes("\\") || segment.includes("\0")) return null;
  }
  return segments;
}

/**
 * The CLOSED set of things the portfolio serves. Fail-closed on purpose: an
 * extension that is not on this list is a 404, so the route can never be
 * talked into serving whatever else happens to sit in the template tree.
 */
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  avif: "image/avif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  woff2: "font/woff2",
  woff: "font/woff",
  mp4: "video/mp4",
  webm: "video/webm",
};

/** True when the last segment names a file kind at all (`hero.webp`, not `guide`). */
export function hasExtension(name: string): boolean {
  return /\.[A-Za-z0-9]+$/.test(name);
}

/** The content type for a file name, or null when the kind is not on the closed set. */
export function contentTypeFor(name: string): string | null {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return null;
  return CONTENT_TYPES[name.slice(dot + 1).toLowerCase()] ?? null;
}

/**
 * Preview bytes are never heuristically cached: a review round that replaces
 * a same-named asset must never show stale bytes (the s55 lesson that made
 * `scripts/preview-server.py` no-cache in the first place). Revalidation is
 * cheap because every dir-served response carries an ETag.
 */
export const PREVIEW_CACHE_CONTROL = "no-cache, must-revalidate";

/**
 * THE PREVIEW DOOR MUST ANSWER A NULL-ORIGIN REQUEST (s79, founder-found).
 *
 * The dossier renders each site in `sandbox="allow-scripts"` WITHOUT
 * `allow-same-origin` — deliberately, because the previewed pages carry real
 * scripts and must not be able to reach the workspace's origin. The cost of that
 * (correct) choice is that the iframe's document has an OPAQUE origin, so every
 * subresource it fetches is cross-origin relative to this app.
 *
 * Fonts are always fetched in CORS mode, so without this header they are blocked
 * outright: the browser logs `Access to font at '…/fonts/shantell-sans-var.woff2'
 * from origin 'null' has been blocked by CORS policy`, and the preview silently
 * falls back to system type — on a portfolio whose whole point is showing
 * typography, including a "novel typography" category. `<img>` is not CORS-mode,
 * which is exactly why the images looked fine and only the type was wrong.
 *
 * The founder saw the console errors before any gate did; the driver had reported
 * the surface green because it watched the DOM and never listened to the console.
 *
 * Wildcard is the honest value and it widens nothing: an opaque origin can never
 * be named in an allowlist, this door serves only content-type-allowlisted static
 * bytes out of the portfolio tree, and a wildcard forbids credentialed requests
 * by spec — so the workspace auth gate in front of `/api/…` is untouched.
 * Fixing it the other way (adding `allow-same-origin`) would hand the previewed
 * sites' scripts the workspace origin, which is the one thing the sandbox exists
 * to prevent.
 */
export const PREVIEW_ALLOW_ORIGIN = "*";
