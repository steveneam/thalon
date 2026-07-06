# Manual keyword pass — Thalon landing copy (B6.1, the hand-run B6.8 recipe)

> The B6.8 seed compiler's deterministic expansion (ADR 0006 decision 4a:
> **topics × offers × audience × question forms**), executed BY HAND against
> tenant #0's profile for the landing copy — hand shell, dogfooded content.
> When the compiler lands (search-engine lane), this pass is its first
> ground-truth fixture: same inputs, comparable output. **Honest-claims rule
> binds every placement (ADR 0006 §5): optimization is claimable; rankings,
> outcomes, and invented numbers are not.**

## 1. Profile inputs (tenant #0, self)

- **Topics:** AI content creation · social media automation · trend
  intelligence · content marketing · SEO/AEO/GEO
- **Offers:** one prompt → posts/videos/pages · grounded-to-sources drafts ·
  judge + approve gate · cross-platform drafting · built-in on-page
  optimization
- **Audience:** founders · solo operators · small marketing teams
- **Question forms:** will/where/how/can/whose/is/what objections an
  operator actually raises before trusting an AI to speak as them.

## 2. Expansion → chosen targets

| # | Keyword target | Form | Landed |
|---|---|---|---|
| 1 | AI content engine | head (topic×offer) | hero eyebrow, `<title>`, meta description, OG title, Organization JSON-LD description |
| 2 | turn one prompt into posts, videos, and pages | long-tail promise | H1 (exact), meta description first sentence, llms.txt blockquote |
| 3 | human approval / nothing ships without your approval | differentiator | eyebrow, hero subline, trust block, FAQ 1, llms.txt |
| 4 | AI content grounded in your sources | trust long-tail | hero subline, Create card, trust chips, FAQ 1 |
| 5 | spot rising trends before they peak | intel long-tail | Intel card tagline, FAQ 3 |
| 6 | cross-platform content publishing | offer | Everywhere card, FAQ 2 (platform list spelled out) |
| 7 | content approval workflow / approve queue | audience vocabulary | how-it-works step 03, trust block |
| 8 | AI SEO optimization (JSON-LD, llms.txt, answer engines) | topic×offer | FAQ 4, llms.txt "What it does", §2 answer-first paragraph |

## 3. Question forms → FAQ (the AEO surface)

Each is a real objection phrased the way an operator would type it into a
search or answer engine; every answer is answer-first (verdict in the first
sentence) and ships identically to the visible accordion, the `FAQPage`
JSON-LD, and llms.txt — one copy module (`apps/web/src/lib/landing/copy.ts`),
zero drift by construction.

1. Will Thalon post junk under my name? → the approve gate (target 3)
2. Where does Thalon publish? → platform list + roadmap honesty (target 6)
3. How does Thalon find rising trends? → deterministic intel, reasons attached (target 5)
4. Can Thalon improve my SEO? → optimization claimable, **rankings explicitly disclaimed** (target 8)
5. Whose AI keys does Thalon use? → gateway default, BYOK planned
6. Is AI-generated content disclosed? → provenance kept, operator controls disclosure
7. What data does Thalon keep? → scoped to workspace, never trains shared models

## 4. On-page pack applied (the deterministic checklist, hand-run)

- `<title>` 49 chars · meta description 153 chars (within the 60/155 SERP
  budgets the core checks will pin)
- One target per page: the landing targets #1/#2; deeper targets wait for
  their own pages (no keyword stuffing)
- Question-shaped H2s with answer-first paragraphs: "What does Thalon do?" ·
  "How does it work?" · "Why trust it with your name?" · "What does it cost?"
- `FAQPage` + `Organization` JSON-LD generated from the copy module;
  `llms.txt` served at the root; semantic landmarks (header/nav/main/
  section/footer, single H1)
- Honest-claims audit: no ranking promises, no invented prices or discounts,
  publishing roadmap stated as roadmap. Pinned executable in
  `landing-page.test.tsx` + `llms.txt/route.test.ts`.

## 5. Provenance for the seed compiler (B6.8)

When `search_targets` compilation goes live for tenant #0, rows 1–8 above
should be derivable as `origin: "profile_seed"` (meta: which profile fields
seeded them); anything the compiler can't re-derive gets added as
`origin: "operator"` with this file as the reference.
