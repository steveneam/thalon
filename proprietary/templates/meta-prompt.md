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
   forbidden). **Also sweep motionsites.ai (founder addition, s63)** — the live
   animated-hero gallery is the strongest MOTION-register reference of the three
   (stills sites can't show choreography); weight it up for cinematic/animation/
   palette-drenched draws, and read it double-edged: it also maps the current
   AI-landing *default* (dark animated-background hero) that a distinct site must
   refuse. Its copyable prompt products are its merchandise — never copy or adapt them;
   principle-not-pixels applies doubly there. Study several strong examples;
   compare and contrast what makes them work (composition, texture, materials,
   type pairings, restraint, motion grammar); **integrate and elaborate** — write
   3–5 taste notes into the session log/wave plan that name what this site will
   steal the *principle* of (never the pixels). Only then plan slots, copy, and
   mints. Taste is seen, not remembered: skipping this step produced flat-fill
   sections that read cheap until founder review caught them.
1. Fill every `{{slot}}` from the wave's vertical data. Instantiation values for a
   *real client* are tenant data (gitignored `.context/`); the demo verticals in the
   wave plan use neutral fictional business names.
2. Draw the design axes (see menu below) **before** the build starts and record the
   draw in the wave plan. No two sites in a wave share a primary axis.
3. **Pre-plan the design BEFORE building — the discipline that matters
   (founder A/B verdict, s61).** The loop question was tested head-to-head:
   ⑮ ran the full claude-design loop (scaffold → alive final → landing) vs
   ⑬/⑭ code-direct; the founder's read on the record — the quality came from
   **pre-plan direction** (look-first sweep · a written concept with the
   scroll mechanism decided · per-slot mint briefs · decision annotations),
   not from the mock tool: "maybe our engine is sufficient for now rather
   than claude design." Standing: the MANDATORY stage is the pre-plan
   (concept + mechanisms + slots written down before any code or mints);
   claude-design is an OPTIONAL tool when a founder-reviewable mock is
   wanted before build. (History: the claude-design stage was the s51 loop,
   drifted out s53–54, was restored s61, and retired-to-optional the same
   day by this A/B.)
   **AMENDED s104 (founder, s103 close): for LANDING-PAGE work the
   claude-design initial mock is RESTORED and runs in FRONT of the pre-plan**
   — *"i think using claude design for the initial mock actually did help the
   landing page have a bit more clarity and structure."* This is not a
   reversal of the A/B: the mandatory pre-plan stays exactly as it is and the
   mock is added ahead of it. **Both, never either.** Whitethorn (⑳) is the
   first site under the amended loop, and the mock earned its keep with a
   structural finding the prose plan had missed — it showed the pinned
   instrument scrolling away and leaving six chapters with nothing to drive,
   which made "the instrument PINS and the chapters drive it" the build's
   spine.
4. Hand the instantiated prompt to the build agent as the task brief. The gates in
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
the shirt. Corollary (Hartline re-pass, s62): FLAT METAL BLANKS are
printable surfaces — modern key heads came back stamped with pseudo-brand
text even under "no lettering" (and the wave-1 leather fob embossed
itself); the compose-out is an object with no flat face at all (antique
skeleton keys, turned-away heads, the fob hidden under the keys).
Corollary (⑳ Whitethorn, s104): **LANYARDS AND BADGES grow on anyone the
scene reads as a professional** — two takes of a vet returned a lanyard, the
second carrying a garbled pseudo-text badge, against a prompt that said "no
lanyard" in those words. Negative-prompting a printable surface does not
remove it; the fix that worked first time was **cropping the chest out of
frame** (a tight head-and-hands crop at the collarbone). Compose out, never
negate — the rule generalises: name the FRAME you want, not the object you
don't.
Corollary (⑳, s104 — extends the s63 window-glazing rule beyond windows):
**a prompted "gate" renders as a MULLIONED LATTICE and reads as BARS.** Two
takes of an open garden gate came back as a grid filling the frame, on the
one image whose whole job was to dispel the vertical's confinement dread.
Any barrier object — gate, railing, fence, screen, grille — carries the cage
risk, not just glazing. The compose-out is an opening with no leaf across it:
**an archway with the door swung flat against the wall**, a gap in a hedge, a
bare stone opening. Third take, first attempt at the new framing, keeper.
Corollary (㉑ Aspect & Fall, s105 — **the edit seat holds MATERIALS but not
VIEWPOINT**): a four-season sequence of one place was built by minting the
summer frame and editing it into the other three on a transformations/editing
seat. *"Keep the camera position, the framing … identical to the reference"*
kept the paving, walls, bench and trees — and still recomposed the shot into a
different view, which would have quietly made the caption "the same corner" a
lie. What worked first time was **naming the composition as a list of elements
and their positions in frame** ("a drystone pier at the left edge and another
at the right, the rendered wall running horizontally across the middle, the
bench against it on the left, paving filling the lower third"). Describe the
FRAME as a layout, not as a reference to obey.
Corollary (Marl & Cane, s112 — **A COLOUR WORD MAY NAME A VARIETY RATHER THAN A
STAGE, and getting that wrong breaks the whole sequence, not one frame**): two
anchor takes asking for "hard, unripe, pale yellow-green celadon" berries
returned **ripe WHITE wine grapes** — translucent and golden — because the model
resolved "green grape" to the colour of a white variety at maturity, not to the
colour of unripe fruit. The trap is that a white variety **has no veraison to
purple at all**, so chaining a blue-black end frame off it would have asserted
something the plant cannot do. **Pin the attribute that DETERMINES the colour**
(name a red variety: "unripe Cabernet Sauvignon … weeks before it colours") and
describe the stage by *hardness and opacity* rather than by the colour word
("opaque and dull blue-green like an unripe olive, matte chalky bloom, no
translucency"). Keeper on the first attempt after the correction, for 0.24cr,
because §the-anchor rule below caught it before anything derived from it.
Corollary (㉑, s105 — **generated botany lies, and the page's own data catches
it**): a "mid-May" edit came back with the hydrangea in full flower, which is
botanically wrong and contradicted the interest calendar printed directly below
it. Any generated image asserting a season, a count, a species or a time must
be checked against what the page's own instrument says — §casting (3) extended
from copy to DATA. It was cheaper to re-mint than to soften the calendar.
Corollary (㉑, s106 — **a CROSS-FADE HIDES misregistration; a SCRUB exposes it,
and a ratchet applied to three assets out of four is not applied**): the October
keyframe shipped in ㉑ was a *different camera* — lower, further back, hard
backlight — measured **24px+ out of register** against the other three while the
page captioned all four "the same corner". A dissolve between differently-framed
shots reads as a dissolve, so nothing looked wrong for a whole session. The
cause was in the prompt and was already on the books: February and May had been
minted with the layout-naming fix above, and **October still carried the exact
phrasing the fix replaced** — *"keep the camera position, the framing …
identical to the reference"*. Three rules come out of it. (1) **MEASURE
registration, never eyeball it** — a greyscale mean-abs-difference search over a
±24px window takes a minute and returns a number; two of the four pairs looked
identical and were not. (2) **Mint TWO candidates for any registered edit**: on
the re-mint, candidate A landed within **1px** and candidate B drifted the same
24px+ on the same prompt and a different seed, so the technique is roughly a
coin flip per seed and picking by measurement is the whole job. (3) When you
write a mint corollary, **re-mint every asset in the batch that was made the old
way**, or the batch quietly keeps the defect the corollary exists to stop.
Corollary (㉑, s106 — **a generated transition is pulled by its END frame**):
two attempts at a Jul→Oct segment recomposed the shot at *frame 0* and added
lens flare, even when handed the previous segment's exact last frame as
`start_image`. Both were interpolating honestly toward a misregistered
`end_image`. **Do not chase a bad segment with prompt language — fix the
keyframe it is aiming at.** Once October was re-minted in register, the segment
had nothing to drift toward. Corollary to the corollary: chain segments
**end-frame to start-frame** (upload the previous clip's last frame as the next
one's `start_image`) so seams are exact by construction rather than by luck.
Corollary (Small Hours, s107 — **the cheapest registered edit is the one you
never make**): ㉑ built a four-state sequence as four separately-minted
keyframes and spent a session on the seam between them. This site needed three
states and minted **two** — the endpoints — then let one continuous
`start_image`→`end_image` take supply everything between. The middle state is a
frame partway through that take, so it cannot be out of register *by
construction*, and the whole measure-and-re-mint loop applies to one pair
instead of three. **Chain segments only where the intermediate state is a
genuinely different SUBJECT** (site E's beans→grounds→pour, where the grounds
are their own shot); where it is one subject in the middle of one motion, a
single take is both cheaper and strictly safer. Read the budget line before
assuming otherwise — this spec's *"2 takes × 36"* meant two attempts at ONE
segment, and reading it as two segments would have bought a seam nobody wanted.
Corollary (Small Hours, s107 — **count the countable BEFORE the batch inherits
it**): the anchor keyframe came back with eight petals where *Jasminum
grandiflorum* has five, on a page that names the species. §casting (5)
count-anchoring fixed it first try ("EXACTLY FIVE … not six, not eight"), but
the point is *when*: the anchor was about to become the generation input for
every other frame, so one 3cr re-mint replaced what would have been a re-mint of
the entire sequence. **Check the botany, the count and the species on the
ANCHOR, before anything is derived from it** — the ㉑ hydrangea lesson moved one
step earlier in the pipeline, where it is an order of magnitude cheaper.
Corollary (⑳ Whitethorn, s108 — **CYCLIC motion has no end frame to mint, so
do not mint one**): the s107 rule above ("mint the endpoints, let one take
supply the middle") assumes a one-way transformation — Feb→Oct, bud→open — where
the end state is genuinely a different picture. A **gait, a pour, a spin, a
flame** are not transformations, they are *cycles*: the last frame of a sound
trot looks like the first. The arc spec had scheduled this site as
`start_image` + "the same dog mid-stride" as `end_image`, which would have
bought a near-duplicate of the start frame AND paid s106's registration
coin-flip (~50% of seeds drift) for the privilege. **A single `start_image`
with no `end_image` is the correct instrument for cyclic motion** — zero
registration risk by construction, one already-approved asset, one take.
Landed first take at 17.50cr against a ~72cr budget line. **Ask which kind of
motion it is BEFORE reaching for two keyframes.**
Corollary (⑳, s108 — **a count proves a scrub is ALIVE; it does not prove it is
AIMED**): s107's ratchet ("exactly one lit frame") passed perfectly on this
build, and a visibility-bucketed sweep then showed the scrub was spending its
resolution off-screen — mapping the sequence across the band's full centre
travel put frames 0 and 60 at the clamps, so **34 of 61 frames, over half the
shipped bytes, were only reachable while the band was under half in view**;
in the prime window the reader saw frames 17–43 and nothing else. Ending the
sweep a sixth of a viewport early at each end moved that to 10–50. **Measure
WHICH frames are reachable while the element is actually visible, not just that
one frame is lit** — the invariant check and the aim check are different
questions, and only the first has a ratchet.
Corollary (⑳, s108 — **frame density is set by the CAMERA, not by precedent**):
㉑ ships 18 frames per sequence and ㉒ ships 36, so 36 looked like the house
number. Both are **locked-off** shots where only the subject changes; this one
**tracks**, so every pixel moves every frame and adjacent-frame difference
measured **9.24 at the native 24fps against the shipped bloom's 1.26** — seven
times the change per step before any decimation. Decimating it to ㉒'s 36 would
have been visibly steppy. **Measure adjacent-frame difference against a shipped
sequence that reads well before choosing a frame count**; a panning take needs
roughly 3× the frames of a locked-off one. (Also: the vendor may answer a
literal `generate_video` with a **preset recommendation and NO job** — the call
returns a suggestion, nothing renders, and nothing is charged. Re-send with
`declined_preset_id` and confirm a job id came back before waiting on it.)
Corollary (Thalon's own landing, s109 — **the frame-density rule is about the
FRAME, not the CAMERA**): the s108 corollary above reads "a panning take needs
roughly 3× the frames of a locked-off one", and it was applied here to a
**locked-off** take of water over a stone sill — which then needed **81
frames** where ㉒'s locked-off bloom ships 36. Turbulent water changes every
pixel of the lower half of the frame every frame with the camera nailed down,
so "locked-off" predicted nothing. Measured adjacent-frame difference against
㉒'s shipped bloom (1.26, the benchmark that reads well): 41 frames → 1.88,
61 → 1.56, **81 → 1.24**, 121 (native) → 0.93. **Restated: density is set by
how much of the frame is MOVING** — a locked-off shot of a turbulent subject
needs tracking-take density, and the only way to know is the measurement, which
takes a minute. **Refinement (Morningside, s111): measure the PEAK adjacent
difference, not only the mean.** A take whose subject transforms in one short
burst inside an otherwise calm shot passes easily on the mean while being
under-sampled exactly where the reader is looking — Morningside's grind occupies
about six of segment one's forty-one frames, so the mean says almost nothing
about it. Checked on the peak against ㉒'s shipped bloom (mean 1.19, **peak
2.09**), both segments cleared it (S1 peak 0.95, S2 peak 1.88), so 41 held — but
the mean alone could not have told you that. Report mean, peak and p90.
**And a frame count is not a frame RATE: separately from density, check how much
SCROLL each frame gets.** This build shipped correct density and still stuttered,
because the chapters were only long enough to give the grind 17px per frame —
a ~100px wheel notch skipping five or six frames of the beat the page exists
for. Make each chapter's trailing space proportional to how many frames it
drives (~40–55px per frame reads smoothly on a wheel; a touch device tolerates
~25), so pacing derives from the sequence rather than from however long the
prose happened to be. Ratcheted in `tests/template-portfolio.test.ts` (the
anchors must start at 0, end at the last frame, strictly advance, and each
declared span must equal its anchor delta — all four proven red before trusted). (Same session, second confirmation: the vendor answered the
literal `generate_video` with a **preset recommendation and NO job** exactly as
s108 predicted — nothing rendered, nothing charged — and re-sending with
`declined_preset_id` returned a real job id. It also **substituted the model
twice**: `soul_2` ran as `text2image_soul_v2` and `seedance_2_0` ran as
`seedance_2_0_fast`. Record what RAN.)
Corollary (Morningside/site E, s110 — **end-frame-to-start-frame chaining buys
exact GEOMETRY, not exact GRADE**): s106's rule says chaining segments by
uploading the previous clip's last frame as the next one's `start_image` makes
the seam *"exact by construction"*. Measured on a two-segment chain, that is
**half true, and the failing half is the half nobody looks for.** Handed S1's
exact last frame, S2's first frame came back **geometrically exact** — best
offset dx=0, dy=0, no recompose — and **tonally shifted**: MAD 6.96, spread
evenly across the static linen (5.52) and the subject (6.69), with mean RGB
dropping 101/93/83 → 96/87/78 while every standard deviation held. Same
contrast, ~5 units darker. **The model re-grades.** Because it is a global
exposure shift rather than a shift in the frame, it is fixable **locally and at
0cr** — a per-channel mean/std match of the later segment onto the seam frame
took the seam 6.87 → 4.53, the residual being real content change. **Measure a
seam's OFFSET and its EXPOSURE separately; only one of them is free.**
**AMENDED at the build (Morningside, s111) — the correction above is aimed at an
accident of the ONE frame pair it was derived from.** Measured per frame on a
static patch instead of once at the join, the shift is not a constant re-grade
of the later take at all: it is a **settling transient at the HEAD of every
take**. S2 opens ~5 units dark and recovers by native frame ~16; S1 does the
same thing over its first ~86. A single constant match onto the seam frame
therefore levels the join and **over-brightens everything after it** — measured,
it drifts S2's last frame, the payoff shot, +5.8/+3.1/+3.4 off the reference
grade. Flattening EVERY frame of BOTH takes onto one measured reference instead
holds that to −0.2/+0.1/+0.4, fixes the seam identically (6.93 → 4.41 raw, and
≤0.6 per channel on the shipped bytes), and removes the opening ramp of each
take — which matters because the hero still IS the first take's frame 0, and
uncorrected it is the darkest frame of its own take. Same 0cr arithmetic, three
defects instead of one. **Restated: a correction derived from one measured
frame pair inherits that pair's accidents — measure the whole take before you
generalise from its seam.** Shipped as the manifest's `gradeFlatten`
(`scripts/export-template-assets.ts`), so the derive stays a pure function of
(pinned bytes, patch, target). (Same
session, the reason to check at all: **Seedance does not start exactly on the
still it is given** — S1's first frame sat MAD 7.36 off its own anchor
keyframe. So keyframes are DIRECTING instruments, not shipping assets: the
hero still is the take's frame 0, and any later keyframe must be derived from
the take rather than from the still that made it.)
Corollary (Marl & Cane/site D, s112 — **A GENERATED TAKE DOES NOT SPREAD ITS
TRANSFORMATION EVENLY ACROSS ITS OWN DURATION, so `frames: N` alone can spend a
third of a page's scroll on a still image**): an 8s `start_image`→`end_image`
veraison take returned 193 native frames. Measured per frame against its own
final state, the subject sat flat at ~100% for the first ~48 frames, changed
across the next ~75, and was then **pinned within noise for the last ~65** —
frames 128, 144, 168 and 192 are visibly one picture, confirmed on a contact
sheet. Sampling evenly across the whole clip, which is what every prior site
did, would have paid full scroll for a frozen image and squeezed the beat the
page exists for into the middle. **Measure the LIVE RANGE before choosing a
frame count**, and record it: `range: [lo, hi]` is now a manifest field
(`resolveFrameRange`, engine-side and unit-tested), so the range is a property
of the pinned bytes and not a hand-trim. The corollary to the corollary: a take
that reaches its end state early is not a bad take — this one's dead tail is
real biology, the fruit genuinely stops changing — so let the PAGE say so
rather than padding the motion (site D's last chapter is "and then it stops",
and the instrument carries the five weeks after).
Corollary (s112 — **ADJACENT-FRAME DIFFERENCE IS NOT COMPARABLE ACROSS
MEASUREMENT SPACES, and the benchmark this file records does not reproduce**):
the density rule above says compare against ㉒'s shipped bloom at "mean 1.19,
peak 2.09". Measured off the shipped bytes it is **1.52 / 2.44 / 2.14**, at both
1000×563 and 900×506 — not a resize artifact. Morningside's shipped beans measure
**1.51 / 2.05 / 1.83**. Two independent shipped-and-accepted sequences both sit
at **≈1.5 mean**, which is the number to use. The discrepancy is the ENCODER:
encoding is deterministic (the same frame twice differs by exactly 0), but two
slightly-different frames land on different quantisation decisions, and a true
1.18 measures **2.25 at webp q54** — an additive ~1.0 that has nothing to do
with motion and barely moves with quality (still 0.75 at q82). **Measure in ONE
space and say which; compare shipped bytes to shipped bytes**, because every
sequence known to read well is a shipped one. Prefer re-deriving the benchmark
from the shipped assets at measure time over quoting a remembered constant —
a documentary number that nobody re-runs is exactly the ratchet that rots.
Corollary (s112 — **a REGISTERED EDIT buys exact geometry and not exact grade,
and the patch you measure it on decides what you conclude**): two end-frame
candidates edited from one anchor on `seedream_v4_5` both came back in register
(dx=0 dy=0 and dx=0 dy=+1 on a ±24px search), so layout-naming held viewpoint on
both seeds where s106 measured that technique as a coin flip. But the exposure
check disagreed with itself: a "static" patch containing the subject's vine leaf
said the edit had lifted the frame +5.3/+7.3/−4.2, while **three pure-background
patches all said R and G barely move and BLUE drops ~6.5** — consistently, on
both candidates, so it is a property of the model and not the seed. The leaf had
been re-lit by the very edit being measured. **Choose the static patch to
contain nothing the edit touched and nothing adjacent to it**, and note that the
shift can live in a SINGLE CHANNEL rather than as an exposure offset. Fix it the
s111 way — flatten per frame in the derive — never by hand on the mint.
A near-clean take with one small garbled patch may take a
disclosed local blur pre-pin instead of another take — the /guide must say so;
a deterministic manifest crop (position + tighter aspect in the derive) that
composes the patch out of frame is preferred over a blur when the defect sits
at an edge (⑲ s64, the enhancer-added spoon). Non-hero, non-text slots stay the
builder's call. **Reference-guided minting (founder directive s64 — supersedes
the old no-reference rule):** browsing published sites for inspiration is fine,
AND real photographs from the web (Commons, food blogs, Pinterest-class
boards) SHOULD be fed to the vendor as generation references whenever a slot
keeps missing — a good reference plus a dense prompt is how humans drive these
models, and refusing it costs takes. Rules of the workflow: (1) references are
generation inputs ONLY — they never enter the repo, the page, or the pipeline;
every asset on the page remains a vendor-minted original, minted on the **paid
tier only**, pinned at mint time via the B7.1 pinning module with a full
provenance manifest (model, prompt, credits, license tier, and the reference
noted in params). No surface ever holds a vendor URL. (2) EYEBALL every
reference before feeding it — the reference must ALREADY LOOK like the target:
soul-class enhancement captions the reference image and that caption wins over
prompt text, so a ref is for "make exactly this", never "make this but
different" (⑲ s64: a grey-buckwheat soba ref stayed grey through two takes
against explicit vivid-green language; the green keeper was text-only. The
same round: a chūtoro-nigiri ref nailed first-take the tuna that text-only had
minted as beet in ⑲'s original build). (3) Never feed watermarked stock comps
or references carrying text overlays — watermarks and captions are pseudo-text
seeds. (4) When the ref fights a wanted attribute, change the ref or drop it;
don't stack adjectives against it.

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
**Corollary — a code-drawn instrument may be SCHEMATIC but never a drawing of
a THING (⑳ Whitethorn, s104, cost: three build rounds).** Hand-drawn
naturalistic figures — animals, people, objects — do not converge in SVG: the
gait model was correct on round one and the *dog* was still a bad cartoon on
round three, and each round only moved the failure around. What converged
immediately was changing register: the instrument became a **marker-and-trace
kinematic plot** (joint markers, limb segments, the loop each paw traces, the
footfall trail on the belt) — which is literally what veterinary gait analysis
produces, so being a diagram is honest rather than a substitute for a picture.
**The test before you draw anything: does the real discipline produce this
drawing?** If yes, draw it and it will read as expertise. If no, you are
illustrating, and illustration is a MINT. Division of labour that works: the
photographs carry the feeling, the diagram carries the evidence. (Founder
note, same session: *"definitely use higgsfield … if you need help with
drawing or artwork."*)

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
polish it out. **A CHANGE OF REGISTER SILENTLY DROPS THE REQUIREMENTS THAT
BELONGED TO THE OLD ONE (⑳ Whitethorn, s104 — founder-caught).** The wink was
designed as "the drawn dog turns and looks at you"; when the instrument was
re-registered from a drawn dog to a kinematic plot, the wink went with it and
the page shipped with none. Nothing flagged it — it was not a code defect, it
was a requirement that lost its host. **Re-run this checklist after any change
of APPROACH, not only after a change of code**, and re-home every item that
belonged to the thing you replaced. (Whitethorn's replacement: at the final
scroll stop only, the paw-print trail wanders off the measured line under
*"(stopped to sniff something)"* — a clinical instrument that suddenly
contains a real animal.) (7) **Lead archetypes are cast per vertical (founder
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
**Window-glazing corollary (founder, s63 ⑱ review):** when the outdoor
counter is shown THROUGH a window, keep the glazing MINIMAL — one or two
panes, never a mullioned grid. Multiple vertical/horizontal bars across the
glass read as a CAGE or prison and quietly reintroduce the confinement the
shot exists to dispel (⑱'s valley-window hero shipped with a four-pane grid
— passed as a minor, but a single large pane would have read as pure
openness). Prompt for "a single large pane" / "floor-to-ceiling frameless
glass" / "one uninterrupted window"; the frame is a thin border, never a
grille. Same caution as §9's nature-frame: the frame must open the view, not
bar it.
(9) **Nature is the supporting cast (founder-taught, s62 ⑯ fix round — the
house style, stated):** the OBJECT/craft is the frame's protagonist; nature
(landscape, greenery, weather, sky, urban nature) is the supporting cast
that frames, mirrors, and dignifies it; PEOPLE are subtle decoration around
the object, never the stars. The ⑯ model case: the hero re-cast from
storm-gloom to a terracotta roof in full sun with a mountain peak behind it
ECHOING the gable's triangle — the landscape literally mirroring the
subject's geometry. Applied readings: compose heroes with a natural
backdrop that answers the subject's shape; sunny/natural glory is the trust
register for openings (drama lives in inner chapters where the story earns
it); when a brutalist/industrial axis is drawn, look for where nature can
counterweight it. Portfolio positioning on the record: the nature-natural
register (Ember & Rye · Orchard House · Sprig & Barrow · First Crack ·
Stem & Vow) is this portfolio's A-strength; brutalist registers are
competence, not signature.
**The social-register dial (founder refinement, s62 wave-4 planning):** how
much human presence a page earns scales with how SOCIAL the purchase is —
never with a wish for faces. Social verticals (dining, cafés, salons, pet
care, weddings — the product is experienced with or through people) earn
human elements in frame (the ⑩ laughing-friends hero is the model: what's
sold NEEDS people); nature/object still leads and people are the warmth
layer — candid, absorbed, counted like the wink: one or two moments,
seasoning not cast. **Food-scene casting corollary (founder correction,
s62): hands-only compositions are NOT the safe default for food — cropped
hands over plates can read unhygienic to part of the audience. The working
composition is a candid, attractive young PAIR (couple or friends) engaged
with EACH OTHER, food nearby in the frame — the ⑩ model made food-forward:
the dish stays a protagonist, the people supply the social proof and the
eye-candy warmth, faces present but never the zoomed-in subject and never
camera-staring. The ⑮ close-crop/bokeh grammar remains for verticals where
faces must compose OUT (weddings), not for dining tables. Craft/trade
verticals get ONE absorbed practitioner as the trust signal (the ⑯
roofer / ⑫ dentist model: nature primary, the person secondary). Precision/
B2B verticals (science consumables, logistics) keep humans minimal-to-absent
— there the fresh twist is §8 applied hard: counter the vertical's
cooped-up-indoor association with light, nature at the microscale
(micrographs), and air, not with staff photos.
**The price-register corollary (founder-taught, s64 ⑲ review):** motion
budget and food-macro share scale DOWN as the price point goes UP. Scroll
choreography that performs for attention reads as *selling*, and true luxury
doesn't sell — "quality doesn't need to shout for attention; people who know
it just follow it." A fine-dining page's product is the ATMOSPHERE — the
room, the setting, the view, the company — so its imagery leads with still,
wide shots of the space and the people in it (fine dining is the most social
food purchase; the dial reads HIGH), food in the supporting role, near-zero
scroll choreography, generous stillness, the reservation as the only action.
Drenched food macros + kinetic scroll grammar is a CASUAL-kitchen register —
energetic, appetite-forward, exactly right for ramen bars and cafés (⑲'s
re-theme is the model case: the founder moved the restaurant down-register
to match the page's energy rather than quieting the page). Match the page's
energy to the venue's price register before drawing any motion.

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
**Corollary (Marl & Cane, s112 — the twin has to share a SCREEN, not just a
clock):** site D put its ripeness curve in a section BELOW the pinned scrub, so
the two readings were on one clock and never once visible together — the reader
watches the fruit, then several screens later meets the chart. That satisfies
the letter of this rule and none of its point. The fix was to put the
instrument's own interpolated numbers into the stage's stamp, beside the picture
they describe and out of the same data block ("Day 19 · Colour · mixed · 15.8°
Brix · 13.5 g/L"). **Check that the twin and the instrument are co-visible at
some scroll position; if they never are, one of them is decoration.**
**Corollary (s112 — an accent that walks a HUE ARC cannot hold a fixed
lightness):** site D's one accent is read off the frames and travels green (68°)
→ rose (22°) → red (4°) → red-violet. At a constant HSL `L`, contrast against
the page ground swings wildly, because HSL lightness is not perceptual
lightness: at L=34% the yellow-greens measured **3.67:1 and 29 of 81 frames
failed AA**, while the reds and violets passed at 5.9–7.3:1. **Solve L per hue
for a constant contrast ratio** (bisection against the real WCAG formula takes
ten lines) rather than picking one L and checking the ends — every frame then
passes AND the accent keeps a constant visual weight as it travels, which is
also the better design. This is the s111 "an accent can fail at the END of its
own arc" trap generalised: on a hue sweep it can fail at either end or in the
middle, so check EVERY step, not the endpoints.

**Hero register rule (founder direction 2026-07-15 s37):** the first
impression must be *real*. A code-drawn model, schematic, or illustration
cannot carry the hero on a premium/boutique vertical — it reads cartoon, not
bespoke; lead with photography-grade minted imagery and let the crafted/model
register live in an inner scene where being a drawing or model IS the story.
Corollary for place-based verticals (real estate, hospitality, food): nature
is load-bearing — greenery, trees, and setting sell the story; a bare subject
on a bare background fails the register even when technically clean.

**A PINNED INSTRUMENT HAS FOUR SILENT KILLERS (㉑ Aspect & Fall, s105 — all
four found by RENDERING, none visible to types, lint or 3,441 tests).** A
scroll instrument that does not pin is not a degraded page, it is a page with
no product: the chapters scroll past driving nothing. Check all four by
measuring `getBoundingClientRect().top` of the pinned element — it must read
`0` while the section is in view, and anything else means one of these:

1. **The sticky element's column does not stretch.** `align-items:flex-start`
   on the stage row cancels flex's default stretch, so the sticky column is one
   viewport tall inside a 4,000px section and has no travel. Measured at 992px
   inside 4,290px. Leave the row stretching, or use grid.
2. **Any `overflow` on ANY ancestor.** `overflow-x:hidden` computes
   `overflow-y:auto`, which makes that element a scroll container and breaks
   `position:sticky` against the viewport outright — measured at `top:-1843px`.
   This one is invisible in the source and survives every other fix. A page
   wrapper with `overflow-x:hidden` is the usual culprit.
3. **The narrow layout collapses the travel.** In a single-column layout the
   stage's own cell is only as tall as the stage, so the same failure returns
   on phones only. Move `position:sticky` onto the column and make the section
   a column flex container. **(s112: this is the one that keeps coming back, and
   it is invisible on desktop BY CONSTRUCTION.** Site D restated both `position`
   AND `height` in its narrow query, per the s111 lesson, and the pin was still
   dead at **724 of 724 in-view samples** — because the cause was neither: with
   `.stage-col { flex: 0 0 auto }` the sticky element's containing block is
   *exactly its own height*, so there is nothing to travel through. Desktop
   escapes it only because `align-items: stretch` silently makes the column as
   tall as the whole section. **Measure the pin at a phone width every time —
   the desktop result carries no information about it.** 0 of 688 after the
   sticky moved onto the column.)
4. **The reading line is measured from zero.** When the pinned stage covers the
   top of the viewport, a chapter-activation test measured from `0` marks a
   chapter active while its heading is still *behind* the sheet (⑳ shipped this
   on mobile). Measure the line from the stage's bottom edge on narrow screens.

**A STACKED FRAME SEQUENCE HAS A FIFTH KILLER, AND IT LOOKS LIKE SUCCESS
(Small Hours, s107).** A scrub built as absolutely-stacked `<img>` needs exactly
ONE frame lit at a time. The static markup must ship one already lit (or the
no-JS stage is blank) — and if the runtime's "currently shown" index starts at
a sentinel like `-1` instead of being **seeded from the markup**, the first swap
has nothing to clear, that initial frame stays lit, and since it is later in DOM
order it keeps painting on top of every frame the scroll selects. **The scrub is
then completely dead while every still screenshot looks perfect**, the clock and
the readouts move correctly, and the console is silent. Found only by counting
lit frames at a series of scroll positions. Two rules: **seed the index from the
DOM**, and make the swap clear *every* other frame so "exactly one is on" is
true by construction rather than by bookkeeping. Ratcheted in
`tests/template-portfolio.test.ts` (static markup ↔ inert data block, including
the lit-frame count) — and that test was proven to FAIL against both defects
before it was trusted.

**THE CLOCK FOLLOWS THE PROSE, NOT THE SCROLLBAR (㉑, s105).** Driving the
instrument linearly against section progress put the sheet on OCTOBER while the
reader was still on the July chapter — the instrument contradicting the words
beside it, which is the one failure a data-instrument page cannot survive. Give
each chapter its month/day/state as a `data-` attribute and interpolate the
clock between those anchors. The chapters are the score; the instrument follows.

**STATIC-FIRST IS A HONESTY GATE, NOT A PERF GATE (㉑, s105).** Build the
instrument's geometry as real markup generated from the data, and let the
script only *animate* what is already drawn. Built the other way — JS creating
every circle, bar and label on load — the page renders an empty frame with
JavaScript off, **while `/guide` claims the opposite in writing**. That is a
false statement on the honesty page, which is worse than the missing feature.
The rule that prevents it: **a single source of truth** — the schedule/data
lives in one inert `<script type="application/json">` block, the static SVG is
generated from it, and the runtime reads the same block. Nothing can drift.
**Corollary, general: every claim the `/guide` page makes is a claim that has
to be TESTED, not intended.**

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
   brand tokens are no longer guarded (retired 2026-07-26); run `npm run verify`
   before every commit.

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

**Amendment for an INSTRUMENT FAMILY (s104, the landing arc).** When a wave is
commissioned as an animation family — every site existing for its scroll
instrument, as the founder directed for the A+ arc — the sites share the
animation primary by construction and the uniqueness rule cannot hold
literally. In that case the **distinctness burden moves to the secondary axis,
the palette, the type and the instrument's own grammar**, and each site instead
records its axis PAIR as portfolio-unique (checked against every `site.json`).
Stated so a re-charter can accept or reject it rather than inherit it silently.

---

*v1, 2026-07-14 (session 31). Owner: lead. Revisions ride wave checkpoints —
lessons from each wave amend this file in the same change (ratchet rule 8;
tag: opinion, except §Non-negotiable gates which are invariant).*
