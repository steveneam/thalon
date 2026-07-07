import { describe, expect, it } from "vitest";
import { fixturePostsBundle } from "../fixtures";
import { parsePostsBundle, readEnginePosts, toBlogPostCard } from "../live";

/**
 * Posts-bundle seam pins (the wave-3.5 mini-contract): the fixture IS the
 * shape the origination lane's publish door writes — parsing and mapping
 * are proven here while the live read stays disarmed, so arming it at the
 * merge train is wiring, not shape work.
 */
describe("blog live seam (posts bundle)", () => {
  it("stays disarmed: the engine read returns no posts until the lead arms it", async () => {
    expect(await readEnginePosts()).toEqual([]);
  });

  it("parses the mini-contract fixture verbatim", () => {
    expect(parsePostsBundle(fixturePostsBundle)).toEqual(fixturePostsBundle);
  });

  it("degrades malformed bundles to null, never a throw into the page", () => {
    expect(parsePostsBundle(null)).toBeNull();
    expect(parsePostsBundle({ ...fixturePostsBundle, version: 2 })).toBeNull();
    expect(parsePostsBundle({ ...fixturePostsBundle, posts: [{ slug: "x" }] })).toBeNull();
  });

  it("maps a bundle entry onto the era-blind card shape", () => {
    const entry = fixturePostsBundle.posts[0];
    expect(toBlogPostCard(entry)).toEqual({
      slug: entry.slug,
      title: entry.title,
      description: entry.description,
      publishedAt: new Date(entry.publishedAtMs).toISOString(),
      tags: ["example"],
    });
    expect(toBlogPostCard({ ...entry, tags: undefined }).tags).toEqual([]);
  });
});
