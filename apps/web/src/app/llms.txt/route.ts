import { listPosts } from "@/lib/blog/posts";
import { FAQ } from "@/lib/landing/copy";
import { SITE_TAGLINE, SITE_URL } from "@/lib/site";

/**
 * llms.txt (A13 AEO/GEO pack, docs/FRONTEND.md §4): the answer-engine
 * summary of the site, generated from the SAME copy module as the page so
 * the claims can never drift apart — and the SAME content module as /blog
 * for the article index (§9). Rendered per request since B6.7 (ADR 0007):
 * the article index includes engine-published posts, which are runtime
 * data a build-baked response would omit forever.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const faqLines = FAQ.map((f) => `- ${f.question} ${f.answer}`).join("\n");
  const posts = await listPosts();
  const articleLines = posts
    .map((post) => `- [${post.title}](${SITE_URL}/blog/${post.slug}): ${post.description}`)
    .join("\n");
  const body = `# Thalon

> ${SITE_TAGLINE}

Thalon is a multi-tenant AI content engine for brands and operators. One prompt becomes platform-shaped posts, scripted videos with captions, and full web pages. Every draft is checked by an automated judge — each claim grounded to operator-provided sources, the operator's denylist screened — and nothing publishes without explicit human approval.

## What it does

- Intel: operator-described topic areas are watched through official platform APIs; rising items are flagged with deterministic scoring (relevance, engagement ratios, velocity) and plain-language reasons.
- Create: one prompt fans out into posts, video scripts with captions, and landing pages, grounded in the operator's sources and voice profile.
- Everywhere: drafts are platform-shaped and gated behind an approve queue; one-click publishing through official platform APIs is planned for early access.
- Built-in search optimization: pages ship with meta titles and descriptions, question-shaped headings with answer-first paragraphs, JSON-LD structured data, and llms.txt. Thalon optimizes what is checkable; it does not promise rankings.

## FAQ

${faqLines}

## Articles

${articleLines}

## Pages

- [Home](${SITE_URL}/): product overview, features, early-access pricing, FAQ, waitlist.
- [Blog](${SITE_URL}/blog): posts on AI content tooling, answer engines, and honest automation, published regularly. RSS: ${SITE_URL}/blog/rss.xml
`;

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
