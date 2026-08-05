# Landing arc — three A+ sites, then Thalon's landing page, then two more on the remainder

> **Status: IN BUILD. All three A+ sites are now FULLY finished — built AND
> moving — which was the stated precondition for the capstone.** Site A ⑳
> Whitethorn BUILT s104, APPROVED s105 (`gogogo design is approved`), **its
> Day-84 motion added s108**. Site B ㉑ Aspect & Fall BUILT s105, moving s107,
> awaiting his glance. Site C ㉒ Small Hours BUILT and moving s107, awaiting his
> glance. **→ THE THALON LANDING PAGE IS UNBLOCKED**, with its 180cr ring-fence
> intact. Founder-directed at the s103 close; order re-affirmed by him at the
> s104 close and settled. Spec of record for the A+ animation family and the
> Thalon landing page it feeds.
>
> **Method note added by the build (s104–s105), because both sites hit it:** the
> banked animation ideas are named as *pictures of things* ("a dog that walks",
> "one tree through four seasons"), and both times the picture was the wrong
> instrument. The test that resolved both — *does the real discipline produce
> this drawing?* — belongs at the TOP of each remaining site's pre-plan, not
> after a build round. Site C's banked idea is a bloom VIDEO, which is a mint
> rather than a drawing, so it does not hit this trap; its equivalent question
> is what a perfumer's own document looks like.

## The ask, verbatim

> *"i want you to plan to do more landing pages. the A+ options, i want you to
> create a new site rather than make the current landing pages (for A+) A+, so
> that we have more options. so you can make it a bit different, like the A+
> dog walking animation idea can be a Vet landing page now and etc. So plan and
> spec for that, because I want you to then take in all that knowledge and make
> a landing page for thalon. because i want to use the higgsfield credit before
> it expires since i plan to not continue it. and yes, i think using claude
> design for the initial mock actually did help the landing page have a bit
> more clarity and structure."*

## What this changes, stated plainly

Three founder decisions land here, and two of them amend standing method.

1. **The A+ family becomes NEW SITES, not upgrades.** The animation-upgrade
   family was banked as three upgrades to sites that already exist —
   `proprietary/templates/sites/wagtail-and-co` (scroll-dog),
   `proprietary/templates/sites/orchard-house` (seasons-tree) and
   `proprietary/templates/sites/stem-and-vow` (bloom video). His call: **spend
   the idea on a new vertical instead**, so the portfolio gains options rather
   than polish. The three existing sites are untouched and keep their verdicts.
2. **claude-design is RESTORED for the initial mock.** The s62 loop A/B retired
   it to OPTIONAL, concluding *"quality = PRE-PLAN DIRECTION, not the mock
   tool"* (`proprietary/templates/meta-prompt.md` §How-to step 3). He now
   reports it *"actually did help the landing page have a bit more clarity and
   structure."* **This is an amendment, not a reversal:** the mandatory pre-plan
   stays exactly as it is, and the claude-design mock comes back in FRONT of it
   for landing-page work. Both, never either.
3. **Higgsfield is being SUNSET.** He plans not to continue the subscription,
   so the balance is a **use-it-or-lose-it asset**: `584.12` credits, Plus plan,
   verified s103 (unchanged since s79 — nothing has been spent in twenty-odd
   sessions). This makes [[own-visual-engine-directive]] materially more
   urgent, and it puts a clock on every mint in this arc.

## The ORDER — DECIDED by him, s103 close

> ***"do the three sites first next session"***

**The three A+ sites lead; the Thalon landing page is the capstone.** He set
this directly rather than by the expiry date, so **the expiry question is
CLOSED as a blocker** — it was only ever asked to decide this, and he decided
it. (A date is still useful for pacing the spend and remains a nice-to-know on
his board, but nothing waits on it.)

**The one protection that survives, and matters MORE now:** the Thalon landing
page's mint budget is **ring-fenced before the first A+ mint**. With the sites
going first, an over-running fix round on site B or C is exactly how the front
door ends up unfunded. Reserve it, then spend the sites out of what remains.

**Within the session:** the sites lead. The s104 phase-0 honesty fix (~1hr, a
defect s103 introduced) rides after them, and **control-arc part B is the item
that slips** if the session fills — it has no clock, and the credit does.

## THE VIDEO TURN — founder direction, s105 close (amends this spec)

His two messages at the s105 close, and both change the build.

> *"dont have to be stingy with the higgsfield credit"* · *"is that a top /
> birds eye view of a map, or will it be actual 3D trees … I feel like a top
> down view doesnt really display the full beauty and power of the animation
> transition and the capability of image generation"*

### 1. The technique is CONFIRMED, and proved on our own assets

His model of how a scroll transition is made is correct. **Seedance 2.0 takes
`start_image` AND `end_image`** and interpolates between them. Proved at the
s105 close on ㉑'s already-pinned February and May frames (job
`139d81f8`, 5s, 720p fast, silent, **17.50cr**): the camera stays locked to the
pixel — bench, rendered wall, drystone piers and paving are identical
throughout — while frost melts off the ground, the birch leafs out, hostas
emerge and the alliums rise and open. It is decisively better than the
cross-fade it would replace.

**One engineering refinement to carry into the build:** do NOT scrub the mp4 by
setting `video.currentTime` on scroll. Seeking an h264 file lands on keyframes,
so it janks. Extract the render to a **frame sequence** (the 5s/720p test is
121 frames, 2.9MB as mp4) and scrub that — canvas or swapped `<img>`. It is
deterministic, it decodes without seek cost, and it rides the existing pinning
chain (`pin-mint` → manifest → `export-template-assets`, which already emits
webp). The mp4 stays the pinned original; the frames are the derive.

### 2. Where video belongs, and where it does not

The division already on the books stands and is not in tension with his note:
**photographs carry the feeling, the diagram carries the evidence.** Video is
the *moving half of the photograph*, so it belongs wherever the payload is
feeling, material, light or growth. It cannot replace a code-drawn instrument
where the payload is information that must be TRUE and must RESPOND — a video
cannot recompute "5 of 13 in flower", or the pelvic hike at Day 12.

**But the s105 gap was real and is owned:** sites A and B spent 2.40cr and
13.00cr against a ~120cr budget line while the balance evaporates. The error
was not choosing instruments over video — that was right — it was **not doing
BOTH**. Every site in this arc should carry a generated moving moment.

### 3. ALL THREE SITES GET THE MOTION — founder direction, same close

> *"can you also apply that motion to the site A and site C too?"*

Not a video bolted onto each page: **each site's motion is the moment its own
story already turns on**, and in every case that moment is currently a still.

| Site | The generated moving moment | Why it is that moment |
|---|---|---|
| **⑳ Whitethorn** (vet) ✅ **BUILT s108** | The **Day-84 handoff**. The gait instrument already ends by handing off to a photograph of the recovered dog — the emotional payoff of the whole page, and today it is a static image. It becomes the dog actually **moving soundly**: start frame the pinned Day-84 still, ~~end frame the same dog mid-stride~~ — **NO end frame, see the correction below.** | The page spends six chapters measuring a limp evening out. **The one thing it never shows is the dog walking.** The instrument proves it; the video lets you feel it. Nothing about the marker-and-trace plot changes — this is the payoff after it, not a replacement for it. |
| **㉑ Aspect & Fall** (garden) | **Three season transitions** — Feb→May→Jul→Oct — in one locked-off corner, scroll-scrubbed. | Proved already (job `139d81f8`). The keyframes exist, are pinned, and are registered to each other. |
| **Site C** (perfumery) | **The bloom**, bud → fully open, scroll-scrubbed — the arc's headline video, and the reason this vertical was chosen. | Bloom→scent is the whole pitch; it was always specced as the video slot. |

**⑳'s motion carries one honesty constraint the others do not:** it depicts a
clinical outcome. The Day-84 state must match what the instrument says — a
sound, even trot, not a bounding hero-dog — and the `/guide` must disclose it
as generated like every other asset. **A video that over-claims the recovery
would undo the exact honesty (the Day-12 dip) the page was praised for.**
*(Held at build: the brief named the failure modes as explicit negatives and
landed a sound trot first take; `/guide` discloses both the generation and the
constraint. The pinned still turned out to already BE a trot — its alt text
saying "running at full stretch" was the only thing over-claiming, and it was
corrected.)*

> **⚠ CORRECTION (s108) — this table specified a keyframe pair for a motion
> that has no second keyframe.** ⑳ was scheduled as `start_image` = the pinned
> Day-84 still, `end_image` = "the same dog mid-stride". But ㉑'s seasons and
> ㉒'s bloom are **one-way transformations** — Feb genuinely differs from Oct, a
> bud from an open flower — where an end frame is a real, different picture. A
> **trot is a cycle**: its last frame looks like its first. That `end_image`
> would have been a near-duplicate of the start frame, bought at s106's
> registration coin-flip (~50% of seeds drift out of register).
>
> **Built instead as a single `start_image` with no `end_image`** — zero
> registration risk by construction, one already-approved asset, one take,
> **17.50cr against this spec's ~72cr line**. This extends s107's "the cheapest
> registered edit is the one you never make" one step: where the motion is
> cyclic, there is no second endpoint to mint *at all*.
>
> **This matters for site E, which is still unbuilt.** E's beans→grounds→pour is
> correctly two chained segments — those ARE three genuinely different subjects,
> so the chaining rule stands. But **the pour itself is cyclic**, and D's
> veraison is a one-way transformation. Ask which kind each motion is before
> reaching for a keyframe pair. Banked in
> `proprietary/templates/meta-prompt.md`.

### 4. ㉑ Aspect & Fall — REBALANCE the stage (his critique, accepted)

He is right that a top-down plan does not show what the factory can do, and the
current stage ranks it first: the code-drawn plan takes ~55% of the sheet and
the photographic band ~24%. **That ranking inverts.**

*(Noted for accuracy, because his question assumed otherwise: `orchard-house`
is not 3D trees either — its `motionBudget` is "four same-composition painterly
backdrops **cross-fade**". Neither existing seasons page has ever shown
generated MOTION. This is the gap in both.)*

**The direction (final composition decided at build, via the claude-design mock
per standing method):** the photograph leads the stage at full width and real
size, running a **generated, scroll-scrubbed seasonal transition** through
Feb → May → Jul → Oct in one locked-off place. The planting plan becomes the
reading instrument beside or inset over it — smaller, still exact, still
driving the readouts and the interest calendar. **Both, correctly ranked:** the
generated half sells, the drawing proves. Nothing about the schematic test is
walked back — it is what made the page credible as a landscape practice, and
the founder endorsed it in the same session.

**The keyframes already exist, are pinned, and are registered to each other**,
so this is three transitions off assets we own, not a re-shoot.

### 5. Budget — the sunset means the balance is SPENT, not saved

Balance **551.22** at the s105 close. Allocation:

| Line | Allocation | Note |
|---|---|---|
**Segment cost, measured s105:** a **4-second 1080p silent segment is 36cr**
(5s is 45cr). Four seconds is ample for a scrubbed transition — the visitor
drives the timeline, nothing plays — so **4s @1080p @36cr is the default unit**,
and it has the useful property of sitting UNDER the ≥40cr ping threshold.

| Line | Allocation | Note |
|---|---|---|
| ㉑ Aspect & Fall — 3 season transitions | ~108cr | 3 × 36cr; keyframes already pinned, no new mint risk |
| **Site C** — stills + the bloom centrepiece | ~82cr | 2 takes × 36 + ~10cr of stills |
| **⑳ Whitethorn** — the Day-84 handoff, moving | ~72cr | 2 takes; the honesty constraint makes a retake likely |
| **Thalon landing — RING-FENCED** | **180cr** | reserved first, spent last, still intact |
| **→ leftover for sites D + E** | **~109cr** | see §7; this is the spend-down target |

**The ≥40cr-per-mint ping rule, as read by the lead:** his *"dont have to be
stingy"* raises the ceiling rather than deleting the rule. 1080p video is 45cr
and crosses it, so the lead will **name every ≥40cr mint in the session
summary** rather than stopping the build to ask for each one. One word reverses
this back to per-mint approval.

### 6. ORDER — re-affirmed by him, unchanged, and now with "fully" defined

> *"you build it after fully building site A, B and C first … so that way, you
> have the full landing page to learn from rather than just mock. plus it gets
> things out faster too."*

**Sites A, B and C are all FULLY finished before the Thalon landing starts** —
and after this amendment "fully" includes each site's generated moving moment,
not just its stills. The landing page then inherits a **proven scroll-scrub
component and three finished pages to learn from**, which is exactly his stated
reason for the order.

**Build the scrub machinery ONCE, on ㉑**, where the keyframes already exist and
carry no new mint risk; site C's bloom then reuses it rather than inventing it
under video cost. That is the fastest path to his "gets things out faster", not
a detour from it.


## The three A+ sites

Each takes a banked animation idea and moves it one vertical sideways — near
enough that the instrument still makes sense, far enough to be a genuinely new
option. His example sets the pattern; the other two are my recommendation under
*"and etc."* and each is a one-word overrule.

| # | The banked idea | Its current home | **The new vertical** | Why it carries |
|---|---|---|---|---|
| A ✅ | **scroll-dog** — a dog that walks as you scroll | wagtail-and-co (dog walking) | **Veterinary practice** (his call) — BUILT ⑳ `whitethorn`, APPROVED s105 | The same walk cycle, but the scroll now carries a *care* story rather than a service list — and a vet is a higher-trust, higher-value vertical than a walker, so the archetype shifts older/calmer per meta-prompt §casting (7) |
| B ✅ | **seasons-tree** — one tree through four seasons on scroll | orchard-house (orchard) | **Garden & landscape design studio** — BUILT ㉑ `aspect-and-fall` s105, awaiting verdict | The instrument *is* the pitch: a garden designer sells what a space becomes over a year, which is precisely what the scrubbed tree shows. Orchard sold fruit; this sells time |
| C | **bloom video** — scroll-scrubbed bloom transition (Seedance, ~17.5cr) | stem-and-vow (florist) | **Botanical perfumery** — NEXT | Bloom → scent is the oldest move in fragrance, and it rescues the idea from being "a florist again." Also the strongest case for the exceptional-palette axis, which the wave-4 anchors already wanted |

**Naming, casting and the house style are NOT re-derived here** — they come
from `proprietary/templates/meta-prompt.md` and the standing doctrines already
ratcheted into it (§casting archetypes-per-vertical, nature-vs-dread,
printable-surface, reference-guided minting). Read it before the first mint;
that is the standing rule and this arc does not get an exception.

## Method, per site — the loop as amended

1. **claude-design initial mock** *(restored, decision 2)*. Structure and
   clarity first, before any prose or asset thinking.
2. **PREPLAN.md**, mandatory and unchanged — the artifact class introduced at
   s62 and the reason quality moved. Precedent to copy:
   `proprietary/templates/sites/ridge-and-valley/PREPLAN.md`.
3. **Code-direct build** into `proprietary/templates/sites/<slug>/` *(new per
   site)*, matching the anatomy every existing site already has: `index.html`,
   `site.json`, `assets/`, `fonts/`, `guide/`, `PREPLAN.md`.
4. **Mint against the plan**, reference-guided (standing doctrine s64): a
   reference must ALREADY look like the target, never watermarked, fed as
   generation input. `get_cost` preflight, and **any single mint ≥40cr pings
   him first** — standing rule, unchanged by the sunset.
5. **The animation is the point.** Each of these three sites exists for its
   instrument; a site that lands with a beautiful hero and a dead scroll has
   missed the assignment.
6. **`/guide` honesty page**, enforced — fictional business and AI-generated
   imagery both disclosed. Ratchet: `tests/template-portfolio.test.ts`.
7. **Fix round.** Every site in the portfolio's history has had one. Budget for
   it up front rather than discovering it at zero credits.

## SITES D AND E — founder direction, s105 close. **AFTER the Thalon landing, on leftover credit**

> *"can you add a motion version of Orchard house, but can call it site D or
> something, maybe a vineyard/winery? and also a site E for a cafe, maybe the
> motion can be coffee beans transitioing to coffee pouring into a cup … but
> actually, do site D and E after thalon with any left over credit."*

**These are the SPEND-DOWN TARGET, and that is an upgrade to the disposal
rule.** The sunset means unspent credit evaporates, and §5 previously pointed
the remainder at "variant coverage for the Thalon landing". Two more portfolio
sites are plainly worth more than alternate crops of one — and it matches his
original reason for this whole arc: *"so that we have more options."*

**Sequencing is his and is explicit: the Thalon landing is finished FIRST.**
D and E are conditional on what actually remains, and **scope scales to the
balance rather than the plan slipping.** Honest arithmetic below.

### The three-keyframe question — his model needs one correction

He described the café motion as **three** states: beans → ground coffee → pour.
**No seat on the roster accepts three ordered keyframes** — `seedance_2_0`,
`flux_3_video` and `minimax_h3` all expose `start_image` + `end_image` only
(verified s105). So a three-state sequence is **two chained transitions**:
beans→grounds, then grounds→pour, with the middle frame minted once and used as
*both* the end of the first and the start of the second so the join is seamless.

**This is better than a single call, not a compromise:** two segments give the
scroll two scrub ranges and a real **dwell point** on the ground coffee, which
is exactly where the copy about grind and freshness wants to land. The same
chaining is what ㉑'s Feb→May→Jul→Oct already needs.

### Site D — vineyard / winery

| | |
|---|---|
| **Banked idea** | `seasons-tree` again, but as **generated motion** rather than the cross-fade `orchard-house` actually ships |
| **The motion** | **VERAISON** — the moment the grapes turn from green to purple. One chained sequence through the vine's year, with veraison as the hero beat |
| **Axis pair** | ~~`otherworldly-animation` + `exceptional-palette`~~ — **REASSIGNED TO SITE C at s107, see the correction below. D's secondary is a re-draw at D's own pre-plan.** |
| **Name candidates** | **Veraison** (the term IS the motion, and it earns its own section the way *Whitethorn* and *Aspect & Fall* do — but it is a common industry word and may collide, so check) · *Southfacing* · *Marl & Cane* |
| **Overlap to beat** | `orchard-house` (seasons, fruit) — differentiate on register: a winery sells a **vintage**, i.e. one specific year that will never repeat, where the orchard sells a repeating cycle |
| **Schematic test** | What the discipline itself produces: **Brix / sugar-ripeness readings and a harvest window.** Available as the instrument — but keep it LIGHTER than ㉑'s, because on this site the motion is the hero and a second full data-instrument would repeat site B |

> **⚠ CORRECTION (s107) — this spec assigned one axis to two sites.** The s103
> site table gives **exceptional-palette to site C** (*"the strongest case for
> the exceptional-palette axis"*); the s105 block above then gave the same
> secondary to **D**, asserting the pair was portfolio-new "(verified)" —
> verified against the shipped `site.json` files, but not against C's prior
> claim four hundred lines earlier in this same document. That is an internal
> contradiction in the spec, not a fact about the portfolio.
>
> **C takes it**, decided at C's pre-plan and recorded here rather than left to
> be re-discovered: C claimed it first and in the founder-facing table; C was
> built at s107 while D is conditional on credit remaining *after* the Thalon
> landing; and this spec's own arithmetic says **"if only one fits, build E"**,
> which makes D the site most likely never to exist. Shipped as
> `small-hours` — and the axis is load-bearing there rather than decorative,
> because each tracked compound owns a colour and the page's colour world *is*
> the instrument's output.
>
> **D's secondary is therefore an open draw**, to be made at D's own pre-plan.
> `otherworldly+physics-interaction` and `otherworldly+brutalist-raw` are both
> still portfolio-new, and a concrete cellar is a real winery register — but
> that is D's call to make with the portfolio in front of it, not this spec's to
> pre-empt a second time.
>
> The general lesson, which is rule 12's inherited-plan trap inside a spec:
> **an axis table is ground truth and has to be checked against the whole
> document, not just against the repo.**

### Site E — a coffee brand (or a café). **THE ANIMATION IS THE PAGE.**

> *"Site E is a cafe. or a coffee brand like campos coffee if it makes things
> easier. the coffee animation takes center stage."*

**That last sentence is the architecture, not a preference**, and it makes E
structurally different from every other site in the arc. Elsewhere the motion is
a chapter *inside* the page. Here **the transformation IS the scroll spine, top
to bottom**, and every other element hangs off its three beats:

| Beat | The frame | What the page says there |
|---|---|---|
| **1 · BEANS** | whole roasted beans, the hero | who the brand is · origin · the roast |
| **2 · GROUNDS** *(the dwell)* | the middle frame — minted ONCE and reused as the end of segment 1 and the start of segment 2 | grind, freshness, the thing most people get wrong |
| **3 · THE POUR** | coffee going into the cup, the payoff | the cup itself · where to buy it / where to sit |

**The dwell on the grounds is the reason two chained segments beat one call.**
It is a real pause the reader controls, and it is exactly where the copy about
grind wants to land.

| | |
|---|---|
| **Vertical — LEAD RECOMMENDATION, one word to overrule** | **a coffee brand**, not a café. He offered either. The motion he specified is a **product transformation**, and the business whose front door that story actually serves is the one selling the bean — a café page would want the room, the table and the people, which is a different story than the one the animation tells. A brand page can still carry its cafés as a section; a café page cannot make bean→grind→pour its spine without it feeling borrowed |
| **Axis pair** | `otherworldly-animation` + `soft-organic` — **portfolio-new** (verified). Soft-organic deliberately *supports* rather than competes: physics-interaction would have been a lovely fit for a granular material like beans, but **a second motion system would fight the spine**, and the motion budget is one clock |
| **Name candidates** | decided at pre-plan per method; *Slow Pour* · *Bell & Bird* · *Morningside* |
| **Overlap to beat — REAL, and the brand choice makes it HARDER, so it is answered here** | `first-crack` is already a coffee **roastery** (data-instrument + cinematic; its signature is the roast curve). Choosing "brand" over "café" moves E *closer* to it, so the differentiation cannot rest on the vertical — **it rests on the register.** first-crack is an EXPERT page: an instrument, a curve, production, for someone who wants to know *how*. E is a PRODUCT page: one continuous transformation, no instrument at all, for someone who just wants the cup. **E deliberately has no data-instrument** — that is what keeps the two apart, and it is why the motion has to carry the whole page |
| **Why the motion is a good portfolio addition** | it is a **material transformation**, not a time-lapse. Every other motion in this arc is time passing (a recovery, a year, a bloom, a vintage). Matter changing state is a genuinely new motion grammar, and it is the only site whose animation is the spine rather than a chapter |

### Honest arithmetic — both may not fit, and that is the correct outcome

Leftover after the four committed lines is **~109cr**, and that assumes takes
land. Scope tiers, so the plan degrades instead of breaking:

**⚠ E's floor is HIGHER than D's, and the s105 tier table was wrong about it.**
Once the animation is the spine, **the two chained segments are not a feature
that can be cut — they are the page.** So E cannot degrade to a one-segment
minimum the way D can.

| | Site D (vineyard) | Site E (coffee) |
|---|---|---|
| **Full** | ~110cr — 3 segments + stills | ~120cr — 2 segments at several takes + stills + a hero |
| **Lean** | ~60cr — 2 segments + stills + light instrument | ~85cr — 2 segments, one retake allowed, ~6 stills |
| **Floor** | **~40cr** — one segment (veraison, the beat that matters) + ~1cr stills | **~75cr** — 2 segments, no retake margin, minimum stills. **Below this E has no spine and should not be built at all** |

**If only one fits, build E** — D's seasons motion repeats a beat ㉑ will already
have shipped, whereas E's bean→grind→pour is a grammar the portfolio does not
own, and it is the only site in the arc whose animation *is* the page. With
~109cr projected, **E alone fits comfortably; both fit only if the earlier sites
land close to first take.** **If the earlier sites overrun, D and E do not
happen at all** — the Thalon landing is the priority and its ring-fence is never
raided to fund a portfolio site.

**Two lean sites beat one full site here**, on his own stated rationale for the
arc: options, not polish.


## Then: the Thalon landing page

The capstone, and the reason the other three come first.

**It is not a portfolio site and must not be built as one.** The portfolio
sites sell fictional businesses to imagined customers; this one sells Thalon,
to people who will actually land on it. Two constraints the portfolio does not
carry:

- **Stealth is still live and still his call.** `thalon.org` is unwired
  deliberately (CT-log exposure), and the hostname posture has not changed.
  Building the page does not publish it — **landing where it is served, and
  under what name, is a separate founder decision** and this spec does not
  presume it.
- **It must be honest about what Thalon does today**, which is the same rule
  every surface in this repo carries. No claimed capability that the engine
  does not have.

**What it inherits from the three sites:** the strongest instrument of the
three becomes the landing page's scroll spine. Which one that is cannot be
decided here — it is decided by building them, which is exactly the founder's
stated reason for this order.

**Budget: ring-fenced.** The landing page's mint allowance is reserved before
the first A+ mint, so a fix round on site B can never eat the front door.

## Budget — SUPERSEDED by §5 of THE VIDEO TURN (s105)

> **The table below is the s103 original and is kept for the record only.** It
> predates the video turn, the measured 36cr/4s segment price, and sites D+E.
> **The live allocation is §5 above**, against the s105 balance of 551.22.

## ~~Budget — 584.12 credits, and the shape of the spend~~ *(historical)*

Estimates, not commitments; `get_cost` preflight governs every actual mint.

| Line | Estimate | Note |
|---|---|---|
| Site A (vet) — stills + scroll instrument | ~60cr → **ACTUAL 2.40cr** | stills historically ~0.72cr first-take; the instrument is the cost |
| Site B (garden design) — stills + seasons scrub | ~60cr → **ACTUAL 13.00cr** | the four-season twin sequence is where the takes went |
| Site C (perfumery) — stills + **bloom video** | ~90cr | the Seedance video (~17.5cr) plus variants; the most expensive of the three |
| Fix rounds ×3 | ~90cr | every site has had one; budgeting it is not pessimism |
| **Thalon landing — RING-FENCED** | **~180cr** | reserved first, spent last |
| Unallocated reserve | ~100cr | the sunset means unspent credit is lost, so the reserve is a floor to spend down, not to protect |

**The sunset changes the disposal rule:** normally unspent credit is saved.
Here it evaporates, so any reserve left when the arc completes should be spent
on **variant coverage for the Thalon landing** (aspect recuts, alternate heroes)
rather than banked.

## Ground truth — exact dependencies

Existing, cited verbatim:

- `proprietary/templates/meta-prompt.md` — the factory prompt, casting
  doctrines, mint rules, §How-to step 3 (the claude-design line this amends)
- `proprietary/templates/sites/wagtail-and-co` · `.../orchard-house` ·
  `.../stem-and-vow` — the three A+ ideas' current homes, **untouched by this arc**
- `proprietary/templates/sites/ridge-and-valley/PREPLAN.md` — the PREPLAN precedent
- `tests/template-portfolio.test.ts` — the portfolio ratchets (structural
  completeness, self-containment/no external hosts, asset manifest, `/guide` honesty)
- `docs/proposals/2026-07-11-visual-uplift-and-template-portfolio.md` — the arc's original proposal

Planned by this spec:

- `proprietary/templates/sites/<vet-slug>/` *(new)*
- `proprietary/templates/sites/<garden-slug>/` *(new)*
- `proprietary/templates/sites/<perfumery-slug>/` *(new)*
- `proprietary/templates/sites/<vineyard-slug>/` *(new — site D, conditional on
  leftover credit after the Thalon landing)*
- `proprietary/templates/sites/<cafe-slug>/` *(new — site E, same condition)*
- the Thalon landing page's home *(planned — the repo already serves a landing
  at `/`; whether this replaces it or is built beside it is decided at build
  time, and the existing landing keeps its own register either way)*

## Done when

Three new portfolio sites exist, each carrying a working scroll instrument
rather than a still hero **and each carrying a generated moving moment**, each
verdicted through the same loop every other site went through; and Thalon has a
landing page built by someone who had just built those three, inheriting a
proven scroll-scrub component rather than a mock.

**Then, on whatever credit remains and only after the landing is finished:**
sites D (vineyard) and E (café), at whatever scope the remainder funds — full,
lean or a single motion sequence. **The credit is spent rather than forfeited**
(the sunset makes that the whole point), the Thalon landing's ring-fence is
never raided to pay for a portfolio site, and nothing about the stealth posture
changed without him saying so.

## Open calls — his, and each is one line

1. ~~The expiry date.~~ **CLOSED — he set the order directly** (*"do the three
   sites first next session"*), which is all the date was ever needed for. A
   date would still help pace the spend; nothing waits on it.
2. **The two verticals I chose** — garden design for the seasons-tree,
   botanical perfumery for the bloom. His *"and etc."* delegated these; both
   are one word to overrule and cheap to change before a mint.
3. **Where the Thalon landing is served, and under what name.** Stealth is
   unchanged and this is his call — building it does not decide it.
4. **Site D's name** — *Veraison* is the strongest candidate because the word
   IS the motion, but it is a common industry term and may collide; alternatives
   are *Southfacing* and *Marl & Cane*. Decided at pre-plan, one word to overrule.
5. **Whether site E is too close to `first-crack`.** The lead's read: no, because
   first-crack sells the ROAST (production, instrument-led) and E sells the CUP
   and the room (a social purchase, humans in frame). Flagged rather than assumed.
