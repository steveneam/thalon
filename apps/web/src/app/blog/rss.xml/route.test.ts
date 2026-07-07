import { describe, expect, it } from "vitest";
import { SEED_POSTS } from "@/lib/blog/posts";
import { GET } from "./route";

describe("GET /blog/rss.xml (§9)", () => {
  it("serves an RSS 2.0 feed with one item per post from the shared content module", async () => {
    const res = await GET();
    expect(res.headers.get("content-type")).toContain("application/rss+xml");
    const body = await res.text();
    expect(body).toMatch(/^<\?xml version="1\.0"/);
    expect(body).toContain('<rss version="2.0"');
    expect(body.match(/<item>/g)).toHaveLength(SEED_POSTS.length);
    for (const post of SEED_POSTS) {
      expect(body).toContain(`/blog/${post.slug}</link>`);
    }
  });

  it("escapes XML-significant characters in titles and descriptions", async () => {
    const body = await (await GET()).text();
    // No raw ampersands or angle brackets may survive outside tags — every
    // post title with "&" or "<" would otherwise corrupt the feed.
    const textNodes = [...body.matchAll(/<(title|description)>([\s\S]*?)<\/\1>/g)].map((m) => m[2]);
    for (const text of textNodes) {
      expect(text).not.toMatch(/&(?!amp;|lt;|gt;|quot;|#)/);
      expect(text).not.toContain("<");
    }
  });
});
