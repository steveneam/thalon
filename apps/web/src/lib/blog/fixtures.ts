import type { PostsBundle } from "./types";

/**
 * A posts bundle exactly as the origination lane's publish door writes it
 * (the wave-3.5 mini-contract) — keeps the read seam honest while it is
 * disarmed: tests parse and map THIS shape, so arming the live read at the
 * merge train is a wiring change, not a shape change.
 */
export const fixturePostsBundle: PostsBundle = {
  version: 1,
  tenantId: "tenant-0",
  generatedAtMs: 1_783_468_800_000, // 2026-07-07T16:00:00.000Z
  posts: [
    {
      slug: "engine-published-example",
      title: "An engine-published example post",
      description: "Written by the origination loop, judged, approved, published to this site.",
      draftId: "draft-fixture-1",
      htmlRef: "posts/html/draft-fixture-1.html",
      publishedAtMs: 1_783_465_200_000,
      seo: { metaTitle: "An engine-published example post" },
      tags: ["example"],
    },
  ],
};
