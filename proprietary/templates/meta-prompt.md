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
slot; video-class mints spend real credits and stay deliberate draws.
**Hero slots mint on the BEST image model on the roster** (founder directive
s51 — "best image model, whichever that may be"; check per mint), and **any
slot where legible words appear in-scene routes to the text-precise seat**:
soul-class cannot be negative-prompted out of garbled lettering (s51, proven
across three takes on the ⑥ marquee; nano banana rendered the exact word
first take). Soul-class also invents text UNPROMPTED: any prominent printable
surface (file spines, labels, posters, wall frames, instrument handles,
MACHINE BODIES — ⑬ put lettering on a drum roaster in 3/3 takes) grows
garbled pseudo-lettering even when the prompt forbids all text (s52, ⑦'s
desk plate) — compose printable surfaces out of frame or blank-wrapped
rather than negative-prompting, or route the slot to the text-precise seat.
Corollary (⑬, s60): "vintage/heritage" MACHINERY reads as painted brand
livery — asking it to be plain makes the livery ornate; modernize the object
instead ("seamless matte housing, one continuous surface") and describe the
finish positively. Corollary (⑭, s61): WORN FABRIC is a printable surface —
work shirts grow lettered chest badges, brooches, and athletic sleeve
stripes across takes even when every "no logos" negative is stacked (three
⑭ rejects in a row); woven/collared workwear attracts invented branding,
plain KNIT garments resist it — cast the subject in a matte knit ("plain
waffle-knit jumper, one continuous surface") instead of negative-prompting
the shirt. A near-clean take with one small garbled patch may take a
disclosed local blur pre-pin instead of another take — the /guide must say so. Non-hero, non-text slots stay the
builder's call. Browsing published sites for *inspiration* is
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

**The representation ladder (founder directive, s55 wave-2 checkpoint —
his "most important point"):** for every load-bearing sentence or paragraph,
ask: can this be *shown* instead — a minted image, a code-drawn instrument,
an animation (imagination, real, or abstract)? If yes, show it. Representing
information visually is not reducing it; it is the same information in a more
visual, more artistic form. The bar: the visual must carry the same
information load the words did (the ⑩ hair try-on replaced both a swatch
circle AND a paragraph of imagination with direct evidence) — decorative
substitution that drops the information is the stock-photo failure this rule
exists to beat. Prefer code-drawn instruments when the information is
data-shaped (0cr, and it can respond to the visitor); mint when it is
world-shaped; the perf floors, reduced-motion alternatives, and honesty gates
apply unchanged.

**Casting & social register (founder-taught, s55):** imagery is read
socially before it is read aesthetically. (1) Cast for the audience's trust —
who appears in the frame shapes perceived safety and warmth (a woman walking
the dogs reads calm and safe for pet care; two friends laughing reads joy
where a posed model reads advertisement). (2) Landing heroes never stare
into the camera — the Mona Lisa effect confronts the visitor; candid,
absorbed subjects invite them. (3) Check every image's countable claims
against the copy's promises before keeping it (a five-dog photo under a
"four per walker, never more" pledge is an honesty fail the build pass must
catch, not the founder). (4) Playful marginalia in the vertical's own visual
language earns warmth cheaply (paw prints, formula annotations, stamped
marks). (5) Count-anchoring: models overshoot subject counts even against
"EXACTLY N, count them" — when a count is capped by copy, prompt for *fewer*
than the cap so the overshoot lands inside it. (6) Leave room for one small
deliberate imperfection or wink per page — the Houselights one-letter neon
flicker (founder-suggested) is the register: a single playful flaw that makes
a page feel alive and hand-made rather than rendered. Budget for it; don't
polish it out. (7) **Lead archetypes are cast per vertical (founder
direction, s59):** professional/serious verticals (dental, legal, finance,
trades like electrical or roofing) lead MALE — older, with visible
experience, where wisdom itself is the trust signal (the ⑫ silver-bearded
dentist correction is the model case); warmth/human-touch verticals (pet
care, childcare) lead FEMALE; hospitality/cafés lead female or a warm
handsome young male. Cast whoever the customer hopes to see at the door.
(8) **Counter the vertical's dread-association with nature and light
(founder direction, s59):** where a vertical's mental image is confinement
(dental chairs, clinics, waiting rooms), the page carries bright, sunny,
outdoor imagery — fields, gardens, greenery, open sky — as bands,
backgrounds, or sides. The ⑫ garden + walk-out pair is the model: the
brightest images on the page answer the vertical's fear, not its function.

**Show the consumable result (founder direction, s60 ⑬ fix round):** for any
vertical whose product is tasted, worn, felt, or lived in, the page must show
what the CUSTOMER receives — not only the craft that makes it. The ⑬ model:
coffee cards opened with the brewed cup (filter's amber-ruby translucency,
the milk pour's texture, cold brew over ice) so a visitor can imagine colour,
texture, and smell; beans alone sell to roasters, cups sell to drinkers.
Sensory-outcome imagery sits beside the spec, per item where items differ.

**Every expert instrument gets a lay twin (founder direction, s60 ⑬ fix
round — "for the general public, very few would appreciate it"):** when the
signature element is a data-instrument (curve, chart, log), pair it with a
physical, sensory representation of the SAME information on the SAME
clock/scroll — the ⑬ model: roast curve left, the bean itself right, five
minted states crossfading in sync with the graph's stages. The instrument
earns the expert's trust; the twin carries everyone else. One clock, two
readings; the twin is never decoration — it must track the instrument's
state exactly (reduced-motion/no-JS get the complete twin too).

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
