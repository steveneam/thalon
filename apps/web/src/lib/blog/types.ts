import { z } from "zod";

/**
 * Blog wire types (§9, workspace-ux-v2.md): the /blog surfaces render
 * `BlogPostCard` and never know which era produced it — seed posts are
 * tracked content in this app; engine-published posts arrive later via the
 * posts bundle (the lib/intel/live.ts precedent: one wire shape, two
 * sources, components stay era-blind).
 */

/** What the index, sitemap, RSS, and llms.txt all render — era-blind. */
export interface BlogPostCard {
  slug: string;
  title: string;
  /** Answer-first summary — doubles as the meta description and RSS item body. */
  description: string;
  /** ISO timestamp. */
  publishedAt: string;
  tags: string[];
}

/** One body section of a seed post; headings are question-shaped where natural (AEO). */
export interface PostSection {
  heading?: string;
  paragraphs: string[];
}

/** A seed post: tracked content, lead/founder-authored, reviewed before deploy. */
export interface SeedPost extends BlogPostCard {
  sections: PostSection[];
}

/**
 * POSTS-BUNDLE MINI-CONTRACT (wave 3.5): `posts/<tenantId>.json`, written by
 * the origination lane's own-site publish door. This schema is the frozen
 * wire shape — friction with it is a stop-and-report, never an ad-hoc edit.
 */
export const postsBundleEntrySchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  draftId: z.string().min(1),
  /** Object-store ref of the approved post HTML (resolved when the live read arms). */
  htmlRef: z.string().min(1),
  publishedAtMs: z.number().int().nonnegative(),
  seo: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

export const postsBundleSchema = z.object({
  version: z.literal(1),
  tenantId: z.string().min(1),
  generatedAtMs: z.number().int().nonnegative(),
  posts: z.array(postsBundleEntrySchema),
});

export type PostsBundleEntry = z.infer<typeof postsBundleEntrySchema>;
export type PostsBundle = z.infer<typeof postsBundleSchema>;
