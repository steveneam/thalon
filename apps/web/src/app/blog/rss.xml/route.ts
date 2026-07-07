import { BLOG_TAGLINE, BLOG_TITLE, listPosts } from "@/lib/blog/posts";
import { SITE_URL } from "@/lib/site";

/**
 * The blog RSS feed (§9): answer engines and LLM crawlers consume feeds
 * well, and it is nearly free — built from the SAME content module as the
 * pages (the llms.txt precedent). Prerendered at build (force-static);
 * lastBuildDate is the newest post's date, deliberately not "now", so the
 * feed bytes only change when the content does.
 */
export const dynamic = "force-static";

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function GET(): Promise<Response> {
  const posts = await listPosts();
  const newest = posts[0]?.publishedAt;

  const items = posts
    .map((post) => {
      const url = `${SITE_URL}/blog/${post.slug}`;
      const categories = post.tags
        .map((tag) => `      <category>${xmlEscape(tag)}</category>`)
        .join("\n");
      return `    <item>
      <title>${xmlEscape(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
      <description>${xmlEscape(post.description)}</description>
${categories}
    </item>`;
    })
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(BLOG_TITLE)}</title>
    <link>${SITE_URL}/blog</link>
    <description>${xmlEscape(BLOG_TAGLINE)}</description>
    <language>en</language>
${newest ? `    <lastBuildDate>${new Date(newest).toUTCString()}</lastBuildDate>\n` : ""}    <atom:link href="${SITE_URL}/blog/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(body, {
    headers: { "content-type": "application/rss+xml; charset=utf-8" },
  });
}
