# Proposal: Sprint 7 — Visual uplift, asset engine, template portfolio, competitor-informed features

_Status: **APPROVED 2026-07-13** (session-26 checkpoint, amendment A15 / ADR 0008;
Sprint-7 bucket table in `CHARTER.md`). Decision 2 (vendor tier) deferred to
2026-07-14 — imagery work gates on it; B7.1 (asset pinning) proceeds immediately.
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
