import type { BlogPostCard, SeedPost } from "./types";
import { readEnginePosts } from "./live";

/**
 * Seed posts (§9): tracked content so the blog deploys with substance
 * before the engine feeds it — the automated intel → Page → judge →
 * approve → publish loop is B6.6's dogfood, not this module. Every string
 * here is bound by the honest-claims rule (ADR 0006): no invented numbers,
 * no rankings promises, cadence stays "regularly" until daily is proven.
 * Flagged for founder review at the merge train before deploy.
 */

export const BLOG_TITLE = "The Thalon blog";

/** Cadence-honest by rule: "regularly", never "daily", until proven (ADR 0006). */
export const BLOG_TAGLINE =
  "Notes on AI content tooling, answer engines, and honest automation — published regularly.";

/** The FAQ's disclosure stance, applied to posts (§9 guardrail 2). */
export const POST_DISCLOSURE =
  "Drafted with AI assistance and reviewed by a human before publishing — the same approve-before-anything-ships stance Thalon applies to every draft it generates.";

export const SEED_POSTS: SeedPost[] = [
  {
    slug: "why-ai-content-needs-an-approval-gate",
    title: "Why AI content tools need an approval gate, not just a generator",
    description:
      "Ungated AI publishing is a liability engine. What an approval gate is, what a draft judge should check, and why grounding beats fluency.",
    publishedAt: "2026-07-07T00:00:00.000Z",
    tags: ["ai-content", "trust", "automation"],
    sections: [
      {
        paragraphs: [
          "The fastest way to lose an audience is to let a language model publish under your name unsupervised. Generation is largely a solved problem — any modern model will produce fluent, platform-shaped copy on demand. Judgment is not solved. The model does not know which of its claims are true, which phrases your legal team banned last quarter, or which half-remembered statistic will get you ratioed by someone who checks.",
          "That gap between fluency and judgment is where AI content tools quietly become liability engines. The fix is architectural, not promptual: put a gate between generation and publishing, and make passing it non-negotiable.",
        ],
      },
      {
        heading: "What is an approval gate?",
        paragraphs: [
          "An approval gate is a hard stop between generation and publishing: no draft reaches a platform until a human explicitly approves it. It is not a review step you can toggle off in settings — it is the only path to publish. If the tool can post without a click, it does not have an approval gate; it has a suggestion box.",
          "The gate changes the failure mode. Without one, a bad draft is an incident. With one, a bad draft is a rejected card in a queue — annoying, invisible, and cheap.",
        ],
      },
      {
        heading: "What should a draft judge check?",
        paragraphs: [
          "Before a human ever sees a draft, an automated judge should have checked the things machines check well. First, grounding: every factual claim in the draft should trace to a source the operator actually provided — not to the model's training data, not to a hallucinated citation. A claim that cannot be traced is blocked, not flagged.",
          "Second, the denylist: every brand has phrases it must never publish — competitor names, regulated claims, terms a past incident made radioactive. Screening them is deterministic and free; there is no excuse for shipping without it.",
          "Third, voice — the subjective residue. Does the draft sound like the brand? This is the one place model judgment belongs, and it belongs after the deterministic checks, not instead of them.",
        ],
      },
      {
        heading: "Doesn't a gate defeat the point of automation?",
        paragraphs: [
          "No — the gate is what makes real automation tolerable. It moves the human from author to editor: instead of writing five platform variants, you review a judged set and click approve on what ships. Reaction is faster than authoring, and it scales further.",
          "Volume without a gate is not automation, it is spam with your name on it. The tools that skip the gate are optimizing for a demo, not for the week after a hallucinated claim lands in front of your customers.",
        ],
      },
      {
        heading: "How we apply this to ourselves",
        paragraphs: [
          "Thalon is built gate-first: every draft passes an automated judge that checks grounding against operator-provided sources and screens the operator's denylist, and nothing publishes without an explicit human approval. This blog runs under the same stance — the disclosure note at the bottom of this post is not decoration, it is the policy.",
        ],
      },
    ],
  },
  {
    slug: "llms-txt-and-json-ld-for-answer-engines",
    title: "llms.txt and JSON-LD: making your site legible to answer engines",
    description:
      "Answer engines read structure, not vibes. A practical tour of llms.txt, the JSON-LD types worth shipping, and answer-first copy.",
    publishedAt: "2026-07-07T00:00:00.000Z",
    tags: ["aeo", "seo", "structured-data"],
    sections: [
      {
        paragraphs: [
          "A growing share of the people who encounter your product will never see your website — they will see a machine's summary of it. Search results answer questions inline, chat assistants cite three sources and move on, and AI crawlers decide what your pages mean before any human reads them. Answer-engine optimization (AEO) is the unglamorous work of making sure those machines summarize you accurately.",
          "The good news: unlike classic SEO folklore, most of AEO is checkable. Either your site ships the structure or it doesn't.",
        ],
      },
      {
        heading: "What is llms.txt?",
        paragraphs: [
          "llms.txt is a plain-text file served at the root of your site that gives language-model crawlers a curated summary: what the product is, what it does, and where the load-bearing pages are. Think of it as robots.txt's constructive sibling — instead of telling crawlers what to avoid, it hands them the answer you want them to carry.",
          "The one rule that matters: generate it from the same copy that renders your pages. A hand-maintained llms.txt drifts from the site within a month, and a drifted summary is worse than none — you are feeding answer engines claims your own pages no longer make.",
        ],
      },
      {
        heading: "Which JSON-LD types actually matter?",
        paragraphs: [
          "For a product site, four schema.org types do most of the work. Organization establishes who you are. FAQPage maps your objection-handling directly onto the question-shaped queries people actually type. BlogPosting gives every article a machine-readable byline, date, and description. VideoObject does the same for video, where captions and chapters are the machine-readable surface.",
          "The same drift rule applies: emit JSON-LD from the data that renders the visible page, so the structured claims and the human-readable claims cannot disagree. Answer engines compare them; a mismatch reads as deception.",
        ],
      },
      {
        heading: "What is answer-first copy?",
        paragraphs: [
          "Answer-first copy means the first sentence under every question-shaped heading must stand alone as the answer. Machines quote the first sentence; humans skim it. If your answer's first sentence is throat-clearing, the quote that represents you is throat-clearing.",
          "This is also just good writing discipline — the inverted pyramid, rediscovered because a machine now grades it.",
        ],
      },
      {
        heading: "What can't structured data do?",
        paragraphs: [
          "It cannot promise rankings, and neither can anyone else — no honest tool claims outcomes it does not control. Structured data makes your site legible; whether an answer engine features it depends on signals nobody outside those companies can see. Optimize what is checkable, disclose what is generated, and treat every rankings guarantee you read as the tell that it is.",
        ],
      },
    ],
  },
  {
    slug: "reading-trend-signals-without-a-black-box",
    title: "Reading social trend signals without a black box",
    description:
      "Engagement ratios, velocity, and outlier math — how to score what's rising with reasons you can read, not a vibes feed.",
    publishedAt: "2026-07-07T00:00:00.000Z",
    tags: ["trend-intel", "social-media", "scoring"],
    sections: [
      {
        paragraphs: [
          "Every social tool promises to tell you what's trending. Very few can tell you why — and a trend feed that cannot explain itself is not intelligence, it is astrology with engagement numbers. If you are going to act on a signal (spend an afternoon making a video, say), you deserve to know what the signal actually measured.",
        ],
      },
      {
        heading: "Which signals are worth measuring?",
        paragraphs: [
          "Ratios beat raw counts. A million views on an account that always gets a million views is a Tuesday; ten thousand views on an account that averages five hundred is a story. Share-to-view and bookmark-to-view ratios say how the audience valued the content, not just how the algorithm distributed it — shares are endorsement, bookmarks are intent to return.",
          "Velocity completes the picture: how fast engagement is accruing relative to the item's age, and relative to the account's own baseline. An outlier is not \"big\" — it is \"bigger than this source's normal, sooner\". That definition is computable, and computable means explainable.",
        ],
      },
      {
        heading: "Why do plain-language reasons matter?",
        paragraphs: [
          "A score without a reason cannot be argued with, and signals you cannot argue with get ignored. Every scored item should carry the reasons it scored — \"3× this account's median engagement in 19 hours\", \"share ratio in the top band for this topic area\" — in words, next to the number. The reasons are what let an operator decide in seconds whether the math matched their intuition or missed context the math cannot see.",
          "This is the difference between a report and a decision surface. A black-box feed asks for trust; a reasoned card earns it item by item.",
        ],
      },
      {
        heading: "Why official APIs only?",
        paragraphs: [
          "Scraped signals are brittle and borrowed. They break when a page layout changes, they violate most platforms' terms, and any workflow built on them inherits both problems. Official APIs offer less — rate limits, narrower fields, sometimes a price — but what they offer is durable, legal, and honest about its own constraints.",
          "The discipline compounds: when your inputs are legitimate, you can show your scoring math to anyone, including the platforms themselves.",
        ],
      },
      {
        heading: "From signal to draft",
        paragraphs: [
          "A trend card should be a doorway, not a readout. The test of a signal's usefulness is what happens in the thirty seconds after you believe it: the context — what's rising, why, from where — should flow directly into whatever you make next, without being retyped into another tool that immediately forgets it. Detection is only half the feature; carrying the context forward is the other half.",
        ],
      },
    ],
  },
];

/**
 * The one read the surfaces use: engine-published posts (via the seam —
 * disarmed until the lead arms it at the merge train) ahead of seed posts,
 * newest first. Era-blind cards out; ties keep authored order.
 */
export async function listPosts(): Promise<BlogPostCard[]> {
  const engine = await readEnginePosts();
  const seeds: BlogPostCard[] = SEED_POSTS.map(
    ({ slug, title, description, publishedAt, tags }) => ({ slug, title, description, publishedAt, tags }),
  );
  return [...engine, ...seeds].sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  );
}

export function getSeedPost(slug: string): SeedPost | undefined {
  return SEED_POSTS.find((post) => post.slug === slug);
}
