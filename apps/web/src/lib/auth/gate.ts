/**
 * B6.7 workspace gate (ADR 0007 decision 4, invariant): the pure decision
 * half of src/proxy.ts — everything here is synchronous string logic so the
 * gate is exhaustively testable without NextRequest. The workspace and its
 * API surface never face the internet ungated; the public surface is a
 * closed allowlist, so a NEW route is gated by default (fail-closed for
 * routes, not just for credentials).
 */

/** The deliberately-public site surface. Static assets (_next/, favicon, icon, og-image) are excluded in the proxy matcher instead. */
const PUBLIC_EXACT = new Set([
  "/", // landing
  "/llms.txt",
  "/robots.txt",
  "/sitemap.xml",
  "/api/health", // the container HEALTHCHECK + the box's platform watch
  "/api/waitlist", // the landing form's POST (rate-limited in the route)
]);

/**
 * Routes that carry their OWN fail-closed gate (stronger than basic auth)
 * and are called machine-to-machine, so the browser-shaped basic-auth
 * challenge must not stack on top. Empty since the s64 retirement of the
 * PGlite-era /api/admin/db-dump hook (staging runs on tenant-pg; the box's
 * nightly pg_dumpall replaced it — the backup side asserts the hook's
 * ABSENCE now). The seam stays: the next machine-to-machine route lists
 * itself here instead of widening PUBLIC_EXACT.
 */
const SELF_GATED = new Set<string>([]);

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname) || SELF_GATED.has(pathname)) return true;
  // The public image door (B-pub.4): /assets/<sha256>.<ext> — the route
  // carries its own stronger gate (a published-artifact allowlist; anything
  // unlisted 404s), and its consumers are anonymous by nature: blog readers'
  // browsers and, later, IG/Threads fetching a public image_url. Basic auth
  // here would break every published image.
  if (pathname.startsWith("/assets/")) return true;
  // The OAuth callback (D1): the platform redirects the operator's BROWSER
  // here, and that browser carries no workspace credential — a basic-auth
  // challenge mid-consent strands them on a login box the platform cannot
  // answer, so every connect on a gated origin would fail. It belongs to the
  // SELF_GATED class: the route is inert without a 32-byte single-use,
  // TTL'd, tenant-walled state row that only the GATED begin door mints, so
  // a stranger's probe is indistinguishable from no flight and stores
  // nothing. A prefix rather than an exact entry because the destination is
  // the last segment.
  if (pathname.startsWith("/api/integrations/callback/")) return true;
  // The whole blog surface incl. /blog/rss.xml and engine-published slugs.
  return pathname === "/blog" || pathname.startsWith("/blog/");
}

export type GateDecision =
  | { action: "allow" }
  /** No/wrong credentials supplied — challenge with WWW-Authenticate. */
  | { action: "unauthorized" }
  /** Production with no credential CONFIGURED — the workspace fails closed (503), never open. */
  | { action: "unavailable" };

export function gateRequest(opts: {
  pathname: string;
  /** The request's Authorization header, if any. */
  authorization: string | null;
  /** WORKSPACE_BASIC_AUTH (`user:password`), if configured. */
  credential: string | undefined;
  production: boolean;
}): GateDecision {
  if (isPublicPath(opts.pathname)) return { action: "allow" };
  if (!opts.credential) {
    // The dev auth stub: open ONLY outside production. In production an
    // unconfigured gate is an operator error and the workspace stays shut.
    return opts.production ? { action: "unavailable" } : { action: "allow" };
  }
  const supplied = decodeBasicAuth(opts.authorization);
  return supplied !== null && timingSafeEqualString(supplied, opts.credential)
    ? { action: "allow" }
    : { action: "unauthorized" };
}

/** `Basic <base64(user:password)>` → the decoded `user:password`, or null for anything malformed. */
function decodeBasicAuth(header: string | null): string | null {
  if (!header) return null;
  const match = /^Basic\s+([A-Za-z0-9+/=]+)$/i.exec(header.trim());
  if (!match) return null;
  try {
    return atob(match[1]);
  } catch {
    return null;
  }
}

/** Constant-time string comparison — always walks max(a,b) chars so a near-miss credential can't be timed char-by-char. */
export function timingSafeEqualString(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}
