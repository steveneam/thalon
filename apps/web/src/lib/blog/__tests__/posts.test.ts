import { describe, expect, it } from "vitest";
import { BLOG_TAGLINE, getSeedPost, listPosts, POST_DISCLOSURE, SEED_POSTS } from "../posts";

/**
 * Content-module pins (§9): the honesty guardrails on the blog are
 * executable, not editorial — cadence stays "regularly" until daily is
 * proven, rankings are never promised, and every post carries the
 * disclosure stance. A post edit that breaks a guardrail fails here.
 */
describe("blog content module", () => {
  it("ships 2–3 seed posts with unique kebab-case slugs", () => {
    expect(SEED_POSTS.length).toBeGreaterThanOrEqual(2);
    expect(SEED_POSTS.length).toBeLessThanOrEqual(3);
    const slugs = SEED_POSTS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("keeps every post SEO-shaped: description ≤ 160 chars, valid ISO date, ≥1 tag, body sections", () => {
    for (const post of SEED_POSTS) {
      expect(post.description.length).toBeLessThanOrEqual(160);
      expect(Number.isNaN(Date.parse(post.publishedAt))).toBe(false);
      expect(post.tags.length).toBeGreaterThanOrEqual(1);
      expect(post.sections.length).toBeGreaterThanOrEqual(2);
      for (const section of post.sections) {
        expect(section.paragraphs.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("holds the cadence-honesty rule: 'regularly', never a daily-publishing claim (ADR 0006)", () => {
    expect(BLOG_TAGLINE).toContain("regularly");
    expect(BLOG_TAGLINE).not.toMatch(/daily|every day/i);
  });

  it("holds the honest-claims rule across all post text: no rankings promises", () => {
    const allText = SEED_POSTS.flatMap((p) => [
      p.title,
      p.description,
      ...p.sections.flatMap((s) => [s.heading ?? "", ...s.paragraphs]),
    ]).join(" ");
    expect(allText).not.toMatch(/rank #|first page of google|guaranteed ranking|we promise rankings/i);
  });

  it("carries the FAQ's AI-disclosure stance onto posts (§9 guardrail 2)", () => {
    expect(POST_DISCLOSURE).toMatch(/reviewed by a human/i);
  });

  it("lists posts newest-first and looks up seed posts by slug", async () => {
    const posts = await listPosts();
    expect(posts.length).toBe(SEED_POSTS.length);
    const times = posts.map((p) => Date.parse(p.publishedAt));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(getSeedPost(SEED_POSTS[0].slug)?.title).toBe(SEED_POSTS[0].title);
    expect(getSeedPost("no-such-post")).toBeUndefined();
  });
});
