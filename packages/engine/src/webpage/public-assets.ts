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
 *
 * B-ig.1 (s86) — THE PENDING FAMILY, and the exact amount this widens the
 * gate. A social image is not a blog image: it lives in `social-media/`, is
 * usually not pinned at all, and at publish time the post it belongs to does
 * not exist yet, so no published artifact can ever admit it. The `pending`
 * rows below close that chicken-and-egg WITHOUT weakening the rule above:
 * one row per (draft, platform, image), written by the publish door
 * immediately before the platform call and revoked the instant it returns,
 * expiring on its own five minutes later if the process dies in between.
 * The gate's invariant becomes:
 *
 *   an attacker can fetch exactly the images the blog already shows — PLUS,
 *   for at most five minutes, the one image of a post being published right
 *   now, for a driver that declared it publishes by address.
 *
 * It is deliberately NOT "any social-media ref is public", and an
 * approved-but-never-published draft's image is never reachable: only the
 * door's admission writes a row, and only for the publish it is making.
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

/**
 * Which object families a PENDING row may name — a CLOSED set, never a free
 * prefix. It is what stops the pending path from becoming an
 * arbitrary-prefix read of the object store: today the social publish door's
 * media family, and nothing else.
 */
export const PENDING_PUBLIC_ASSET_FAMILIES = ["social-media"] as const;
export type PendingPublicAssetFamily = (typeof PENDING_PUBLIC_ASSET_FAMILIES)[number];

/**
 * How long an admission survives without a revoke. Long enough for Meta to
 * dereference `image_url` during the container call (the address is not
 * needed after that response); short enough that a process dying between
 * admit and revoke leaks one image for minutes, not forever. Revocation is
 * the normal path — this is only the crash backstop.
 */
export const PENDING_PUBLIC_ASSET_TTL_MS = 5 * 60 * 1000;

/**
 * One publish-scoped admission. NOTE WHAT IS ABSENT: the source object key.
 * It is RECONSTRUCTED on read as `objectKey(family, contentHash, ext)`,
 * never stored — see `pendingSourceKey`.
 */
export const pendingPublicAssetSchema = z.object({
  /** The draft being published — the admission's scope and its audit key. */
  draftId: z.string().min(1),
  /** The platform the address was opened for — admission is never platform-blind. */
  platform: z.string().min(1),
  family: z.enum(PENDING_PUBLIC_ASSET_FAMILIES),
  contentHash: z.string().regex(SHA256_HEX_RE),
  ext: z.string().regex(/^[a-z0-9]+$/),
  /** Ms epoch; served only while STRICTLY greater than the reader's clock. */
  expiresAtMs: z.number(),
});
export type PendingPublicAsset = z.infer<typeof pendingPublicAssetSchema>;

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
  /**
   * B-ig.1: the publish-scoped admissions (above). `.default([])` on purpose:
   * every bundle written before this field existed parses unchanged, so the
   * family lands with NO version bump and NO migration.
   */
  pending: z.array(pendingPublicAssetSchema).default([]),
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
 * The pending row's source key, RECONSTRUCTED — never stored, and this is
 * the whole point of storing `family` instead of a key. A row that carried
 * its own key could pair `contentHash: B` with a key naming hash `A`, and
 * the door would then serve A's bytes at B's URL: a content-addressed,
 * `immutable`-cached address serving something that is not its content.
 * Deriving the key from the row's own hash makes that unrepresentable — the
 * hash in the URL IS the hash in the key, by construction — and
 * `getContentAddressed` still re-hashes the bytes and refuses on mismatch.
 */
function pendingSourceKey(row: Pick<PendingPublicAsset, "family" | "contentHash" | "ext">): string {
  return objectKey(row.family, row.contentHash, row.ext);
}

/**
 * The publish door's side of the same grammar: turn a draft's verbatim media
 * ref (`social-media/<sha256>.<ext>`) into an admissible (family, ref) pair,
 * or null. Fail-closed at three points — a family outside the closed set, a
 * hash that is not 64 lowercase hex, and an extension the public door would
 * refuse to serve anyway. Null means "no address", which the caller turns
 * into the driver's honest refusal, never a dead URL handed to a platform.
 */
export function parsePendingPublicAssetRef(
  ref: string,
): { family: PendingPublicAssetFamily; ref: PublicAssetRef } | null {
  const match = /^([a-z][a-z0-9-]*)\/([0-9a-f]{64})\.([a-z0-9]+)$/.exec(ref);
  if (!match) return null;
  const [, family, contentHash, ext] = match;
  if (!PENDING_PUBLIC_ASSET_FAMILIES.includes(family as PendingPublicAssetFamily)) return null;
  if (!(ext in PUBLIC_ASSET_CONTENT_TYPES)) return null;
  return { family: family as PendingPublicAssetFamily, ref: { contentHash, ext } };
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
    // A web-page publish carries live admissions FORWARD (dropping them would
    // silently break a social publish that is mid-flight) but prunes the
    // expired ones — every write to this bundle heals it.
    pending: livePendingRows(existing?.pending, request.nowMs),
  });
  await objectStore.put(publicAssetsKey(tenantId), JSON.stringify(bundle));
  return bundle;
}

/** Expired rows are dead on arrival: dropped by every write, never served by the read. */
function livePendingRows(
  rows: readonly PendingPublicAsset[] | undefined,
  nowMs: number,
): PendingPublicAsset[] {
  return (rows ?? []).filter((row) => row.expiresAtMs > nowMs);
}

/** One admission's identity: a draft's ONE image on ONE platform. Re-admitting the same triple replaces its row. */
function sameAdmission(
  row: PendingPublicAsset,
  request: { draftId: string; platform: string; ref: PublicAssetRef },
): boolean {
  return (
    row.draftId === request.draftId &&
    row.platform === request.platform &&
    row.contentHash === request.ref.contentHash &&
    row.ext === request.ref.ext
  );
}

/** Deterministic serialization, like sortPosts: one byte-sequence per content. */
function sortPending(rows: PendingPublicAsset[]): PendingPublicAsset[] {
  const order = (row: PendingPublicAsset): string[] => [
    row.draftId,
    row.platform,
    row.contentHash,
    row.ext,
  ];
  return rows.sort((a, b) => {
    // Field by field, never a joined string: any separator character can
    // itself appear in a field and make two different rows compare equal.
    const left = order(a);
    const right = order(b);
    for (let i = 0; i < left.length; i += 1) {
      if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1;
    }
    return 0;
  });
}

export interface AdmitPendingPublicAssetRequest {
  draftId: string;
  platform: string;
  family: PendingPublicAssetFamily;
  ref: PublicAssetRef;
  /** The publish's "now", ms epoch (the clock is an argument, never read in core). */
  nowMs: number;
  /** Override the 5-minute default — tests only; the door never passes one. */
  ttlMs?: number;
}

/**
 * B-ig.1's write: open ONE image's address for ONE draft on ONE platform,
 * for `PENDING_PUBLIC_ASSET_TTL_MS`. Called by the social publish door
 * immediately before the platform call and undone by
 * `revokePendingPublicAsset` the instant it returns — the TTL only matters
 * if the process dies in between.
 *
 * Deliberately narrow: it never touches `posts` (the published allowlist is
 * not this mechanism's business), it names the family from a closed set, and
 * it stores no object key. Concurrency is last-write-wins on the pointer,
 * exactly like `recordPublicAssets`: a racing write can drop a live
 * admission, which fails THAT publish loudly (the platform cannot fetch the
 * image) and never opens anything extra.
 */
export async function admitPendingPublicAsset(
  tenantId: string,
  request: AdmitPendingPublicAssetRequest,
  objectStore: ObjectStore = getObjectStore(),
): Promise<PublicAssetsBundle> {
  const existing = await readPublicAssets(tenantId, objectStore);
  const rows = livePendingRows(existing?.pending, request.nowMs).filter(
    (row) => !sameAdmission(row, request),
  );
  rows.push({
    draftId: request.draftId,
    platform: request.platform,
    family: request.family,
    contentHash: request.ref.contentHash,
    ext: request.ref.ext,
    expiresAtMs: request.nowMs + (request.ttlMs ?? PENDING_PUBLIC_ASSET_TTL_MS),
  });
  const bundle = publicAssetsBundleSchema.parse({
    version: PUBLIC_ASSETS_VERSION,
    tenantId,
    generatedAtMs: request.nowMs,
    posts: existing?.posts ?? [],
    pending: sortPending(rows),
  });
  await objectStore.put(publicAssetsKey(tenantId), JSON.stringify(bundle));
  return bundle;
}

export interface RevokePendingPublicAssetRequest {
  draftId: string;
  platform: string;
  ref: PublicAssetRef;
  nowMs: number;
}

/**
 * The normal end of an admission — the publish door calls this in a
 * `finally`, on success AND on failure, so a refused post never leaves an
 * image public. Returns null when the tenant has no bundle at all (nothing
 * to revoke); a no-op revoke writes nothing.
 */
export async function revokePendingPublicAsset(
  tenantId: string,
  request: RevokePendingPublicAssetRequest,
  objectStore: ObjectStore = getObjectStore(),
): Promise<PublicAssetsBundle | null> {
  const existing = await readPublicAssets(tenantId, objectStore);
  if (!existing) return null;
  const rows = livePendingRows(existing.pending, request.nowMs).filter(
    (row) => !sameAdmission(row, request),
  );
  if (rows.length === existing.pending.length) return existing;
  const bundle = publicAssetsBundleSchema.parse({
    version: PUBLIC_ASSETS_VERSION,
    tenantId,
    generatedAtMs: request.nowMs,
    posts: existing.posts,
    pending: sortPending(rows),
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
 *
 * PENDING ROWS ARE DROPPED, on purpose. A rebuild re-derives the bundle from
 * published artifacts, and a publish-scoped admission is by definition not
 * derivable from one. So a rebuild racing a social publish breaks THAT
 * publish loudly — the platform cannot fetch the image, the driver surfaces
 * the platform's error, nothing is recorded. Rebuild is disaster recovery,
 * not a hot path; fail-closed is the trade taken deliberately.
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
    pending: [],
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

export interface ReadPublicAssetOptions {
  /**
   * The reader's "now", ms epoch — and the ONLY thing that opens the pending
   * path (B-ig.1). Absent, pending rows are ignored ENTIRELY: every caller
   * written before this field stays byte-identical, and enabling the
   * publish-scoped window is a deliberate act at the one door that wants it,
   * never a side effect of the family existing.
   */
  nowMs?: number;
}

/**
 * The public route's ONE read (SPINE §80 — the web app calls engine
 * services, never the store directly), gate-first: membership is checked
 * BEFORE any asset read, so unlisted names cost zero store probes beyond
 * the allowlist pointer. The read itself is the B4.6 verified read —
 * tampered bytes throw ContentAddressMismatchError through the route
 * (fail-loud, never served).
 *
 * Membership, in strict order: a PUBLISHED row (the B-pub.4 gate, unchanged,
 * pin store) → else a live PENDING row for exactly this hash+ext, only when
 * a clock was supplied (B-ig.1, source store, key reconstructed) → else
 * `not_public`. Published always wins, so the pending family can never
 * change the answer for an asset the blog already shows.
 */
export async function readPublicAssetBytes(
  tenantId: string,
  ref: PublicAssetRef,
  objectStore: ObjectStore = getObjectStore(),
  options: ReadPublicAssetOptions = {},
): Promise<PublicAssetReadResult> {
  const contentType = PUBLIC_ASSET_CONTENT_TYPES[ref.ext];
  if (!contentType) return { status: "not_public" };
  const bundle = await readPublicAssets(tenantId, objectStore);
  if (!bundle) return { status: "not_public" };

  const listed = bundle.posts.some((row) =>
    row.assets.some((a) => a.contentHash === ref.contentHash && a.ext === ref.ext),
  );
  if (listed) {
    const bytes = await readPinnedAsset(objectStore, pinnedAssetKey(ref.contentHash, ref.ext));
    if (!bytes) return { status: "missing" };
    return { status: "ok", bytes, contentType };
  }

  const { nowMs } = options;
  if (nowMs === undefined) return { status: "not_public" };
  const admitted = bundle.pending.find(
    (row) =>
      row.contentHash === ref.contentHash && row.ext === ref.ext && row.expiresAtMs > nowMs,
  );
  if (!admitted) return { status: "not_public" };
  // The key is DERIVED from the row (never stored — see pendingSourceKey), and
  // getContentAddressed re-hashes what it reads: the bytes served at
  // `<hash>.<ext>` provably hash to `<hash>` or nothing is served at all.
  const bytes = await getContentAddressed(objectStore, pendingSourceKey(admitted));
  if (!bytes) return { status: "missing" };
  return { status: "ok", bytes, contentType };
}
