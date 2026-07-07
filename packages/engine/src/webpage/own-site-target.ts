import type { DeployTarget } from "./deploy-target";

/**
 * B6.6: the own-site DeployTarget — the blog publish door's seam half
 * (workspace-ux-v2 §9: the Page family's destination is OUR OWN site; the
 * social publish path stays pulled). An own-site "deploy" moves no bytes:
 * the judged artifact already lives content-addressed in the tenant's own
 * object store, and the site's /blog route serves it through the posts
 * bundle (./posts.ts) — so this target just reports the site-relative URL
 * the page will live at. Like every DeployTarget it persists NOTHING in
 * Thalon (the bundle write is core work in ./publish.ts, the one caller
 * that constructs this target); the slug is core math resolved BEFORE the
 * deploy, passed in as data.
 *
 * The reported URL is site-relative (`/blog/<slug>`) on purpose — the
 * domain isn't known until the B6.7 deploy, and a relative ref stays true
 * across vercel.app → thalon.org.
 */
export function createOwnSiteDeployTarget(opts: { slug: string }): DeployTarget {
  return {
    name: "own-site",
    async deploy() {
      return { url: `/blog/${opts.slug}` };
    },
  };
}
