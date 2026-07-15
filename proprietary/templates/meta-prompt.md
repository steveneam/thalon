# Factory meta-prompt v1 — the prompt that designs the sites

> **P0.1 of the vendor-visual block** (visual-uplift proposal §Session-29 addendum).
> Adapted from the founder-recovered build-method meta-prompt (verbatim archive,
> gitignored: `.context/design/build-method-meta-prompt-2026-07-14.md`) with this
> repo's gates written in. One meta-prompt drives every template build (§Method-1);
> per-vertical variation is **data** filled into the slots below, never a new prompt.
>
> Companion artifacts: `iteration-pass-checklist.md` (the two-lane pass this prompt
> mandates) · `../prompts/b7.2-shot-list.md` (Thalon's own surfaces, same rules).

## How to instantiate

0. **Look first (founder direction, 2026-07-14 s35 — mandatory, before any planning).**
   Browse Dribbble and Pinterest for the vertical + drawn axes in the live browser
   (look-and-learn ONLY — downloading reference imagery into the pipeline stays
   forbidden). Study several strong examples; compare and contrast what makes them
   work (composition, texture, materials, type pairings, restraint); **integrate and
   elaborate** — write 3–5 taste notes into the session log/wave plan that name what
   this site will steal the *principle* of (never the pixels). Only then plan slots,
   copy, and mints. Taste is seen, not remembered: skipping this step produced
   flat-fill sections that read cheap until founder review caught them.
1. Fill every `{{slot}}` from the wave's vertical data. Instantiation values for a
   *real client* are tenant data (gitignored `.context/`); the demo verticals in the
   wave plan use neutral fictional business names.
2. Draw the design axes (see menu below) **before** the build starts and record the
   draw in the wave plan. No two sites in a wave share a primary axis.
3. Hand the instantiated prompt to the build agent as the task brief. The gates in
   §Non-negotiable gates are part of the prompt, not commentary.

---

## The prompt

You are building **one single-page landing site** for the vertical
**{{vertical}}**, for a fictional demonstration business named
**{{business_name}}** ({{one_line_value_prop}}). It is one site of a portfolio of
~25, each fundamentally different from every other; this one must be
unmistakably itself.

This site will be seen by many, many prospective clients as proof of what this
factory produces — treat it as a portfolio centerpiece. Go ambitious and show
what you are capable of, within the gates below.

**Design axes (assigned, not chosen at build time):**
- Primary axis: **{{primary_axis}}** — the site's signature technique; commit to
  it deeply rather than sprinkling it.
- Secondary axis: **{{secondary_axis}}** — supporting flavour only.
- Palette seed: {{palette_seed}} · Type direction: {{type_direction}} ·
  Motion budget: {{motion_budget}}.

You have total creative freedom inside the assigned axes — structure, layout,
composition, copy tone (honest claims only), and how far to push each technique
are yours to decide. Design in the way you believe best illustrates the
vertical's story. Distinctness is a requirement: if this page could be mistaken
for another site in the portfolio wearing different colors, it fails.

**Assets:** mint original imagery/animation via the vendor MCP (Higgsfield) in
the direction the design needs. The full hosted model roster is available and
model choice is per-slot (founder direction, from the source prompt — restored
2026-07-14): e.g. soul-class or seedance 2.0 for cinematic stills, nano banana
pro/2 for graphics/text/diagram-precise images, GPT-image class for graphic
design, kling 3.0 / seedance for video — use `models_explore` recommend per
slot; video-class mints spend real credits and stay deliberate draws. Browsing published sites for *inspiration* is
fine; **downloading reference images into the pipeline is forbidden** — every
asset on the page is a vendor-minted original, minted on the **paid tier only**,
and pinned at mint time via the B7.1 pinning module with a full provenance
manifest (model, prompt, credits, license tier). No surface ever holds a vendor
URL.

**Required structure:**
- A single responsive landing page for {{vertical}}: hero + the sections the
  vertical's story needs ({{section_hints}}). Default build shape is one
  self-contained `index.html` (inline style/script) per the scaffolding
  contract (`README.md`) — split files only when the site earns it.
- A **`/guide` route**: a brief, honest method note — how the page was designed
  and built, which models minted which assets (from the provenance manifests),
  and that imagery is AI-generated. No client data, no internal codenames.
- Perf floors (not a style ceiling): images sized and lazy-loaded, no layout
  shift, no jank, reduced-motion alternatives for every animation. Purposeful
  animation JS is welcome — "static-first" bounds decoration cost, never
  ambition.

**Be exploratory (founder direction, restored from the source prompt
2026-07-14):** take real aesthetic risks. Scroll-driven scenes and
transitions, choreographed entrances, cursor-reactive moments, and living
backgrounds are encouraged wherever they serve the drawn axes — a safe page
is a failed page in this portfolio. The perf floors and reduced-motion
alternatives above are the only brakes.

**Hero register rule (founder direction 2026-07-15 s37):** the first
impression must be *real*. A code-drawn model, schematic, or illustration
cannot carry the hero on a premium/boutique vertical — it reads cartoon, not
bespoke; lead with photography-grade minted imagery and let the crafted/model
register live in an inner scene where being a drawing or model IS the story.
Corollary for place-based verticals (real estate, hospitality, food): nature
is load-bearing — greenery, trees, and setting sell the story; a bare subject
on a bare background fails the register even when technically clean.

**Before you call the site done:**
- Run **at least three iteration passes**, each executing BOTH lanes of
  `proprietary/templates/iteration-pass-checklist.md` — the fault-hunt lane and
  the ambition-push lane. A pass that only fixes faults does not count.
- Browser-verify the final page. (On boxes without headless-chrome system
  libs — syd4 — verification runs against the staging preview or on the
  founder's machine; SSR-HTML checks are the local fallback, not a substitute
  for the final visual pass.)

## Non-negotiable gates (repo invariants — never relaxed by creativity)

1. **Checkpoint discipline.** Sites ship in waves with a founder review between
   waves. The source prompt's "do not ask me for anything until all are done"
   is explicitly NOT adopted; every lane/agent launch needs fresh founder
   approval.
2. **Asset pinning (B7.1).** Every mint → `pinAsset` immediately: bytes into
   content-addressed storage + provenance manifest. Free-tier mints refuse to
   pin (watermark + vendor promo/training license) except explicit smoke tests.
3. **Licensing hygiene.** No AGPL embedded; MIT/Apache/CC0/public-domain on the
   hot path; no scraped or downloaded third-party imagery, ever.
4. **Stealth.** Hosting under neutral project names through the established
   deploy channel — no real domain, no brand-linkable naming, no third-party
   hosts (the source prompt's Netlify step is not adopted).
5. **Honest marketing only.** No fake urgency, synthetic scarcity, invented
   testimonials, or unverifiable claims — the demo business is fictional and
   the `/guide` page says so.
6. **Guard cleanliness.** Nothing tracked may reference the forbidden upstream
   brand tokens; run `scripts/ci-grep-guard.ps1` before every commit.

## Design-axis menu (the draw pool)

| Axis | Signature moves |
| --- | --- |
| High-quality 3D | Real depth: WebGL/CSS-3D scene, product-as-object, parallax stage |
| Otherworldly animation | Choreographed entrances, scroll-driven scenes, living backgrounds |
| Exceptional palette | An unforgettable, non-default color world; duotone/gradient mastery |
| Novel typography | Display type as the hero; variable-font play; editorial scale jumps |
| Physics & interaction | Springs, drag, collision, cursor-reactive elements (grocer precedent) |
| Editorial / print | Grid-broken magazine layout, rules-and-columns, long-form confidence |
| Brutalist / raw | Exposed structure, harsh contrast, anti-polish discipline done well |
| Cinematic imagery | Minted key-asset photography/film stills carry the page; text recedes |
| Data / instrument | Dashboards-as-decor, live-feeling numbers, HUD restraint |
| Soft / organic | Hand-drawn warmth, irregular shapes, paper textures, human pacing |

Draw rule: primary axis unique within the wave; secondary axis free; a
vertical whose story fights its drawn axis may swap **once**, recorded in the
wave plan with a one-line reason.

---

*v1, 2026-07-14 (session 31). Owner: lead. Revisions ride wave checkpoints —
lessons from each wave amend this file in the same change (ratchet rule 8;
tag: opinion, except §Non-negotiable gates which are invariant).*
