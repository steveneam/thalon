import { getContentAddressed, getObjectStore, objectKey, type ObjectStore } from "@thalon/platform";
import { z } from "zod";
import { pinnedAssetKey, readPinnedAsset } from "../assets/pin";

/**
 * B-pub.4: the public-asset allowlist — the security gate of the own-site
 * image door. The public route (`/assets/<sha256>.<ext>`) serves bytes from
 * the B7.1 pin store (`assets/<hash>/asset.<ext>`), but ONLY refs that a
 * PUBLISHED artifact actually references. The gate is this one object per
 * tenant at `public-assets/<tenantId>.json`, a MUTABLE POINTER family
 * mirroring `posts/<tenantId>.json` (./posts.ts) exactly: version field,
 * schema-validated read, orphan-sweep-protected, and DERIVED STATE —
 * re-derivable from published drafts' artifacts, healed by the same rebuild
 * as the posts bundle.
 *
 * Why per-post rows instead of one flat set: admission must be revocable.
 * A republish upserts its draft's row wholesale, so an asset only stays
 * public while some CURRENTLY-published artifact still references it. The
 * membership check unions the rows.
 *
 * What the gate buys (the point of the bucket): no arbitrary object-store
 * reads through the route, no directory enumeration (nothing ever lists),
 * and a strict name grammar — an attacker can fetch exactly the images the
 * blog already shows, nothing else. Ext handling is fail-closed twice: the
 * extraction scan only admits extensions in PUBLIC_ASSET_CONTENT_TYPES, and
 * the serve-side parse refuses the rest — svg is deliberately absent
 * (script-capable served same-origin), as is anything browsers would
 * sniff into markup.
 *
 * The strategic unlock: IG/Threads publishing requires a PUBLIC `image_url`
 * (never uploaded bytes). `publicAssetPath` is that URL's site-relative
 * form; prefix the deployment's origin to hand it to the platform.
 */

export const PUBLIC_ASSETS_VERSION = 1;

/** Where a tenant's public-asset allowlist lives. */
export function publicAssetsKey(tenantId: string): string {
  return objectKey("public-assets", tenantId, "json");
}

/**
 * Everything the public door will ever serve, ext → content-type. A CLOSED
 * map (fail-closed both at extraction and at serve): images IG/Threads and
 * the blog need, plus the two video containers pins produce. No svg (can
 * carry script — same-origin XSS if served inline), no document types.
 */
export const PUBLIC_ASSET_CONTENT_TYPES: Readonly<Record<string, string>> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  mp4: "video/mp4",
  webm: "video/webm",
};

const SHA256_HEX_RE = /^[0-9a-f]{64}$/;

export const publicAssetRefSchema = z.object({
  /** The pinned asset's sha256 — the `assets/<hash>/` prefix segment. */
  contentHash: z.string().regex(SHA256_HEX_RE),
  ext: z.string().regex(/^[a-z0-9]+$/),
});
export type PublicAssetRef = z.infer<typeof publicAssetRefSchema>;

export const publicAssetsBundleSchema = z.object({
  version: z.literal(PUBLIC_ASSETS_VERSION),
  tenantId: z.string().min(1),
  generatedAtMs: z.number(),
  /** One row per published post that references assets; upserted wholesale per publish (revocation-correct). */
  posts: z.array(
    z.object({
      draftId: z.string().min(1),
      slug: z.string().min(1),
      assets: z.array(publicAssetRefSchema).min(1),
    }),
  ),
});
export type PublicAssetsBundle = z.infer<typeof publicAssetsBundleSchema>;

/**
 * The public URL's site-relative form — THE wire shape (pinned in tests):
 * `/assets/<sha256>.<ext>`. This exact path appears inside artifact markup
 * (self-containment allows relative URLs), is what the route parses, and —
 * prefixed with the deployment origin — is what IG/Threads will consume.
 */
export function publicAssetPath(ref: PublicAssetRef): string {
  return `/assets/${ref.contentHash}.${ref.ext}`;
}

/**
 * Serve-side name grammar, strict on purpose: exactly `<64 lowercase hex>.
 * <ext in the served map>`. Anything else — traversal attempts, uppercase,
 * missing/unknown ext, prefixes/suffixes — is null and the route 404s
 * WITHOUT touching the store (garbage never probes anything).
 */
export function parsePublicAssetName(name: string): PublicAssetRef | null {
  const match = /^([0-9a-f]{64})\.([a-z0-9]+)$/.exec(name);
  if (!match) return null;
  const [, contentHash, ext] = match;
  if (!(ext in PUBLIC_ASSET_CONTENT_TYPES)) return null;
  return { contentHash, ext };
}

/**
 * Publish-side admission scan: every `/assets/<hash>.<ext>` occurrence in
 * the artifact, deduped and sorted. Deliberately a whole-document regex,
 * not a tag walk: admission wants RECALL across every carrier (img src,
 * srcset entries, video poster, CSS url() in style blocks and attributes),
 * and the pattern is distinctive enough that over-approximation is safe —
 * a false hit only admits a ref that must STILL name pinned, hash-verified
 * bytes in our own store, referenced verbatim by a judged, approved,
 * published artifact. Unknown extensions are dropped here too (fail-closed
 * at both ends of the pipe).
 */
export function extractPublicAssetRefs(html: string): PublicAssetRef[] {
  const refs = new Map<string, PublicAssetRef>();
  for (const match of html.matchAll(/\/assets\/([0-9a-f]{64})\.([a-z0-9]+)/g)) {
    const [, contentHash, ext] = match;
    if (!(ext in PUBLIC_ASSET_CONTENT_TYPES)) continue;
    refs.set(`${contentHash}.${ext}`, { contentHash, ext });
  }
  return [...refs.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, ref]) => ref);
}

/** The route-side read: the tenant's allowlist, schema-validated, or null before the first image-bearing publish. */
export async function readPublicAssets(
  tenantId: string,
  objectStore: ObjectStore = getObjectStore(),
): Promise<PublicAssetsBundle | null> {
  const raw = await objectStore.get(publicAssetsKey(tenantId));
  if (!raw) return null;
  return publicAssetsBundleSchema.parse(JSON.parse(raw.toString("utf8")));
}

export interface RecordPublicAssetsRequest {
  draftId: string;
  slug: string;
  /** The refs the freshly-deployed artifact references — replaces the draft's prior row entirely. */
  assets: readonly PublicAssetRef[];
  /** The publish's "now", ms epoch (the clock is an argument, never read in core). */
  nowMs: number;
}

/**
 * The publish door's write: upserts ONE post's row (latest-wins for that
 * draft — a republish that dropped an image revokes it unless another
 * published post still carries it) and rewrites the pointer. A post with no
 * assets holds no row. Rows sort by slug — one deterministic serialization
 * per content, like sortPosts.
 */
export async function recordPublicAssets(
  tenantId: string,
  request: RecordPublicAssetsRequest,
  objectStore: ObjectStore = getObjectStore(),
): Promise<PublicAssetsBundle> {
  const existing = await readPublicAssets(tenantId, objectStore);
  const rows = (existing?.posts ?? []).filter((row) => row.draftId !== request.draftId);
  if (request.assets.length > 0) {
    rows.push({ draftId: request.draftId, slug: request.slug, assets: [...request.assets] });
  }
  rows.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const bundle = publicAssetsBundleSchema.parse({
    version: PUBLIC_ASSETS_VERSION,
    tenantId,
    generatedAtMs: request.nowMs,
    posts: rows,
  });
  await objectStore.put(publicAssetsKey(tenantId), JSON.stringify(bundle));
  return bundle;
}

/**
 * Disaster path (called by rebuildPostsBundle beside the posts rebuild —
 * one heal command, both pointers): re-derives the whole allowlist by
 * re-reading each published post's artifact (verified — corruption throws
 * loudly) and re-running the admission scan. A missing artifact skips its
 * row (fail-closed; that post's page already 404s honestly).
 */
export async function rebuildPublicAssets(
  tenantId: string,
  posts: ReadonlyArray<{ draftId: string; slug: string; htmlRef: string }>,
  nowMs: number,
  objectStore: ObjectStore = getObjectStore(),
): Promise<PublicAssetsBundle> {
  const rows: PublicAssetsBundle["posts"] = [];
  for (const post of posts) {
    const htmlBytes = await getContentAddressed(objectStore, post.htmlRef);
    if (!htmlBytes) continue;
    const assets = extractPublicAssetRefs(htmlBytes.toString("utf8"));
    if (assets.length > 0) rows.push({ draftId: post.draftId, slug: post.slug, assets });
  }
  rows.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const bundle = publicAssetsBundleSchema.parse({
    version: PUBLIC_ASSETS_VERSION,
    tenantId,
    generatedAtMs: nowMs,
    posts: rows,
  });
  await objectStore.put(publicAssetsKey(tenantId), JSON.stringify(bundle));
  return bundle;
}

export type PublicAssetReadResult =
  /** Gate passed, bytes verified — serve with immutable caching. */
  | { status: "ok"; bytes: Buffer; contentType: string }
  /** Not on the allowlist (or no allowlist yet) — the route 404s; the store was never probed. */
  | { status: "not_public" }
  /** Allowlisted but the pinned bytes are gone — an integrity break (assets/ is sweep-protected; deletion is a deliberate human act), surfaced as 503, never a quiet 404. */
  | { status: "missing" };

/**
 * The public route's ONE read (SPINE §80 — the web app calls engine
 * services, never the store directly), gate-first: membership is checked
 * BEFORE any asset read, so unlisted names cost zero store probes beyond
 * the allowlist pointer. The read itself is the B4.6 verified read —
 * tampered bytes throw ContentAddressMismatchError through the route
 * (fail-loud, never served).
 */
export async function readPublicAssetBytes(
  tenantId: string,
  ref: PublicAssetRef,
  objectStore: ObjectStore = getObjectStore(),
): Promise<PublicAssetReadResult> {
  const contentType = PUBLIC_ASSET_CONTENT_TYPES[ref.ext];
  if (!contentType) return { status: "not_public" };
  const bundle = await readPublicAssets(tenantId, objectStore);
  const listed = bundle?.posts.some((row) =>
    row.assets.some((a) => a.contentHash === ref.contentHash && a.ext === ref.ext),
  );
  if (!listed) return { status: "not_public" };
  const bytes = await readPinnedAsset(objectStore, pinnedAssetKey(ref.contentHash, ref.ext));
  if (!bytes) return { status: "missing" };
  return { status: "ok", bytes, contentType };
}
