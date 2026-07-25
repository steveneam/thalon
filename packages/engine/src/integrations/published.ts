import type { TenantCtx } from "@thalon/contracts";
import type { Repos } from "@thalon/db";
import { getObjectStore, type ObjectStore } from "@thalon/platform";
import { readPublishedPosts } from "../webpage/posts";

/**
 * B-int.2 (ADR 0011): the PUBLISHED VIEW — one merged, newest-first answer
 * to "what actually went out, and where", joining the two ledgers that
 * already exist: the social publication ledger (platform-accepted posts,
 * append-only) and the own-site posts bundle (web deployRefs). This closes
 * FEATURE-MAP's `/blog` partial: the workspace finally has a path to what
 * got published. Read-only over both sources — nothing here mutates, and
 * the Source-Link Rule is served by every item carrying its way back
 * (platform permalink · /blog path).
 */

export interface PublishedSocialItem {
  kind: "social";
  platform: string;
  draftId: string;
  externalPostId: string;
  /** The way back (Source-Link Rule): recorded by the driver, or derived from the platform's canonical URL shape. */
  permalink: string | null;
  /** First line of the judged body that went out — recognition, not the record (the draft is). */
  excerpt: string;
  publishedAtMs: number;
}

export interface PublishedWebItem {
  kind: "web";
  slug: string;
  title: string;
  /** The way back: the live path under the app's own /blog. */
  path: string;
  draftId: string;
  publishedAtMs: number;
}

export type PublishedItem = PublishedSocialItem | PublishedWebItem;

export interface PublishedView {
  /** Merged newest-first, bounded by the read's limit. */
  items: PublishedItem[];
  /** Honest totals behind the bound (Bounded-List Rule: never pretend the bound is everything). */
  socialTotal: number;
  webTotal: number;
}

/**
 * A publication's permalink: the driver-recorded one wins; absent it (the
 * Facebook photo leg records ids only), the platform's canonical URL shape
 * derives one from the accepted post id. Null for a platform with no known
 * shape — the UI shows the id as identity text, never a fake link.
 */
export function socialPermalink(
  platform: string,
  externalPostId: string,
  meta: Record<string, unknown>,
): string | null {
  const recorded = meta.permalink;
  if (typeof recorded === "string" && recorded.startsWith("https://")) return recorded;
  switch (platform) {
    case "linkedin":
      return `https://www.linkedin.com/feed/update/${externalPostId}`;
    case "x":
      return `https://x.com/i/web/status/${externalPostId}`;
    case "facebook":
      return `https://www.facebook.com/${externalPostId}`;
    default:
      return null;
  }
}

/** One line, bounded — enough to recognize the post, honest about being a cut. */
function excerptOf(body: string): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > 140 ? `${flat.slice(0, 139)}…` : flat;
}

export async function readPublishedView(
  ctx: TenantCtx,
  repos: Repos,
  opts: { limit?: number; objectStore?: ObjectStore } = {},
): Promise<PublishedView> {
  const limit = opts.limit ?? 50;
  const { rows, total } = await repos.socialPublications.listRecent(ctx, limit);

  // One draft read per unique draft — the list is already bounded.
  const excerpts = new Map<string, string>();
  for (const row of rows) {
    if (!excerpts.has(row.draftId)) {
      const draft = await repos.drafts.get(ctx, row.draftId);
      excerpts.set(row.draftId, excerptOf(draft.body));
    }
  }
  const social: PublishedItem[] = rows.map((row) => ({
    kind: "social",
    platform: row.platform,
    draftId: row.draftId,
    externalPostId: row.externalPostId,
    permalink: socialPermalink(
      row.platform,
      row.externalPostId,
      (row.meta ?? {}) as Record<string, unknown>,
    ),
    excerpt: excerpts.get(row.draftId) ?? "",
    publishedAtMs: row.publishedAt.getTime(),
  }));

  const objectStore = opts.objectStore ?? getObjectStore();
  const bundle = await readPublishedPosts(ctx.tenantId, objectStore);
  const web: PublishedItem[] = (bundle?.posts ?? []).map((post) => ({
    kind: "web",
    slug: post.slug,
    title: post.title,
    path: `/blog/${post.slug}`,
    draftId: post.draftId,
    publishedAtMs: post.publishedAtMs,
  }));

  const items = [...social, ...web]
    .sort((a, b) => b.publishedAtMs - a.publishedAtMs)
    .slice(0, limit);
  return { items, socialTotal: total, webTotal: web.length };
}
