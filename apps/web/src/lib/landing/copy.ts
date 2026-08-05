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

export interface TodayItem {
  name: string;
  detail: string;
}

/**
 * WHAT THE ENGINE DOES TODAY. Each line was grounded against the repo at s109
 * before it was written — the surfaces under `apps/web/src/app/app/`, the
 * seams under `packages/engine/src/`, and the gate vocabulary in
 * `packages/contracts/src/judge.ts`. Nothing here is a roadmap item.
 */
export const TODAY: TodayItem[] = [
  {
    name: "Intel",
    detail:
      "You name the topic areas. Thalon watches them through official platform APIs and scores what moves with deterministic maths — relevance, engagement ratios, velocity — and every card carries the reason it surfaced.",
  },
  {
    name: "Create",
    detail:
      "One prompt fans out into platform-shaped posts, scripted video with captions, and full web pages, written from your sources in your voice rather than pasted between them.",
  },
  {
    name: "Approve",
    detail:
      "The judge gates every draft before it reaches your queue, and what arrives carries its verdicts with it. You approve, edit or reject; your corrections become the cases it is measured against.",
  },
];

/**
 * WHAT IT DOES NOT DO. The look-first sweep found no page in this category
 * that ships a section like this, which is most of the reason to ship one.
 * Every line is a real limit of the engine as it stands, and each is a limit
 * this repository can be read to confirm:
 *
 *  - unattended posting: `SOCIAL_QUEUE_ARMED` exists in
 *    `packages/platform/src/env.ts`, and the publish queue's master key is
 *    empty, so nothing goes out on its own whatever any control says.
 *  - instagram: `DESTINATIONS.instagram.driver` is literally
 *    `"instagram-text-refusal"` — connectable, but it refuses image posts.
 *  - rankings: the honest-claims rule (ADR 0006 §5). We optimise what is
 *    checkable and promise nothing about position.
 */
export const NOT_YET: string[] = [
  "Unattended posting is off. The queue is built and the key that arms it is empty, so today a human is always in the loop.",
  "Instagram connects, but its driver refuses image posts for now and says so on the card rather than failing quietly.",
  "We optimise what is checkable — titles, structure, structured data, answer-engine files. We do not promise rankings, because no honest tool can.",
  "Bring-your-own-AI-keys is planned, not shipped. Generation runs through a managed gateway today.",
];

/**
 * The honest proof band — a pre-launch product has no logos or testimonials
 * to show, so the band shows engineering facts instead, and the bar (s109) is
 * that **each one resolves to a single query or a single command.** The test
 * floor is the suite on main; the two middle figures come from the recorded
 * run this page's instrument walks the reader through, pinned in
 * `run-snapshot.ts`; zero-without-a-click is the architecture itself.
 * Honest-claims rule, ADR 0006 §5.
 */
export interface Stat {
  value: string;
  label: string;
}

export const STATS: Stat[] = [
  // 3,454 green on main at s109; stated as 3,400+ so the claim only grows truer.
  { value: "3,400+", label: "automated tests gate every change we ship" },
  // Both from the recorded run the instrument below walks through — pinned in
  // lib/landing/run-snapshot.ts and asserted in landing-run-snapshot.test.ts.
  { value: "681", label: "claims our own judge ruled on in the run below" },
  { value: "46", label: "of those claims it refused to let through" },
  { value: "0", label: "posts ever shipped without a human click" },
];

/**
 * ⚠ THE "PLATFORMS" STAT WAS REMOVED HERE, AND ON PURPOSE (s109). It read
 * "6 — platforms drafted for at launch", which is not checkable against
 * anything: `SOCIAL_PLATFORMS` carries EIGHT, shipped authoring profiles in
 * `proprietary/profiles/` cover FOUR, and publish drivers exist for SIX (one
 * of which is a typed refusal). Three defensible numbers means the claim was
 * really a vibe. The four above each resolve to one query or one command.
 */

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
