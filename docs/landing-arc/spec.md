# Landing arc — three A+ sites, then Thalon's own landing page

> **Status: IN BUILD. Site A ⑳ Whitethorn BUILT s104 and APPROVED s105
> (`gogogo design is approved`). Site B ㉑ Aspect & Fall BUILT s105, awaiting
> his glance. Site C (botanical perfumery) and the Thalon landing page are
> UNSTARTED.** Founder-directed at the s103 close; order re-affirmed by him at
> the s104 close and settled. Spec of record for the A+ animation family and
> the Thalon landing page it feeds.
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
| **⑳ Whitethorn** (vet) | The **Day-84 handoff**. The gait instrument already ends by handing off to a photograph of the recovered dog — the emotional payoff of the whole page, and today it is a static image. It becomes the dog actually **moving soundly**: start frame the pinned Day-84 still, end frame the same dog mid-stride. | The page spends six chapters measuring a limp evening out. **The one thing it never shows is the dog walking.** The instrument proves it; the video lets you feel it. Nothing about the marker-and-trace plot changes — this is the payoff after it, not a replacement for it. |
| **㉑ Aspect & Fall** (garden) | **Three season transitions** — Feb→May→Jul→Oct — in one locked-off corner, scroll-scrubbed. | Proved already (job `139d81f8`). The keyframes exist, are pinned, and are registered to each other. |
| **Site C** (perfumery) | **The bloom**, bud → fully open, scroll-scrubbed — the arc's headline video, and the reason this vertical was chosen. | Bloom→scent is the whole pitch; it was always specced as the video slot. |

**⑳'s motion carries one honesty constraint the others do not:** it depicts a
clinical outcome. The Day-84 state must match what the instrument says — a
sound, even trot, not a bounding hero-dog — and the `/guide` must disclose it
as generated like every other asset. **A video that over-claims the recovery
would undo the exact honesty (the Day-12 dip) the page was praised for.**

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
| ㉑ Aspect & Fall — 3 season transitions @1080p | ~135cr | 45cr each; keyframes already pinned, no new mint risk |
| **Site C** — stills + the bloom centrepiece | ~100cr | 2 takes @1080p + ~10cr of stills |
| **⑳ Whitethorn** — the Day-84 handoff, moving | ~90cr | 2 takes; the honesty constraint above makes a retake likely |
| **Thalon landing — RING-FENCED** | **180cr** | reserved first, spent last, still intact |
| Reserve — retakes + variant coverage | ~46cr | spend down at the end, do not bank |

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

## Budget — 584.12 credits, and the shape of the spend

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
- the Thalon landing page's home *(planned — the repo already serves a landing
  at `/`; whether this replaces it or is built beside it is decided at build
  time, and the existing landing keeps its own register either way)*

## Done when

Three new portfolio sites exist, each carrying a working scroll instrument
rather than a still hero, each verdicted through the same loop every other site
went through; and Thalon has a landing page built by someone who had just built
those three. The credit is spent rather than forfeited, and nothing about the
stealth posture changed without him saying so.

## Open calls — his, and each is one line

1. ~~The expiry date.~~ **CLOSED — he set the order directly** (*"do the three
   sites first next session"*), which is all the date was ever needed for. A
   date would still help pace the spend; nothing waits on it.
2. **The two verticals I chose** — garden design for the seasons-tree,
   botanical perfumery for the bloom. His *"and etc."* delegated these; both
   are one word to overrule and cheap to change before a mint.
3. **Where the Thalon landing is served, and under what name.** Stealth is
   unchanged and this is his call — building it does not decide it.
