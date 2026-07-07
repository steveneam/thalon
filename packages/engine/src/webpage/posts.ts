import { seoMetaSchema, type TenantCtx } from "@thalon/contracts";
import type { Repos } from "@thalon/db";
import { getContentAddressed, getObjectStore, objectKey, type ObjectStore } from "@thalon/platform";
import { z } from "zod";
import { webPageDraftMetaSchema } from "./schemas";

/**
 * B6.6: the published-posts bundle — the blog's wire-ready read model. ONE
 * object per tenant at `posts/<tenantId>.json`, a MUTABLE POINTER family
 * (latest-wins, overwritten on every publish) mirroring `sweeps/<tenantId>
 * .json` (../trend/sweep.ts) exactly: version field, schema-validated read,
 * protected from the B4.6 orphan sweep because no db row references it by
 * design (eval/src/sweep-object-store.ts PROTECTED_PREFIXES), and
 * REBUILDABLE from the drafts table if ever lost — the durable truth stays
 * the approved `web_page` draft + its content-addressed `web-pages/<sha256>
 * .html` artifact; this bundle is derived state.
 *
 * The shape is a MINI-CONTRACT with the web lane (session-20 kickoffs pin
 * it in both lanes): `{version: 1, tenantId, generatedAtMs, posts: [{slug,
 * title, description, draftId, htmlRef, publishedAtMs, seo?, tags?}]}`.
 * `slug` is deterministic core math at publish (./publish.ts) — slugified
 * title with collision handling inside the bundle — NOT a meta-schema
 * change; the frozen `web_page` meta already carries everything else.
 */

export const POSTS_BUNDLE_VERSION = 1;

/** Where a tenant's published-posts bundle lives. */
export function postsBundleKey(tenantId: string): string {
  return objectKey("posts", tenantId, "json");
}

export const publishedPostSchema = z.object({
  /** URL path segment under /blog/ — unique within the bundle, stable across republishes of the same draft. */
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  draftId: z.string().min(1),
  /** The judged artifact's content-addressed key — what the blog route serves IS what was judged. */
  htmlRef: z.string().min(1),
  publishedAtMs: z.number(),
  /** The contract seoMetaSchema passthrough when the draft meta carries it (B6.8 capability). */
  seo: seoMetaSchema.optional(),
  /** Operator-set tags at publish — bundle data, never draft meta. */
  tags: z.array(z.string().min(1)).optional(),
});
export type PublishedPost = z.infer<typeof publishedPostSchema>;

export const postsBundleSchema = z.object({
  version: z.literal(POSTS_BUNDLE_VERSION),
  tenantId: z.string().min(1),
  generatedAtMs: z.number(),
  posts: z.array(publishedPostSchema),
});
export type PostsBundle = z.infer<typeof postsBundleSchema>;

/** The route-side read: the tenant's published posts, schema-validated, or null before the first publish (mirrors readSweepBundle). */
export async function readPublishedPosts(
  tenantId: string,
  objectStore: ObjectStore = getObjectStore(),
): Promise<PostsBundle | null> {
  const raw = await objectStore.get(postsBundleKey(tenantId));
  if (!raw) return null;
  return postsBundleSchema.parse(JSON.parse(raw.toString("utf8")));
}

/**
 * The blog's post-body read (SPINE §80 — the web app calls engine services,
 * never the store directly): a bundle entry's `htmlRef` names the approved
 * draft's content-addressed `web-pages/<sha256>.html` artifact, so the read
 * is VERIFIED (B4.6 `getContentAddressed` — corrupted bytes refuse loudly).
 * The artifact is script-free and network-free BY CONSTRUCTION
 * (`selfContainmentViolations` gates generation before judging), which is
 * what makes rendering its markup on /blog safe. Null when the artifact is
 * missing — the caller 404s honestly rather than inventing a body.
 */
export async function readPublishedPageHtml(
  htmlRef: string,
  objectStore: ObjectStore = getObjectStore(),
): Promise<string | null> {
  const bytes = await getContentAddressed(objectStore, htmlRef);
  return bytes ? bytes.toString("utf8") : null;
}

/**
 * Deterministic slug math: lowercase, runs of non-alphanumerics collapse to
 * one hyphen, trimmed. A title with no usable characters falls back to
 * `post-<draftId first 8>` so the slug is never empty and stays
 * deterministic per draft.
 */
export function slugifyTitle(title: string, draftId: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `post-${draftId.slice(0, 8)}`;
}

/**
 * Slug resolution against the bundle: a draft already published keeps ITS
 * slug forever (republish stability — the URL is the reader's bookmark);
 * a fresh draft takes the slugified title, `-2`/`-3`-suffixed until it
 * collides with no OTHER draft's slug.
 */
export function resolvePostSlug(title: string, draftId: string, posts: readonly PublishedPost[]): string {
  const prior = posts.find((post) => post.draftId === draftId);
  if (prior) return prior.slug;
  const taken = new Set(posts.filter((post) => post.draftId !== draftId).map((post) => post.slug));
  const base = slugifyTitle(title, draftId);
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Canonical bundle order: oldest publish first, slug tie-break — one deterministic serialization per content, publish path and rebuild alike. */
export function sortPosts(posts: readonly PublishedPost[]): PublishedPost[] {
  return [...posts].sort(
    (a, b) => a.publishedAtMs - b.publishedAtMs || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0),
  );
}

/** The own-site deployRef convention (./own-site-target.ts) — the rebuild's filter and slug source. */
const OWN_SITE_REF_PREFIX = "/blog/";

export interface RebuildPostsBundleRequest {
  /** The rebuild's "now", ms epoch — stamped as generatedAtMs (the clock is an argument, never read in core). */
  nowMs: number;
}

/**
 * Disaster path: re-derives the bundle from the drafts table — every
 * `web_page` draft whose meta records a successful own-site deploy
 * (`deployStatus: "deployed"`, `deployRef` under /blog/). Two honest
 * degrades, documented because the lost bundle was the only home of the
 * data: `publishedAtMs` falls back to the draft's `updatedAt` (the deploy
 * patch set it — close, not exact), and publish-time operator `tags` are
 * gone (they were bundle data by design); `seo` survives via the draft
 * meta. The rebuilt bundle is written back latest-wins.
 */
export async function rebuildPostsBundle(
  ctx: TenantCtx,
  repos: Repos,
  request: RebuildPostsBundleRequest,
  deps: { objectStore?: ObjectStore } = {},
): Promise<PostsBundle> {
  const objectStore = deps.objectStore ?? getObjectStore();
  const drafts = await repos.drafts.listByFormat(ctx, "web_page");
  const posts: PublishedPost[] = [];
  for (const draft of drafts) {
    const meta = webPageDraftMetaSchema.parse(draft.meta);
    if (meta.deployStatus !== "deployed") continue;
    if (!meta.deployRef?.startsWith(OWN_SITE_REF_PREFIX)) continue;
    posts.push({
      slug: meta.deployRef.slice(OWN_SITE_REF_PREFIX.length),
      title: meta.title,
      description: meta.description,
      draftId: draft.id,
      htmlRef: meta.htmlRef,
      publishedAtMs: draft.updatedAt.getTime(),
      ...(meta.seo ? { seo: meta.seo } : {}),
    });
  }
  const bundle = postsBundleSchema.parse({
    version: POSTS_BUNDLE_VERSION,
    tenantId: ctx.tenantId,
    generatedAtMs: request.nowMs,
    posts: sortPosts(posts),
  });
  await objectStore.put(postsBundleKey(ctx.tenantId), JSON.stringify(bundle));
  return bundle;
}
