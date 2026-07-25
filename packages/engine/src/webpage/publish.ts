import type { TenantCtx } from "@thalon/contracts";
import { InvalidStateError, type Draft, type Repos } from "@thalon/db";
import { getContentAddressed, getObjectStore, type ObjectStore } from "@thalon/platform";
import { deployWebPage } from "./deploy";
import { createOwnSiteDeployTarget } from "./own-site-target";
import { extractPublicAssetRefs, recordPublicAssets } from "./public-assets";
import {
  POSTS_BUNDLE_VERSION,
  postsBundleKey,
  postsBundleSchema,
  readPublishedPosts,
  resolvePostSlug,
  sortPosts,
  type PostsBundle,
  type PublishedPost,
} from "./posts";
import { webPageDraftMetaSchema } from "./schemas";

/**
 * B6.6: the own-site publish door — the loop-closer of intel context →
 * page draft → judge → approve → PUBLISH (workspace-ux-v2 §9). Publishing
 * an APPROVED `web_page` draft is two steps, in a crash-honest order:
 *
 *   1. flip `deployStatus`/`deployRef` through the EXISTING deploy.ts core
 *      caller (approved-only gate, content-address-verified artifact read,
 *      optimistic-concurrency meta patch — all B4.1/B3.15 machinery,
 *      reused not forked) against the own-site target;
 *   2. record the artifact's public-asset refs (./public-assets.ts,
 *      B-pub.4) — the image door's allowlist, written before the bundle so
 *      a live page never renders gated images;
 *   3. upsert the tenant's posts bundle (./posts.ts) — the blog's wire
 *      read model.
 *
 * A crash between the last two leaves a deployed draft missing from the bundle;
 * `rebuildPostsBundle` re-derives it from the drafts table (the bundle is
 * declared derived state, so the door heals rather than double-writes).
 * A target failure is recorded on the draft by step 1 and the bundle is
 * left untouched. No social platform is reachable from here — own-site
 * only, on an explicit post-approval call.
 */

export interface PublishWebPageRequest {
  draftId: string;
  /** The publish's "now", ms epoch — first-publish stamp + bundle generatedAtMs (the clock is an argument, never read in core). */
  nowMs: number;
  /** Operator-set tags for the blog surface — bundle data, never draft meta; a republish without tags keeps the prior ones. */
  tags?: string[];
}

export interface PublishWebPageDeps {
  objectStore?: ObjectStore;
}

export type PublishWebPageResult =
  | { status: "published"; draft: Draft; url: string; slug: string; bundle: PostsBundle }
  | { status: "failed"; draft: Draft; error: string };

export async function publishWebPageToSite(
  ctx: TenantCtx,
  repos: Repos,
  request: PublishWebPageRequest,
  deps: PublishWebPageDeps = {},
): Promise<PublishWebPageResult> {
  const objectStore = deps.objectStore ?? getObjectStore();

  // Slug math needs the title before the deploy runs — gate the format here
  // (same message shape as deploy.ts) so a wrong-format draft refuses loudly
  // instead of dying inside the meta parse; the approved-only gate stays
  // with the artifact stage inside deployWebPage.
  const draft = await repos.drafts.get(ctx, request.draftId);
  if (draft.format !== "web_page") {
    throw new InvalidStateError(
      `draft "${request.draftId}" is format "${draft.format}" — the own-site publish door ships ONLY "web_page" drafts`,
    );
  }
  const meta = webPageDraftMetaSchema.parse(draft.meta);
  const existing = await readPublishedPosts(ctx.tenantId, objectStore);
  const posts = existing?.posts ?? [];
  const slug = resolvePostSlug(meta.title, draft.id, posts);

  const outcome = await deployWebPage(ctx, repos, request.draftId, createOwnSiteDeployTarget({ slug }), {
    objectStore,
  });
  if (outcome.status === "failed") {
    return { status: "failed", draft: outcome.draft, error: outcome.error };
  }

  const deployedMeta = webPageDraftMetaSchema.parse(outcome.draft.meta);

  // B-pub.4: record which pinned assets this artifact takes public — BEFORE
  // the bundle write, so a live page never renders gated (404) images. A
  // crash between the two writes leaks nothing: it only admits refs an
  // approved, deployed artifact references, and the next publish or rebuild
  // reconverges both pointers. The artifact was verified by the deploy read
  // a moment ago; a null here means it vanished mid-flight — record no
  // assets (fail-closed) and let the bundle carry the post honestly.
  const htmlBytes = await getContentAddressed(objectStore, deployedMeta.htmlRef);
  await recordPublicAssets(
    ctx.tenantId,
    {
      draftId: draft.id,
      slug,
      assets: extractPublicAssetRefs(htmlBytes ? htmlBytes.toString("utf8") : ""),
      nowMs: request.nowMs,
    },
    objectStore,
  );

  const prior = posts.find((post) => post.draftId === draft.id);
  const entry: PublishedPost = {
    slug,
    title: deployedMeta.title,
    description: deployedMeta.description,
    draftId: draft.id,
    htmlRef: deployedMeta.htmlRef,
    // First-publish time is the reader-facing date and survives republish;
    // the bundle's generatedAtMs carries the refresh time.
    publishedAtMs: prior?.publishedAtMs ?? request.nowMs,
    ...(deployedMeta.seo ? { seo: deployedMeta.seo } : {}),
    ...(request.tags?.length ? { tags: request.tags } : prior?.tags ? { tags: prior.tags } : {}),
  };
  const bundle = postsBundleSchema.parse({
    version: POSTS_BUNDLE_VERSION,
    tenantId: ctx.tenantId,
    generatedAtMs: request.nowMs,
    posts: sortPosts([...posts.filter((post) => post.draftId !== draft.id), entry]),
  });
  await objectStore.put(postsBundleKey(ctx.tenantId), JSON.stringify(bundle));

  return { status: "published", draft: outcome.draft, url: outcome.url, slug, bundle };
}
