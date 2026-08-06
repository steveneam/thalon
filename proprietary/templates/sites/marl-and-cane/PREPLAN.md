# Marl & Cane — pre-plan (meta-prompt §How-to step 3)

> ## ⚠ REBUILT s112 — THE FOUNDER REJECTED THE SPINE, AND HE WAS RIGHT
>
> The first build shipped an 81-frame **veraison** scrub: one bunch ripening
> green to black. It was technically the best-measured thing in the arc and it
> was the wrong idea.
>
> > *"i think you didnt need a transition video of the grape turning ripe. did
> > you not learn that my taste is not precise or scientific but imaginative and
> > abstract … a better animaton would have been grapes, then them
> > bursting/squashed to extract their juices, the juices then land into a wine
> > bottle then poured into a wine glass. the morning side coffee bean
> > transition was good, but that was under my direction. so that's the kind of
> > abstraction i want."*
>
> **The distinction, now in the meta-prompt as §THE HOUSE TASTE: a TIME-LAPSE
> versus a JOURNEY.** A time-lapse observes one subject while nature acts on it
> — a bunch ripening, a tree through four seasons. It documents, and it is what
> a botanist would film. A journey follows a *material* through states, by an
> act, to a payoff — beans → grounds → cup, or grapes → burst → bottle → glass.
> Morningside, the one he liked, is a journey. Veraison was a time-lapse. **The
> arc's other three motions are time-lapses too**, which is likely why Aspect &
> Fall and Small Hours came back as *"ok, but not memorable."*
>
> He also called the copy out — *"wasnt the ratchet for these, dont be too wordy
> or verbose?"* He is right and it was already written down: *"less is more, but
> still with the same effect"* and *"more visual, fewer words"* (s90), living in
> `docs/research/ux-refinement-program.md`, a workspace-UX doc nobody opens
> during a portfolio build. This page shipped **851 words, third-wordiest of 25,
> against a 628 median and Morningside's 594.** Now **371**, and the budget is
> executable in `tests/template-portfolio.test.ts`.
>
> And the wine-glass photograph he flagged for compression is **gone rather than
> re-encoded**: the pour sequence ends on a glass, so the still was saying the
> same thing twice. (The re-encode was measured first — q80 left max error 21 on
> the flat concrete; the real answer was that the picture was redundant.)
>
> Everything below the §0 sweep is the ORIGINAL pre-plan and is left standing as
> the record of what was decided and why. §BUILT carries the first build's
> findings; §REBUILT carries the second's.

**Site D of the landing arc** (`docs/landing-arc/spec.md` §SITES D AND E), and
the last site in the arc. The founder's brief, verbatim:

> *"can you add a motion version of Orchard house, but can call it site D or
> something, maybe a vineyard/winery?"* … *"actually, do site D and E after
> thalon with any left over credit."*

Built on the spend-down after the capstone and site E both landed under budget:
**286.14cr** in hand against a spec tier of ~110cr.

## §0 — Look-first sweep (meta-prompt step 0, mandatory before planning)

Live browser, look-and-learn only; nothing downloaded into the pipeline.

1. **The winery default is oxblood + gold + a centred high-contrast serif, and
   it sells THE BOTTLE.** Dribbble's `winery-website` results converge hard:
   deep burgundy or near-black grounds, gilt rules, script or Didone display
   type, a bottle shot dead centre, cream cards. It is the wine equivalent of
   the "high-contrast fashion serif" Morningside refused for coffee. **This page
   refuses all of it** — the bottle appears once, late, and small.
2. **motionsites.ai maps the AI-landing default the arc exists to refuse** —
   dark grounds, neon glow, glassmorphism, 3D product spins. Of ~30 gallery
   entries exactly two (*Acreage Farming*, *Urban Jungle*) are agricultural.
   The nature-first register really is differentiated in the MOTION register,
   not just the stills register — which is the founder's stated A-strength.
3. **Veraison is MOTTLED, and that is the whole design.** Pinterest's veraison
   results show what the word actually names: a single bunch carrying green,
   rose, red and near-black berries **at the same time**, because the fruit
   turns berry by berry, not all at once. The naive reading — "green bunch
   becomes purple bunch" — would have produced a uniform colour swap, which is
   both botanically false and dramatically inert. **The mottled middle is the
   most beautiful frame in the sequence, and it is where the page dwells.**
4. **The truth is MATTE, and wine photography lies about it.** Real fruit
   carries a pale waxy *bloom* — dusty, chalky, light-absorbing. The category's
   imagery defaults to backlit jewel-gloss. The bloom is a texture this page can
   own for free, and it is what makes the fruit read as agricultural rather than
   as a drinks advert.
5. **The discipline draws real plates.** A grapevine study plate (stem / leaf /
   fruit, annotated) is a genuine artifact of the field — which is the
   meta-prompt's test for whether an instrument may be drawn at all.

## Draw

| | |
|---|---|
| **Slug** | `marl-and-cane` |
| **Vertical** | `wine-vineyard-estate` (portfolio-new) |
| **Primary axis** | `otherworldly-animation` |
| **Secondary axis** | `brutalist-raw` |
| **Wave** | 4 (landing arc, site D) |

### The secondary axis — the open draw, decided

The spec left D's secondary open (`exceptional-palette` was reassigned to site C
at s107) and named two survivors: `physics-interaction` and `brutalist-raw`.
Checked against all 24 shipped `site.json` files, **both pairs are still
portfolio-new in either ordering**. The tie is broken on the motion budget, and
the argument is Morningside's, reused because it is correct:

- **`physics-interaction` is rejected.** It would be a *second motion system*
  competing with the scroll spine for the same clock. Morningside rejected it
  for granular coffee for this exact reason, and a vineyard has no stronger
  claim on springs and collision than beans did.
- **`brutalist-raw` costs zero motion budget** — it lives in structure, type and
  the presentation of numbers — so the whole clock stays with the fruit. It is
  also a real winery material register (concrete fermentation vessels are
  current practice, not a conceit), and it is the sharpest available refusal of
  the oxblood-and-gilt default the sweep found.

**The nature counterweight is built in, per the founder's own rule** ("when a
brutalist/industrial axis is drawn, look for where nature can counterweight
it"): the page's entire hero is a living plant in raking sunlight. Brutalism
here is the *frame around* the nature, never the subject — which keeps the site
inside the portfolio's A-strength register rather than trading it for
competence.

### The name

Spec candidates were *Veraison* · *Southfacing* · *Marl & Cane*. The spec asked
for a collision check on the first. **Checked, and it fails:**

- **Veraison — REJECTED on evidence.** Multiple live trading names (a London
  wine bar, an Iowa wine shop, a closed Vancouver WA bar), a near-homophone
  winery (*Varaison Vineyards*, Palisade CO) and a **registered trademark
  holder, "Veraison Wine Cellars, Inc."** The spec's own caution was right.
- **Southfacing — rejected on two counts.** A south-facing slope is the warm
  aspect only in the *northern* hemisphere, so the name silently picks a
  hemisphere; and `aspect-and-fall` already owns "aspect" in this portfolio.
- **Marl & Cane — TAKEN.** No collision found. Both words are real viticulture:
  **marl** is a clay-limestone soil genuinely prized for vineyards, and **cane**
  is the one-year-old wood that cane-pruning leaves. It also matches the
  portfolio's established `X & Y` form (seven of twenty-four shipped sites).

**The name and the page argue opposite halves of the same idea, deliberately.**
The masthead names the two *constants* — the soil and the wood, which do not
change — while the page is about the one thing that never repeats. That is the
actual wine argument (terroir versus vintage), and putting the constant in the
name lets the page spend all of its energy on the variable.

### Overlap to beat — `orchard-house`

The spec names it: differentiate on **register**. `orchard-house` sells a
*repeating cycle* — the seasons come round, the kitchen cooks what is ready.
A winery sells a **vintage**: one year, numbered, that will never occur again.
So this page is dated, specific and factual where the orchard is perennial and
warm. It is also the reason the brutalist secondary fits: a vintage is an
argument from *evidence*, and evidence wants to be set plainly.

## The spine — one take, not three

**The spec's ~110cr "full" tier assumed three segments. That is superseded by
s107/s108 and the correct build is ONE take.** Veraison is a **one-way
transformation of a single subject**, so the s107 instrument applies exactly:
mint the two endpoints and let one continuous `start_image`→`end_image` take
supply everything between. There is no intermediate state that is a *different
subject* (Morningside's grounds were their own shot; a half-turned bunch is not),
so chaining would buy a seam nobody wants and pay the registration coin-flip for
it. **Cost of the spine: 36cr, not ~110.**

### The mints

| slot | seat | cost | outcome |
|---|---|---|---|
| green anchor (start) | `text2image_soul_v2` ×4 | 0.48 | 2 rejected on botany, 2 minted again, **C kept** |
| turned anchor (end) | `seedream_v4_5` ×2 | 2.00 | **A kept on measured registration** |
| the take | `seedance_2_0`, 8s / 720p / std | 36.00 | — |

**Why 8s at 720p rather than 5s at 1080p (45cr) or 8s at 1080p (72cr):** the
shipped frames are 900px wide, so 720p already oversamples the delivery size by
1.4×, while the extra three seconds buy ~70 more native frames. **For a scrub,
frame count is the binding constraint and source resolution is not** — the page
is limited by how smoothly the sequence steps, not by pixels it will throw away.

## §The schematic test — this site DOES ship an instrument, lightly

Morningside deliberately shipped none, because `first-crack` already owned the
expert coffee register. **The opposite is true here**: nothing in the portfolio
plots ripeness, and the discipline's own artifact is unambiguous — growers plot
**sugar (°Brix) rising against titratable acidity falling**, and pick where the
two enter a target band. That passes the meta-prompt's test ("does the real
discipline produce this drawing?") outright.

It stays **light** — one small plot, not ㉑'s full instrument — because the
motion is the hero and a second full instrument would repeat site B.

**Its lay twin is free, and it is unusually honest.** The meta-prompt requires
every expert instrument to be paired with a physical reading of the *same*
information on the *same* clock. Here the twin already exists: **veraison is the
visible proxy for sugar accumulation.** The curve carries the evidence and the
fruit's colour carries the feeling, and they are not analogies for each other —
they are two readings of one physical process, on one scroll clock.

## Palette — an achromatic page with exactly one thing in colour

Ground: bone / concrete grey / near-black ink. **The only colour on the page is
the fruit's own**, and it walks green → rose → blue-black as the reader scrolls,
because the page's accent is *sampled from the frame the scrub is currently
showing*.

Distinct from `small-hours`, which also derives its colour from its instrument:
that page is *drenched*, its whole world changing. This one is resolutely grey
and holds a **single chromatic event** inside an achromatic page — the opposite
move with the same honesty.

## §BUILT — what the build changed about the plan (2026-08-06, s112)

**Shipped for 38.96cr against a ~110cr tier.** 81 frames, one take, a light
Brix/acid instrument, `/guide`, and every ratchet broken deliberately before it
was trusted.

### 1. "Green grapes" is a VARIETY, not a ripeness stage — caught on the anchor

The first two anchor candidates asked for "hard, unripe, pale yellow-green
celadon berries" and returned exactly that: **ripe *white* wine grapes**,
translucent and golden. The model resolved "green grape" to the colour of a
white variety at full maturity rather than to the colour of unripe fruit.

The consequence would have been structural, not cosmetic: **a white variety has
no veraison to purple at all.** Chaining a blue-black end frame off either
candidate would have produced a sequence that is a lie about the plant — the ㉑
hydrangea failure, one level deeper. The fix was to pin the thing that
determines the colour — **name a RED variety** ("unripe Cabernet Sauvignon …
weeks before it colours") — and to describe the unripe state by *hardness and
opacity* rather than by the word green ("opaque and dull blue-green like an
unripe olive, matte chalky bloom, no translucency"). Kept on the first attempt
after the correction. Cost of the lesson: 0.24cr, because it was caught on the
ANCHOR before anything derived from it (s107).

### 2. A registered EDIT buys exact geometry and not exact grade — and the patch you measure it on decides what you conclude

Both end-frame candidates came back in register — **dx=0 dy=0** and dx=0 dy=+1
on a ±24px search — so the layout-naming prompt held viewpoint on both seeds,
where s106 measured that technique as roughly a coin flip. Kept candidate A on
the measurement.

But the first exposure check said the edit had *lifted* the frame
+5.3/+7.3/−4.2. Measured again on **three pure-background patches**, the answer
was completely different and consistent across both candidates: R and G barely
move (−0.3 to −2.5) and **blue drops ~6.5 on every patch**. The first patch had
contained the vine leaf — which the edit genuinely re-lit — so a subject the
edit was *asked* to change had been counted as static. **Restated: choose the
static patch to contain nothing the edit touched, and nothing next to it.**
s110→s111 established that a chained take re-grades; this extends it to the
edit seat, and adds that the shift can live in ONE channel.

### 3. **A generated take does not spread its transformation evenly across its own duration**

This is the session's real find. The 8s take runs 193 native frames. Measured
frame by frame against its own final state, the bunch sits flat at ~100% for the
first ~48 frames, falls across the next ~75, and is then **pinned within noise
for the last ~65** — frames 128, 144, 168 and 192 are visibly one picture.

`frames: N` samples evenly across the whole clip, which is what every prior site
did. Here that would have spent **a third of the page's scroll on a still
image** and squeezed the beat the whole page exists for into the middle. Ratchet:
`range` is now a first-class manifest field resolved by `resolveFrameRange`
(engine, unit-tested, three ways proven red), so the live range is a property of
the pinned bytes rather than something a human trims by hand.

### 4. The density benchmark in the meta-prompt does not reproduce, and the reason is the measurement SPACE

The rule says compare adjacent-frame difference against ㉒'s shipped bloom at
"mean 1.19, peak 2.09". Measured off the shipped bytes it is **1.52 / 2.44 /
2.14**, at both 1000×563 and 900×506, so it is not a resize artifact. Morningside's
shipped beans measure **1.51 / 2.05 / 1.83** — two independent shipped sequences
that read well, both at ≈1.5.

The gap is the **encoder**. Encoding is deterministic (same frame twice → zero
difference), but two slightly-different frames land on different quantisation
decisions, and measured directly a true 1.18 becomes **2.25 at webp q54** — an
inflation of ~1.0 that has nothing to do with motion and barely moves with
quality (0.75 even at q82). A PNG-space number and a shipped-byte number are
different quantities. **Measure in one space and say which; compare shipped to
shipped, because the sequences that "read well" are shipped ones.**
Shipped-to-shipped this site runs **1.71 / 2.30 / 1.94** at 81 frames.

### 5. Four defects the browser found that no test could

- **The mobile pin was dead — 724 of 724 in-view samples.** Not the s111 cause:
  height was fine. In the single-column layout `.stage-col` is `flex: 0 0 auto`,
  so the sticky element's containing block is *exactly its own height* and has no
  travel (㉑ killer 3). Desktop escapes it only because `align-items: stretch`
  makes the column as tall as the section. Sticky moved onto the column: **0 of
  688 after.**
- **The stage was bound by column WIDTH, not by `--stage-max-h`** — 328px tall in
  a 900px viewport. Widening the season to 1400px and the stage column to 58%
  took it to 415px.
- **A fixed HSL lightness cannot survive a hue sweep.** The accent walks
  green→red→violet; at a constant L=34% the yellow-greens measured 3.67:1 and
  **29 of 81 frames failed AA**. Solving L per hue for a constant 4.85:1 fixes
  every frame (worst 4.80:1). The s111 trap — an accent that fails at one end of
  its own arc — fired again, at the opposite end.
- **The colour readout lagged the picture by ~20 frames**, because its
  thresholds were guessed. Read off the shipped contact sheet instead: first
  berries 18, mixed 26, mostly turned 47, complete 67. Morningside made the same
  mistake with "grinding".

### 6. The instrument was never on screen while the scrub drove it

The chart is a section *below* the season, so the "one clock, two readings"
pairing the meta-prompt requires would never actually have happened — the reader
sees the fruit, then later sees the curve. The stage's stamp now carries the
chart's own interpolated numbers (`15.8° Brix · 13.5 g/L`) beside the picture
they describe, from the same data block. The twin is the cheap half; **the
requirement is that they share a screen, not merely a clock.**

### 7. Three page-arithmetic errors found by re-deriving the page's own claims

Hang time 21 Jan→26 Mar is **65 days, not 68**; the scrub covers the colour
change only (21 Jan→25 Feb, **36 days**, not the whole hang); and Brix at the
26 Mar pick interpolates to **24.2, not 24.3**. All three were internally
inconsistent with the table printed on the same page.

### What was decided, not measured — and is disclosed

The closing red-violet (hue 310°). By the last frames the fruit is desaturated
below where a hue is meaningful (sat 0.02–0.07), so that one number is a design
choice; 310° was taken over 288° because it is a smaller extrapolation from the
last *measured* hue (4°) and reads as wine rather than violet. `/guide` says so
in those terms.

### 8. The docroot-leak ratchet caught a real leak — mine

The first full-suite run went red on *"the factory method docs stay OUT of
sites/"*: a source comment in the shipped `index.html` named an internal method
doc while explaining why the twin exists. On a prospect-facing page that is
exactly the leak the boundary exists to stop, and no amount of local testing
would have found it — the site's own 11 ratchets and every browser measurement
were green. Rewritten to state the reason without naming the document.

**And the run that found it reported itself as passing.** `npm run verify > log;
echo "EXIT: $?"` leaves the *wrapper* exiting 0, so the harness summarised a
two-failure gate as "exit code 0" — the `verify | tail` disease in a new
costume. The log said `VERIFY EXIT: 1`. **Propagate the code (`ec=$?; …; exit
$ec`) and read the log, never the summary.**

### Carried, not fixed

`/favicon.ico` 404s — **portfolio-wide, 0 of 25 sites ship one**, pre-existing
and out of this build's scope.

---

## §REBUILT — the juice journey (2026-08-06, s112, after the founder's review)

**Four beats, three takes, 140 frames, 371 words.** Grapes → burst → bottle →
glass, exactly as he described it. Spend for the rebuild: **93.20cr** (12 stills,
2 registered edits, 4 takes of which 3 shipped). Balance **247.18 → 153.98**.

### 1. Ask what KIND of motion each beat is, per beat — not per site

s108 says a pour is a **cycle**, not a transformation, so it needs one start
frame and no end frame. This spine contains **both kinds**, and treating them
identically would have wasted money and bought risk:

| beat | kind | instrument | registration risk |
|---|---|---|---|
| the crush | transformation | two keyframes, the second a registered EDIT of the first | real, and it bit |
| the bottle fill | **cycle** (a pour) | single `start_image`, no end | none by construction |
| the glass filling | **cycle** | single `start_image`, no end | none by construction |

Two of the three beats needed no end frame at all. **The question is per-shot,
not per-site.**

### 2. The first crush take was discarded — and the cause was the KEYFRAME, not the prompt

Take one recomposed itself across native frames 31–59: measured steps to
**7.62 against a 0.54 median**, a smeared shot change rather than a clean cut.
A scrub exposes exactly what a dissolve hides (s106).

The instinct is to write a sterner prompt. The rule says otherwise — **a
generated transition is pulled by its END frame** — and it was right: the end
keyframe had been minted independently and sat at a *wider framing*, so the
model had to reframe to reach it. Re-minting it as a **registered edit of the
start frame** (dx=0, dy=−1) fixed it outright: **0 cut candidates, median 0.33,
max 0.93.** Cost of the lesson: one 22.50cr take.

**Generalised: when a chained take drifts, look at what it is aiming at before
you touch the words.** The anti-cut language went in as well, but it is not what
fixed it — the second take of the *same prompt* against a badly-framed end frame
would have drifted again.

### 3. Negating a label still does not remove it

Two bottle stills came back wearing invented labels against a prompt that said
"NO label and NO capsule anywhere on it — plain unbroken glass". The s52 rule
applies unchanged and the fix is never a firmer negation: **crop the printable
surface out of frame.** Reframing to the neck and shoulder alone, with the body
below the bottom edge, worked first attempt — and is a better shot, because it
is about the liquid rather than the packaging.

### 4. A multi-sequence stack needs `.is-live`, or it must ship blank or double-lit

Three sequences in one stage cannot each carry a lit frame *and* show only one.
The portfolio ratchet caught this immediately (`fill` and `pour` had zero lit
frames). Morningside's answer is the pattern: **every sequence carries its own
lit frame so no-JS is never blank, and a `.is-live` class on the container
decides which one paints.** Adopted, and the runtime now toggles both.

### 5. A chapter that drives no frames still needs runway

With the chapters as written, the reading line crossed chapter one's bottom edge
while the season was barely in view, and **the first eight frames were spent
before the stage was on screen** — s108's aim problem in a new place. The first
chapter's job is to *hold* frame 0, so it gets 26vh of top padding and drives
nothing. Verified: the stage is visible and still on frame 0.

Related: the crush originally drove **71 of 140 frames from a single chapter**,
which left ~2,400px of empty column beside the picture. Split into two chapters
so text runs the length of the sequence.

### 6. Measured on the shipped page

| | desktop 1440×900 | phone 390×844 |
|---|---|---|
| frames reachable | **140 / 140** | **140 / 140** |
| frames starved of scroll | 0 | 0 |
| exactly one frame lit | 0 violations | 0 violations |
| exactly one live sequence | 0 violations | 0 violations |
| pin held (`top === 0`) | **0 / 943** | **0 / 591** |
| px of scroll per frame | 42–54 (median 42) | 24–30 |

Shipped adjacent-frame difference: crush **1.73**, fill **1.60**, pour **1.29**
against the house references (small-hours 1.52, morningside 1.51).

### 7. What the review says about the arc, not just this site

He called Aspect & Fall and Small Hours *"ok, but not memorable"* and Whitethorn's
kinematic plot *"too scientific"* — and asked to **keep** Whitethorn regardless.
Those are three of the arc's four other motions, and all three are time-lapses or
diagrams. The correction is recorded at the top of the meta-prompt rather than
here, because it governs the next site rather than this one.
