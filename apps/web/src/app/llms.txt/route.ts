import { FAQ } from "@/lib/landing/copy";
import { SITE_TAGLINE, SITE_URL } from "@/lib/site";

/**
 * llms.txt (A13 AEO/GEO pack, docs/FRONTEND.md §4): the answer-engine
 * summary of the site, generated from the SAME copy module as the page so
 * the claims can never drift apart. Prerendered at build (force-static).
 */
export const dynamic = "force-static";

export function GET(): Response {
  const faqLines = FAQ.map((f) => `- ${f.question} ${f.answer}`).join("\n");
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

## Pages

- [Home](${SITE_URL}/): product overview, features, early-access pricing, FAQ, waitlist.
`;

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
