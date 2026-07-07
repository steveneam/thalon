import { readPublishedPosts } from "@thalon/engine";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";
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
 * ARMED at the wave-3.5 merge train (the engine export is on main): the
 * read degrades to [] on ANY failure — a malformed bundle or a boot error
 * must never take down /blog, which always has its seed posts. Since B6.7
 * (ADR 0007) the feed routes (rss/llms.txt/sitemap) render per request from
 * this same read, so engine posts reach them immediately; the publish route
 * revalidates the one cached surface, the on-demand `/blog/[slug]` page.
 */
export async function readEnginePosts(): Promise<BlogPostCard[]> {
  try {
    const repos = await getRepos();
    const ctx = await resolveTenantCtx(repos);
    if (!ctx) return [];
    const bundle = await readPublishedPosts(ctx.tenantId);
    return bundle ? bundle.posts.map(toBlogPostCard) : [];
  } catch {
    return [];
  }
}

/** The body page's entry lookup: the bundle row (incl. `htmlRef`) for one engine slug, or null. */
export async function findEnginePost(slug: string): Promise<PostsBundleEntry | null> {
  try {
    const repos = await getRepos();
    const ctx = await resolveTenantCtx(repos);
    if (!ctx) return null;
    const bundle = await readPublishedPosts(ctx.tenantId);
    return bundle?.posts.find((post) => post.slug === slug) ?? null;
  } catch {
    return null;
  }
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
