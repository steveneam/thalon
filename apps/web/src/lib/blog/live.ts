import type { BlogPostCard, PostsBundle, PostsBundleEntry } from "./types";
import { postsBundleSchema } from "./types";

/**
 * The live half of the blog read (§9, the lib/intel/live.ts precedent):
 * engine-published posts arrive as a posts bundle at `posts/<tenantId>.json`
 * — written by the origination lane's own-site publish door, schema-pinned
 * in ./types.ts. This module maps bundle entries onto the SAME BlogPostCard
 * wire shape the seed posts use, so the components never know which era
 * they render.
 *
 * SEAM — DISARMED (wave 3.5): the object-store read below is deliberately
 * not wired; the lead arms it at the merge train once the origination
 * lane's export is on main. Until then /blog degrades honestly to
 * seed-posts-only. Arming = replace the `return []` with the bundle
 * read + parse + map, roughly:
 *
 *   const raw = await readPostsBundle(tenantId);        // engine export
 *   const bundle = parsePostsBundle(raw);
 *   return bundle ? bundle.posts.map(toBlogPostCard) : [];
 */
export async function readEnginePosts(): Promise<BlogPostCard[]> {
  return [];
}

/** Bundle text/JSON → validated bundle, or null (malformed bundles degrade, never throw into the page). */
export function parsePostsBundle(raw: unknown): PostsBundle | null {
  const result = postsBundleSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/** Bundle entry → the era-blind card the index/sitemap/RSS render. */
export function toBlogPostCard(entry: PostsBundleEntry): BlogPostCard {
  return {
    slug: entry.slug,
    title: entry.title,
    description: entry.description,
    publishedAt: new Date(entry.publishedAtMs).toISOString(),
    tags: entry.tags ?? [],
  };
}
