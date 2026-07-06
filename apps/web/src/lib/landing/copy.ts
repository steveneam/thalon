/**
 * B6.1 landing copy — ONE source of truth: the sections render from this,
 * the FAQPage JSON-LD is generated from `FAQ` verbatim (docs/FRONTEND.md §4),
 * and llms.txt quotes the same lines. Written against the manual B6.8
 * keyword pass (proprietary/prompts/keyword-manual-pass.md). Honest-claims
 * rule binds every string here (ADR 0006 §5): optimization and gating are
 * claimable — rankings, outcomes, and invented numbers are not.
 */

export interface FaqItem {
  question: string;
  /** Answer-first plain text — first sentence must stand alone (AEO). */
  answer: string;
}

export const FAQ: FaqItem[] = [
  {
    question: "Will Thalon post junk under my name?",
    answer:
      "No — nothing publishes without your explicit approval. Every draft passes an automated judge that checks each claim against the sources you provided and screens your denylist; anything that fails is blocked before it reaches your queue. You approve, edit, or reject — Thalon only ships what you click.",
  },
  {
    question: "Where does Thalon publish?",
    answer:
      "Thalon drafts platform-shaped content for LinkedIn, X, Instagram, Facebook, TikTok, and YouTube, plus full web pages. Today you approve and post; one-click publishing through official platform APIs is planned for early-access members — official APIs only, no gray-area automation.",
  },
  {
    question: "How does Thalon find rising trends?",
    answer:
      "You describe the topic areas you care about, and Thalon watches them through official platform APIs. Every item is scored with deterministic math — relevance to your area, engagement ratios, and velocity — and each trend card carries a plain-language reason why it's rising. No black-box feed.",
  },
  {
    question: "Can Thalon improve my SEO?",
    answer:
      "Thalon builds search optimization into every page it writes: meta titles and descriptions, question-shaped headings with answer-first paragraphs, structured data (JSON-LD), and llms.txt for AI answer engines. We optimize what's checkable — we don't promise rankings; no honest tool can.",
  },
  {
    question: "Whose AI keys does Thalon use?",
    answer:
      "Thalon runs on a managed AI gateway by default, so there's nothing to configure. Bring-your-own-key support is planned for teams that want generation routed through their own provider accounts and budgets.",
  },
  {
    question: "Is AI-generated content disclosed?",
    answer:
      "You control disclosure, and Thalon makes it possible: every draft keeps its provenance — the prompt, sources, and model that produced it — so you can label AI-assisted content wherever platform rules or regulations such as the EU AI Act require it.",
  },
  {
    question: "What data does Thalon keep?",
    answer:
      "Your brand profile, the sources you provide, your drafts, and the edits you make (your edits tune your own results). Everything is scoped to your workspace, your sources are never used to train shared models, and you can export or delete your data on request.",
  },
];

export interface Feature {
  key: "intel" | "create" | "everywhere";
  name: string;
  tagline: string;
  description: string;
}

export const FEATURES: Feature[] = [
  {
    key: "intel",
    name: "Intel",
    tagline: "Spot what's rising before it peaks",
    description:
      "Describe the topic areas you care about. Thalon watches them across platforms and search, flags outliers with plain-language “why it's rising” reasons, and turns any trend card into a draft in one click.",
  },
  {
    key: "create",
    name: "Create",
    tagline: "One prompt, every format",
    description:
      "Give Thalon a prompt and your profile. It drafts platform-shaped posts, scripted videos with captions, and full landing pages — grounded in your sources, in your voice.",
  },
  {
    key: "everywhere",
    name: "Everywhere",
    tagline: "Approve once, ship it all",
    description:
      "Every draft is judged against your sources and denylist before it reaches your queue. You approve, edit, or reject — then take it to every platform you publish on.",
  },
];

export const STEPS = [
  {
    name: "Profile",
    detail: "Describe your brand once — voice, platforms, topics, sources, denylist.",
  },
  {
    name: "Generate",
    detail: "One prompt fans out into posts, video scripts, and pages, grounded in your sources.",
  },
  {
    name: "Approve",
    detail: "The judge blocks anything ungrounded; you click approve on what ships.",
  },
] as const;

export interface Tier {
  name: string;
  audience: string;
  /** Planned monthly price, USD. */
  price: number;
  bullets: string[];
  featured?: boolean;
}

/**
 * Planned launch pricing — lead-recommended, founder-delegated 2026-07-07
 * ("have a think about it and put in your recommended price"). Anchors:
 * scheduling tools run ~$6–99/seat, AI writing ~$39–59, AI video alone
 * ~$24–90 — Falcon bundles intel + video + the judge gate under the
 * mid-market video tools it replaces. Aerie prices per-workspace value
 * (~$20/brand at ten brands) with BYOK trimming our gateway exposure.
 * Still no invented anchors: no fake was-prices, ever (test-pinned).
 */
export const TIERS: Tier[] = [
  {
    name: "Scout",
    audience: "For solo operators",
    price: 29,
    bullets: ["One brand profile", "Trend intel on your core areas", "Posts + landing pages"],
  },
  {
    name: "Falcon",
    audience: "For serious creators",
    price: 79,
    bullets: [
      "Everything in Scout",
      "Video generation with captions",
      "Full intel: trends + search",
    ],
    featured: true,
  },
  {
    name: "Aerie",
    audience: "For teams & agencies",
    price: 199,
    bullets: ["Multiple workspaces", "Shared approval queues", "Bring your own AI keys"],
  },
];
