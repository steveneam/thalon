# Morningside — pre-plan (meta-prompt §How-to step 3)

**Site E of the landing arc** (`docs/landing-arc/spec.md` §SITES D AND E), built
on the spend-down after the capstone landed under budget. The founder's brief,
verbatim:

> *"site E is a cafe. or a coffee brand like campos coffee if it makes things
> easier. the coffee animation takes center stage."* … *"maybe the motion can be
> coffee beans transitioning to coffee pouring into a cup"*

**That last sentence is the architecture, not a preference.** Everywhere else in
this portfolio the motion is a chapter *inside* the page. Here the
transformation **is the scroll spine, top to bottom**, and every other element
hangs off its three beats. It is the only site in the arc whose animation is the
page rather than a chapter of it.

## Draw

| | |
|---|---|
| **Slug** | `morningside` |
| **Vertical** | `food-coffee-brand` |
| **Primary axis** | `otherworldly-animation` |
| **Secondary axis** | `soft-organic` |
| **Wave** | 4 (landing arc, site E) |

### The name

Spec candidates were *Slow Pour* · *Bell & Bird* · *Morningside*. Taking
**Morningside**, on register and on pattern:

- **Register.** This is a PRODUCT page, deliberately — see the overlap section
  below. A technical name (*Drawdown*, *Nine Bar* — both real pour-over and
  espresso vocabulary, both considered) would have pulled it toward the expert
  register that `first-crack` already owns. *Morningside* is about **when you
  drink it**, not how it is made, which is the correct register for the page
  whose whole argument is one continuous transformation ending in a cup.
- **Pattern.** Six of the twenty-three shipped sites already use the `X & Y`
  form (`Sprig & Barrow`, `Pearl & Rowe`, `Stem & Vow`, `Fern & Crumb`,
  `Aspect & Fall`, `Hue & Cry`). *Bell & Bird* would have been the seventh.
  Single-word place-names are the other established house pattern (`Whitethorn`,
  `Northpace`, `Crateline`, `Loopwell`, `Truebore`, `Houselights`, `Tsukimi`)
  and it is the less crowded one.
- *Slow Pour* was rejected as descriptive-of-the-motion: the page already
  performs the pour, so a name that also announces it is redundant.

### ⚠ The axis pair, verified against the portfolio rather than asserted

`otherworldly-animation` is the portfolio's most-used primary. Read out of the
shipped `site.json` files, it has been paired with `editorial-print` (⑳
Aspect & Fall), `novel-typography` (Northpace), `cinematic-imagery`
(Orchard House), `exceptional-palette` (㉒ Small Hours) and `data-instrument`
(⑳ Whitethorn) — **never with `soft-organic`.** The pair is genuinely
portfolio-new.

`soft-organic` deliberately *supports* rather than competes.
`physics-interaction` would have been a lovely fit for a granular material like
beans, and it is why the spec flagged it — but **a second motion system would
fight the spine**, and the motion budget is one clock. That is the same rule
that kept ㉒ to a single scroll clock.

## The overlap problem — real, and the brand choice makes it HARDER

Two shipped sites sit close, and both were checked in the repo rather than from
memory:

| shipped site | vertical | axes | how E stays clear of it |
|---|---|---|---|
| `first-crack` | `food-coffee-roastery` | data-instrument + cinematic-imagery | **register**, see below |
| `fern-and-crumb` | `hospitality-cafe` | novel-typography + soft-organic | E is not a café |

**`first-crack` is the hard one, and the spec answered it correctly: the
differentiation cannot rest on the vertical, so it rests on the register.**
`first-crack` is an EXPERT page — an instrument, a roast curve, production, for
someone who wants to know *how*. Morningside is a PRODUCT page — one continuous
transformation, for someone who just wants the cup. Their axis pairs are fully
disjoint, which is the check that this is a real difference and not a claimed
one.

**`fern-and-crumb` independently settles the café-versus-brand question the
founder left open.** He offered either. The spec recommended "brand" on the
argument that the motion he specified is a *product transformation* and a café
page would want the room, the table and the people. Grounding that against the
repo adds a second, harder reason he could not have known: **the portfolio
already has a café**, and it already spends `soft-organic`. A café E would have
collided on vertical *and* shared a secondary axis with the site it collided
with. **Brand, decided, with the receipt.**

## The schematic test — and why this site deliberately FAILS it

Meta-prompt §schematic asks what the discipline itself produces, and every
expert page in this portfolio ships that artefact as its instrument. **Coffee
has an unusually good answer** — the roast curve, the brew-ratio table, the TDS
/ extraction-yield control chart — and Morningside ships **none of them.**

That is the point, and it is worth stating because it is the one place this site
breaks the house pattern on purpose:

1. **`first-crack` already built it.** Its signature IS the roast curve. A
   second coffee instrument would make the two sites rhyme in exactly the place
   they most need to differ.
2. **The spine is already spoken for.** The animation is the page. A data
   instrument would be a second thing competing for the same scroll clock, and
   the arc has now learned twice (㉑ s105, ㉒ s107) that the clock must drive one
   thing and the prose must agree with it.
3. **The register forbids it.** A page for someone who just wants the cup does
   not open with a control chart.

**Consequence, stated so the build cannot forget it: with no instrument, the
motion carries the entire page.** If the three beats are not beautiful the site
has nothing else to stand on. That is a higher floor than any other site in the
arc, and it is why the spec set E's *floor* budget above D's.

**The lay-twin rule does not apply** (§s60 ⑬: every expert instrument gets a lay
twin). There is no expert instrument, so there is nothing to translate.

## The motion — three beats, two segments, and the seam

| Beat | The frame | What the page says there |
|---|---|---|
| **1 · BEANS** | whole roasted beans, the hero | who the brand is · origin · the roast |
| **2 · GROUNDS** *(the dwell)* | the middle state | grind, freshness, the thing most people get wrong |
| **3 · THE POUR** | coffee going into the cup | the cup · where to buy it |

### Why this chains, when ㉒ deliberately did not

㉒ minted **two** endpoints and let ONE take supply everything between, on the
s107 corollary *"the cheapest registered edit is the one you never make"*. That
rule does **not** transfer here, and the meta-prompt says so by name:

> *"**Chain segments only where the intermediate state is a genuinely different
> SUBJECT** (site E's beans→grounds→pour, where the grounds are their own
> shot); where it is one subject in the middle of one motion, a single take is
> both cheaper and strictly safer."*

Whole beans and ground coffee are different subjects, not one subject partway
through a motion. A single beans→pour take would have to invent a credible
ground-coffee state in the middle and would not be trusted to. **So: two
segments.** The dwell on the grounds is the reason this is better than one call
rather than a compromise — it is a real pause the reader controls, and it is
exactly where the copy about grind wants to land.

### ⚠ The seam — improving on the spec, using a rule the spec predates

The spec describes minting the middle frame ONCE and using it as segment 1's
`end_image` *and* segment 2's `start_image`. That is sound, but s106 learned
something sharper after the spec was written:

> *"a generated transition is pulled by its END frame"* — and — *"chain segments
> **end-frame to start-frame** (upload the previous clip's last frame as the
> next one's `start_image`) so seams are exact by construction rather than by
> luck."*

Segment 1 will *interpolate toward* the minted middle frame; its actual last
frame is not guaranteed to equal it. So:

1. Mint the middle GROUNDS keyframe — it is still needed, as segment 1's
   `end_image` target.
2. Generate segment 1 (beans → grounds).
3. **Take segment 1's ACTUAL last frame** and use *that* as segment 2's
   `start_image`.

The seam is then exact by construction, and the middle state is still directed
rather than left to chance. This is the spec's intent with s106's method.

### Frame density — measured, never inherited

s109's corollary is explicit: **density is set by how much of the FRAME is
moving, not by whether the camera moves.** ㉑ ships 18, ㉒ ships 36, the
landing's locked-off water needed **81**. A pour is turbulent liquid; beans
tumbling are a granular cascade. **Both segments get an adjacent-frame
difference measurement against ㉒'s shipped bloom (1.26, the benchmark that
reads well) before a frame count is chosen.** Assume nothing from the house
number.

### Cyclic vs one-way — asked before reaching for two keyframes (s108)

Both segments are **one-way transformations** (beans become grounds; an empty
cup becomes a full one), so both correctly take a `start_image` + `end_image`
pair. This is *not* the landing's cyclic case — that was flowing water, whose
last frame looks like its first. Asked and answered, per the s108 rule.

## Mint briefs — drafted here, `get_cost` preflighted before any call

Casting per §casting: the OBJECT is the protagonist, nature is supporting cast,
people are subtle decoration. **The food corollary applies** (hands-only over
food reads unhygienic) — so if any human presence appears it is a candid pair
engaged with each other, cup nearby, faces present and never zoomed. The
default here is **no people at all**: this is a product transformation, and the
beans, the grind and the cup are the cast.

| # | asset | brief sketch | note |
|---|---|---|---|
| K1 | **beans keyframe** | whole roasted beans filling the frame, raking morning light, warm unbleached ground, shallow depth | the ANCHOR — everything derives from it |
| K2 | **grounds keyframe** | the same beans ground to a medium pour-over grind, same light, same surface, same camera | must be **registered** against K1 |
| K3 | **pour keyframe** | a single stream of coffee entering a pale ceramic cup, same light, same surface | segment 2's `end_image` |
| S1 | **segment 1** | beans → grounds, one continuous take | K1 → K2 |
| S2 | **segment 2** | grounds → pour, one continuous take | *(S1's last frame)* → K3 |

**Count-anchor and register the ANCHOR first** (s107): whatever is countable or
species-specific in K1 gets checked *before* K2 and the segments derive from it,
because one 3cr re-mint there replaces a re-mint of the whole sequence.
**Registration is MEASURED, not eyeballed** (s106) — greyscale mean-abs-diff
over a ±24px window on the K1↔K2 pair — and **two candidates are minted for the
registered edit**, since the technique is roughly a coin flip per seed.

**Record the model that RAN, not the one requested** (s109 — the vendor
substituted twice). **Expect `generate_video` to answer with a preset
recommendation and NO job**; re-send with `declined_preset_id` and confirm a job
id came back before waiting on it.

## The wink (budgeted, per §casting (6) — ⑳ lost its wink by not budgeting one)

Candidate: the page never once tells the reader the "right" grind. The
grind-and-freshness section states what changes and then declines to prescribe,
closing with the house admitting it re-grinds and re-tastes every batch and has
never settled the argument internally. To be drawn at build, but **budgeted
now**, which is the whole lesson.

## Structure (draft — the spine is the transformation)

1. **BEANS** — hero. The transformation's first state, the name, the one line.
2. **origin / the roast** — hangs off beat 1.
3. **GROUNDS — the dwell.** Grind, freshness, the thing most people get wrong.
4. **THE POUR** — the payoff.
5. **the cup / where to buy** — the exit.
6. `/guide` — mandatory, honest, and it must disclose the mint provenance, the
   seam method, and the frame counts.

## ⚠ THE MOTION IS ALREADY MINTED — read this before spending anything

**s110 minted and verified the whole three-beat spine.** The bytes are in
**`.context/mints/morningside/`** (gitignored, durable) with a full record in
`PROVENANCE.md` there: job ids, the model that RAN for each call, costs,
rejected candidates and the measurements. **Do not re-mint** — every re-mint
draws a new seed and the registration chain would have to be re-earned.

They are not in this directory yet because `tests/template-portfolio.test.ts`
requires an unbuilt site to hold **only** `PREPLAN.md`; they move into
`assets/` as part of the build, with the provenance record.

Spend: **57.24cr** (343.98 → 286.74), against E's ~120cr full tier.

Three findings that change what the build does:

1. **The site scrubs the VIDEO's frames, and beat 1's hero still is the take's
   own frame 0 — NOT `k1a.png`.** Measured, S1's first frame differs from the
   K1 anchor by MAD 7.36: Seedance recomposes slightly off the still it is
   given. The keyframes were directing instruments, not shipping assets. (Same
   as the landing: *"the still is frame 0 of the same take"*.)
2. **The seam was re-derived and that is why it is exact.** K3 was first edited
   off the *still*, which carried the still's wider framing and would have made
   the camera pull back across the whole second beat. Re-derived from S1's
   ACTUAL last frame (s106's end-frame-to-start-frame rule), it registers at
   **dx=0, dy=−2**. The superseded 2cr K3 is the cost of finding it.
3. **Frame density is far lower than the landing's — ship 41 per segment.**
   Adjacent-frame difference against ㉒'s 1.26 benchmark — S1: 121 native →
   0.47, 61 → 0.69, **41 → 0.82**, 31 → 0.79. S2: 121 → 0.51, 61 → 0.80,
   **41 → 1.00**, 31 → 1.12. **41 is the decision for both** (both under the
   benchmark), so the whole spine ships **82 frames** where the landing's
   turbulent water needed 81 for one segment. Measured, not inherited.
4. **THE SEAM NEEDS A TONE MATCH, and it is free.** Chaining end-frame to
   start-frame bought exact GEOMETRY (offset dx=0, dy=0) but not exact GRADE:
   S2 comes back ~5 RGB units darker with contrast unchanged. A per-channel
   mean/std match onto the seam frame takes it 6.87 → 4.53 at 0cr, and the
   residual is real content. **The assembly recipe carries that match** — do not
   re-mint to chase it, and do not cross-fade over it. Banked as a meta-prompt
   corollary.

And one copy constraint the picture imposes: **the grind renders finer than a
medium pour-over grind.** Beat 2's copy must not assert a brew method the frame
contradicts (the ㉑ hydrangea class of defect) — write it about grinding fresh
versus buying pre-ground, which is method-agnostic and true to the picture.

## Budget

Spec tiers: full ~120cr · lean ~85cr · **floor ~75cr — below which E has no
spine and should not be built at all.** Balance at pre-plan: **343.98cr**, so
full scope fits comfortably and D remains funded afterwards.

Every call is `get_cost`-preflighted. If segment retakes push past the full
tier, the degrade order is: drop retake margin → drop still count → **never**
drop a segment, because two segments *are* the page.

## Gates this site must pass before it is called done

- `tests/template-portfolio.test.ts` — structure, self-containment (no external
  hosts), asset manifest, `/guide` honesty.
- Three full two-lane iteration passes (`iteration-pass-checklist.md`), logged.
- The scrub gates the arc has paid for, each measured not eyeballed:
  **every frame reachable · exactly one lit at every scroll position · the whole
  sweep landing while the band is actually visible** (⑳ s108), and the phone
  payload door the landing added at s110 — a narrow screen must not download the
  whole sequence to animate a thumbnail.
- No AGPL, no external hosts, fonts vendored, paid-tier provenance pinned.
