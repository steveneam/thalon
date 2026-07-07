import { describe, expect, it } from "vitest";
import { SEED_POSTS } from "@/lib/blog/posts";
import sitemap from "./sitemap";

describe("sitemap", () => {
  it("auto-extends with the blog index and every post (§9)", async () => {
    const entries = await sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls[0]).toMatch(/\/$/);
    expect(urls).toContainEqual(expect.stringMatching(/\/blog$/));
    for (const post of SEED_POSTS) {
      expect(urls).toContainEqual(expect.stringMatching(new RegExp(`/blog/${post.slug}$`)));
    }
  });
});
