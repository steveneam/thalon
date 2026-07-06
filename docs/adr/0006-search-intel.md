# ADR 0006 — Search intel (SEO/AEO/GEO): Intel's second half + a lens on generation, not a fourth family (A13 / B6.8)

- **Status:** accepted (founder direction 2026-07-06, same planning session as A12; lead recommendation ratified same day: "charter it too")
- **Context home:** `CHARTER.md` (B6.8 + amendment A13); design home `docs/FRONTEND.md` (Intel tabs); lane plan `COORDINATION.md` (Sprint 6)
- **Supersedes:** the two-schema-window note in ADR 0005 / the A12 Sprint-6 intro — consolidated into **one opening contract window** (see Decision 6)

## Context

Founder direction: Thalon gets an SEO / AEO / GEO capability — "Thalon looks at the company, compiles a keyword list optimised for SEO/AEO/GEO, then writes the landing page" — proprietary GSC-based "peering over the horizon" first, paid SEO tools eventually, easy/simple first, and another self-dogfood. Open question posed to the lead: full new feature, or integrated into the existing ones?

Research (verified 2026-07-06): the GSC Search Analytics API is **free** with generous quotas (≈50k rows/day/site/search-type; clicks · impressions · CTR · **position** per query) behind operator OAuth on a verified property — an official API, exactly the A5/A7 invariant. The official Google Trends API exists but is **alpha/waitlist-gated** — apply, never depend. Critical timing fact: GSC has **zero data until the site is deployed, verified, and indexed** — so day-one keyword compilation must work without it.

## Decision

**Integrated, not a fourth output family** — nothing new is *produced*; search intel decomposes onto three existing spines:

1. **Demand intel = Intel's second half.** Trend intel answers "what's rising on social"; search intel answers "what are people asking search and answer engines". Same architecture: a `SearchIntelSource` driver seam (read-only pollers, official APIs only — GSC driver first; paid tools later as keyed vendor adapters, the transcript-vendor pattern; Trends-API alpha slot reserved), append-only snapshots, **deterministic opportunity math in core**. "Peering over the horizon" formalized as tested math in the `outliers.ts` mold: queries at position 8–20 with rising impressions and below-expected CTR = demand the tenant almost ranks for, flagged with reason strings before it is competitive. Workspace: the Intel surface gains **Trends · Search** tabs — one feature in the operator's head; the landing page's three-feature story is untouched.
2. **Generation-time optimization = format meta + judge lens, not new formats.** AEO/GEO are mostly deterministic, checkable properties: meta title/description lengths, question-shaped H2s with answer-first paragraphs, JSON-LD (`Organization` / `FAQPage` / `Product` / `VideoObject`), one target per page, `llms.txt`; video titles/descriptions/tags/chapters (the deterministic SRT is already a GEO asset); keyword-informed post hooks. Mechanically: the B4.2 format registry gains an SEO-meta capability; deterministic checks run in **core** (zero LLM spend); a quality lens joins the judge for the subjective residue; generation receives the tenant's active `search_targets` as context the same way exemplars flow in.
3. **Measurement flywheel.** After B6.7 deploy + verification, GSC polling arms: publish → impressions/position accrue → horizon math flags opportunities → new content targets them. Same *watch → detect → feed generation* loop as trend intel.
4. **V1 scope (easy/simple first, founder-directed):** (a) profile-seeded keyword compilation — deterministic expansion in core (topics × offers × audience × question forms) + a judged AI expansion pass grounded to the profile; (b) the on-page optimization pack above; (c) `SearchIntelSource` seam + fake driver now, GSC live at deploy; (d) paid tools recorded as swap path, not built. B6.1's landing copy gets a **manual** pass of (a)+(b) immediately — hand shell, dogfooded content.
5. **Honest-claims rule:** the landing page may claim built-in SEO/AEO optimization (real, deterministic); it never claims rankings outcomes. The judge's grounding gate enforces this like any other claim.
6. **One opening contract window.** Sprint 6's three additive schema needs (B6.1 `waitlist` · B6.4 areas · B6.8 `search_targets` + `search_snapshots`, mirroring the proven `watchlists`/`trend_snapshots` shapes, plus the format-registry SEO-meta capability) consolidate into **one lead-terminal contract window that opens the sprint** and re-freezes at merge — one writer, then lanes launch against the frozen contract (the Sprint-2/5 pattern; supersedes A12's two-window note).

## Consequences

- The dogfood loop closes on Thalon itself end-to-end: reads its own profile → compiles its own keywords → writes its own landing page against them → deploys → watches its own GSC → finds its own opportunities.
- Intel becomes the two-sided feature the operator actually needs (attention + demand) with zero new UI real estate beyond tabs.
- The GSC driver's live half is deploy-gated by design; nothing in B6.8 blocks on it (fake driver + seed compilation are keyless).
- [you]: site verification at deploy (one-time, with domain) · optional Google Trends API alpha application · paid-tool keys only if/when that swap path is taken.
