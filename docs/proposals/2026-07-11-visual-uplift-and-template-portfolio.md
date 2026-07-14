# Proposal: Sprint 7 — Visual uplift, asset engine, template portfolio, competitor-informed features

_Status: **APPROVED 2026-07-13** (session-26 checkpoint, amendment A15 / ADR 0008;
Sprint-7 bucket table in `CHARTER.md`). Decision 2 (vendor tier) deferred to
2026-07-14 — imagery work gates on it; B7.1 (asset pinning) proceeds immediately.
**2026-07-14 s29: the build-method meta-prompt is recovered and archived; review +
zero-spend execution plan filed in the §Session-29 addendum below — tier decision
follows the founder reading it.**
Decision 3: Phase-0 order confirmed — the B6.7 exit tail completed session 24, so the
charter window is formally open._
_Inputs: founder assignment 2026-07-11 · founder-provided build-method transcript (the
"one meta-prompt + asset tools + verification passes" recipe) · same-day research
teardown of Higgsfield (asset vendor) and Kompozy (competitor)._

## Why

The engine's judge/gating/publish spine is ahead of its face: the landing page, blog
surface, and workspace visuals undersell the product. A vendor MCP (Higgsfield) now
exposes 30+ image/video models to the build agent directly, which makes a one-month
asset-production sprint cheap. The same month funds a reusable, vendor-independent asset
seam and a 20–25-vertical landing-template portfolio that becomes the client-acquisition
wedge the nearest competitor (content-repurposing only, no websites) structurally lacks.

## Method (adopted from the build-method transcript, amended for this repo)

1. **Design the prompt that designs the sites** — one meta-prompt drives all template
   builds; per-vertical variation is data, not new prompts.
2. **Give the model tools, then get out of the way** — asset generation via the vendor
   MCP; inspiration references; no step-by-step art direction.
3. **Verification is non-negotiable** — every page gets ≥3 iteration passes
   (self-review for design faults → improve → re-render) plus a real-browser
   verification pass. *Repo amendment:* our judge/guard/test gates stay on top; fan-out
   parallelism only with fresh founder approval per standing rule.
4. **Pin every asset at mint time** — download to our own storage immediately with a
   provenance manifest (model, prompt, credits, license tier). Never hotlink vendor
   URLs (competitor's own changelog shows vendor URLs expiring in 30–60 min).
   **This rule is the post-subscription independence insurance: the code is always
   ours; pinned assets survive; only *new* mints need the vendor.**

## Vendor terms that gate spending (verified 2026-07-11, re-verify at signup)

- Paid tiers: full ownership + unrestricted commercial use of outputs, no visual
  watermark (C2PA provenance metadata embedded — invisible, disclosure-friendly, fine).
- **Free tier: visual watermark + vendor retains promo/training license → never in
  client-facing or landing assets.** Free tier is for MCP wiring smoke-test only.
- Third-party-reported plans (verify live): Starter ~$15/mo ≈ 200 credits · Plus
  ~$34–39/mo ≈ 1,000 credits **+ unlimited generation on select image models** · video
  runs ~6 credits (Kling-class) to 40–70 (Veo/Sora-class) per clip.

**Recommendation: one month of Plus.** The portfolio needs ~125–200 hero images
(25 sites × 5–8) plus Thalon's own set; unlimited select-model images removes credit
anxiety from the whole image workload and reserves the ~1,000 credits for video.
Starter's 200 credits would force rationing mid-build. Downgrade/cancel after the
production month; the AssetSource seam (Phase 2) makes re-subscribing a config flip.

## Phases

### Phase 0 — Openers (this week)
- **B6.7 exit tail completes first** (temp-jobDir cleanup · exit reviews across the
  three content families · full green suite) — it is small, and it is the checkpoint
  that formally opens this charter window.
- Founder: vendor account + paid tier + MCP connect (hosted URL, OAuth browser leg).
- Lead: asset-pinning module + provenance manifest (the Phase-1 ratchet, ~small PR).

### Phase 1 — Thalon's own uplift (production month, week 1)
Order: **images → pages → workspace → video-if-credits** (founder's stated priority).
1. **Landing page**: hero/section imagery + textures regenerated to the Grip II
   warm-sails brand voice; landing stays dark; 4-section structure + demo popouts kept;
   ≥3 iteration passes + browser-verify per section. Optional hero video loop (cheap
   model first).
2. **Blog surface**: per-post AI hero images — wired as a *product feature* (auto hero
   at draft time, judge-gated like all draft content), dogfooded on our own posts.
3. **Workspace**: light-first paper/navy illustration set — empty states, onboarding,
   dashboard cards. Polish, not spectacle.
4. **Video learning track**: run the vendor's video-analysis tool on 2–3 strong
   marketing videos → reproducible-prompt breakdowns → fold into our
   direction.md/storyboard conventions. Mint 1–2 short clips only if credits remain.

### Phase 2 — AssetSource seam (week 1–2, small contract window)
Generic `AssetSource` driver interface in the engine (request → pinned asset +
provenance), vendor driver #1 behind per-tenant config; commercial dependency flagged as
a launch gate with a swap path (self-hosted image gen later), per licensing-hygiene
rules. Mirrors the TrendSource driver pattern. **This seam — not the subscription — is
what the product depends on.**

### Phase 3 — Template portfolio factory (production month, weeks 2–4)
- **Pilot wave: 3 verticals** (tech · trades · food; grocer already exists as the
  gitignored client precedent) → founder review checkpoint on quality bar and factory
  economics → then the remaining ~20 in waves.
- Target verticals (~25): tech/SaaS · food/restaurant · café · grocer · plumbing ·
  electrical · HVAC/trades · transport/logistics · entertainment/events ·
  health/fitness · beauty/salon · real estate · legal · accounting · auto ·
  education/tutoring · photography · construction · landscaping · cleaning ·
  pet services · fashion/boutique · dental/medical · travel · nonprofit.
- Each: single-page landing, distinct design system, motion/physics flourish where the
  vertical suits it, vendor hero assets (paid tier only, pinned), ≥3 iteration passes +
  browser-verify, perf sanity.
- Hosting: platform previews under **neutral project names** (stealth rules — no real
  domain, no brand-linkable naming until launch call).
- Template code is generic → tracked (`proprietary/templates/`); any client
  instantiation is data → gitignored, per the multi-tenant rule.
- Parallelism note: the factory *can* fan out into lanes, but every lane launch needs
  fresh founder approval; the default plan is sequential waves by the lead.

### Phase 4 — Competitor-informed product features (charter buckets, after Phase 1)
From the competitor teardown, elaborated not copied:
- **B7.a Platform-cadence gate** — per-platform posting-frequency norms as tenant
  config, enforced beside denylist + grounding in the judge harness. Small.
- **B7.b Autopilot graduation ladder** — per-source untouched-approval-rate metric
  (we already capture overrides as eval rows); modes review-only → gated → autonomous;
  graduation UX at ≥90%. Our judge makes "gated" genuinely safe. Medium.
- **B7.c Profile/persona-brief upgrades** — banned-words taxonomy, 3–5 reference
  posts, per-platform voice overrides, edits-update-the-brief loop surfaced in the
  profile editor. Medium.
- **B7.d Programmatic SEO/AEO web** — compare/glossary/use-case page families
  *generated by our own blog-origination loop* (drafts pre-launch; publish
  domain-gated). Folds into the existing search-intel plans.
- **B7.e Routing table** — bucket→platform routing map as per-tenant config data.
  Tiny.
- Publish-connection intel recorded for the future publish bucket: 7 of 8 platforms
  direct official APIs; X via aggregator = flagged commercial gate; **founder paperwork
  (Meta app review + business verification, TikTok direct-post audit, LinkedIn
  Community Management access) has multi-week lead times — start ahead of that
  bucket.**

### Phase 5 — Outreach enablement (founder-led, parallel)
Portfolio index page (neutral hosting), pitch economics frame, and the
publish-paperwork applications above.

## Explicitly not doing
Rage-bait/controversial tone presets · scraping-based ingestion · synthetic
testimonials · any vendor asset minted on the free tier reaching a shipped surface ·
wiring the real domain (stealth holds until the launch call).

## Success criteria
Phase 1: landing/blog/workspace visibly transformed, all assets pinned + manifested,
suite green, guard clean. Phase 2: second AssetSource driver stub proves the seam.
Phase 3: 3 pilot templates pass founder review; factory cost/site known; 20+ shipped.
Phase 4: each bucket lands with eval rows + tests per repo rules.

## Founder decisions needed now
1. Approve this charter amendment (scope + sequencing).
2. Vendor tier: **Plus for one month (recommended)** vs Starter.
3. Confirm Phase-0 order (exit tail first) or direct Phase-1 start.

---

## Session-29 addendum — recovered meta-prompt: review + vendor-visual execution plan (2026-07-14)

_The founder recovered the build-method video's on-screen meta-prompt and pasted it at
session-29 open. Verbatim archive (gitignored — it carries a personal email the founder
added): `.context/design/build-method-meta-prompt-2026-07-14.md`. This addendum is the
founder-directed **zero-spend** review + plan; the tier decision follows the founder
reading it. Nothing below spends a vendor credit or a gateway dollar._

### Review: the distillation held; five things the verbatim adds

§Method points 1–4 are all verifiably present in the source (one meta-prompt · tools +
creative freedom · ≥3 iteration passes · asset workflow). The verbatim adds method
detail the transcript-derived distillation could not carry:

1. **Design-system diversity is an explicit instruction, not an emergent hope.** The
   prompt demands each site be "fundamentally different" and hands the model a
   technique menu (high-quality 3D · otherworldly animation · exceptional palettes ·
   novel type). *Amendment to §Method-1:* per-vertical variation stays data — but the
   data now includes a **per-site design-axis assignment** (a technique-menu draw), so
   distinctness is forced by the factory prompt rather than hoped for from vertical
   content alone.
2. **The iteration pass is defined — and it pushes upward, not just fault-hunts.** The
   source definition: a fine-toothed-comb pass for design problems **and** for
   "opportunities to improve/complexify." *Amendment to §Method-3:* our pass checklist
   gets two lanes — fault-hunt *and* ambition-push — encoded in a tracked checklist
   artifact so every pass runs both.
3. **The asset pipeline is reference → similar-but-different regeneration** (mine
   references, mint *original* assets in that direction, animate, use as key assets).
   *License-clean adoption:* inspiration browsing is fine; **no reference-image
   downloads into the pipeline** (scraping-based ingestion is on the not-doing list,
   and the source's suggestion to pull boards via a personal login is a ToS/license
   risk we don't take). Founder-curated moodboards can land gitignored in
   `.context/design/`; every minted asset is a vendor-generated original, pinned per
   B7.1.
4. **Audience-stakes framing lives in the prompt itself** ("seen by 500,000 people…
   show the world"). Cheap, transferable quality lever — the factory meta-prompt
   carries an equivalent stakes line.
5. **A `/guide` self-documentation route per site.** Adopted for the portfolio: each
   template ships a `/guide` page (method note + provenance summary, honest about AI
   generation). It doubles as material for the founder's own build-video plans and
   feeds the Phase-5 portfolio index.

### What we explicitly do not adopt

- **"Do not ask me for anything until all are done."** Checkpoint discipline stands:
  pilot wave of 3 → founder review on quality bar + economics → waves; every lane
  launch needs fresh founder go.
- **Third-party hosting (Netlify).** We ship through the established deploy channel
  under neutral-named previews; stealth holds.
- **"GPT Image 2, which you have keys for"** is the video author's setup, not ours.
  Our mint path is the vendor MCP (the same Seedance/Nano-Banana-class models are
  exposed there); gateway image models stay a recorded swap path, not the plan.

### Zero-spend work order (everything here runs before any tier purchase)

- **P0.1 — Factory meta-prompt v1** (`proprietary/templates/meta-prompt.md`): adapt the
  recovered prompt into ours — per-vertical data slots + design-axis draw + stakes
  line + `/guide` requirement, with our gates written in (judge/guard · B7.1 pinning ·
  ≥3 two-lane passes · browser-verify). This is §Method-1 made concrete, and the
  artifact the whole method centers on.
- **P0.2 — Iteration-pass checklist artifact** (two lanes per amendment 2), beside the
  meta-prompt; every B7.2 surface and B7.4 template cites it.
- **P0.3 — B7.2 shot-list + prompt pack**: every Thalon surface (landing hero + 4
  sections + popout textures · blog auto-hero slots · workspace paper/navy set: empty
  states, onboarding, dashboard cards) with per-slot draft prompts in the Grip II
  warm-sails voice and a credit-class tag (image-unlimited vs video-credits) — so mint
  week is execution, not design.
- **P0.4 — Contract window 2 (B7.3 front half)**: `AssetSource` request/response
  contracts + provenance manifest type aligned to B7.1's + per-tenant driver config and
  capability; freeze after review (the recorded two-window exception).
- **P0.5 — Vendor driver skeleton** against fixtures; live calls stay in the existing
  smoke posture only (free tier, watermarked, already refusal-gated off shipped
  surfaces by B7.1).

Then, tier-gated: **B7.2 mint week** (images → pages → workspace → video-if-credits,
each surface through the pass checklist + browser-verify) → **B7.4 pilot wave**
(tech · trades · food) through the factory meta-prompt → **founder checkpoint** —
factory economics read straight off the provenance manifests (they carry credits per
asset, so cost-per-site falls out for free) → remaining ~20 in waves, sequential by
default.

### Session-30 addendum — tier PAID + founder's mint-week order (2026-07-14)

The founder subscribed to **Plus** at session-30 close (MCP-verified: plan `plus`,
1,010 credits). Mint week runs in the founder's revised order, superseding the
"images → pages → workspace → video-if-credits, then 3-vertical pilot" sequence:

1. **Images** — Thalon's own imagery per the B7.2 shot-list (landing hero/sections,
   blog auto-hero slots; unlimited-select-model work, credit-cheap).
2. **Template landing pages, wave 1: FIVE verticals** (up from the 3-vertical pilot)
   through the factory meta-prompt.
3. **Workspace** — the paper/navy illustration set (empty states, onboarding,
   dashboard cards).
4. **Video** — animation/key-asset mints (the credit pool's main consumer).
5. **Template landing pages, wave 2: five more.**
6. **Re-assess remaining credits with the founder** — this checkpoint absorbs the
   original pilot-wave review (quality bar + factory economics off the provenance
   manifests) and decides where the rest of the pool goes.

P0.1–P0.3 (meta-prompt v1 · pass checklist · shot-list) still precede step 1 — they
are hours, not days, and every later step consumes them. P0.4/P0.5 (AssetSource
window + driver skeleton) ride alongside the early mints. Paid-tier terms
re-verified live at the first mint; every asset pins through B7.1 with provenance.

**Plus, one month.** The verbatim prompt confirms the workload mix the original
recommendation assumed: image minting at portfolio scale (absorbed by Plus's unlimited
select-model images) plus **animation as a first-class technique** — "animate them …
use those as key assets" — which is exactly what the ~1,000 credits reserve is for at
~6–70 credits/clip. Starter's 200 credits cannot carry an animation-forward portfolio.
Decision remains the founder's; none of P0.1–P0.5 requires it.
