# Thalon's landing page — pre-plan

> The capstone of `docs/landing-arc/spec.md`, built at s109 after ⑳ Whitethorn,
> ㉑ Aspect & Fall and ㉒ Small Hours were all finished **and moving**, which was
> the founder's stated precondition: *"so that way, you have the full landing
> page to learn from rather than just mock."*
>
> **This is not a portfolio site and is not built as one.** The portfolio sells
> fictional businesses to imagined customers. This sells Thalon, to people who
> will actually land on it, so every claim on it has to be true today.

## Where it lives, and what that decides

**It rebuilds the real landing at `apps/web/src/app/page.tsx`.** The arc spec
left this open (*"whether this replaces it or is built beside it is decided at
build time"*). Building it beside the real one would leave two front doors and
a dead one, which is the defect class this repo hunts; and a landing page that
is not the landing page has not been built.

**Stealth is untouched and is not decided here.** `thalon.org` stays unwired,
staging keeps its neutral hostname and edge auth. Building the page does not
publish it; where it is served and under what name remains his call.

### What must survive the rebuild — the load-bearing seams

These are inherited, not re-invented. Each already exists and each is checked:

- `apps/web/src/lib/landing/copy.ts` — **the single source of truth.** The page,
  the `FAQPage`/`Organization` JSON-LD and `apps/web/src/app/llms.txt/route.ts`
  all render from this one module, so a claim cannot drift between them. The
  rebuild EXTENDS it; it never forks it.
- `apps/web/src/app/api/waitlist/route.ts` + `components/landing/waitlist-form.tsx`
  — the only live conversion door on the page.
- `components/landing/json-ld.tsx`, `site-header.tsx`, `site-footer.tsx` — kept.
- The honest-claims pin in `components/landing/__tests__/landing-page.test.tsx`
  (*optimization is claimable, rankings never* — ADR 0006 §5).
- `apps/web/src/lib/__tests__/mono-ratchet.test.ts` pins `app/page.tsx` at **5**
  and ratchets DOWN only — **a count below the pin fails too**, so the rebuild
  lowers the pin in the SAME change. The ratchet's own comment anticipates this
  moment by name: *"Landing files … burn down at wave 4, the landing's own
  register decision."*
- `bridge-burndown.test.ts` explicitly exempts landing files (*"the landing
  keeps its own register"*), so it constrains nothing here.

## Draw

| | |
|---|---|
| **Primary axis** | **`data-instrument`** |
| **Secondary axis** | **`novel-typography`** |
| **Pair check** | portfolio-new in BOTH orders (checked against all 23 `site.json` files: `data-instrument` appears with cinematic-imagery, exceptional-palette, brutalist-raw, editorial-print, soft-organic and otherworldly-animation — never with novel-typography) |

**Why animation is NOT the primary here, unlike all three A+ sites.** Those
three were commissioned as an *animation family* (the s104 draw-rule amendment)
— each exists for its instrument's motion. This page exists for its
**evidence**. Motion is present and load-bearing, but it serves the instrument
and the hero rather than being the signature. Recording the draw is discipline,
not a claim that this page joins the portfolio.

## Look-first taste notes (motionsites.ai, swept live s109)

1. **The AI-landing default is a single page drawn a hundred times, and
   Thalon's CURRENT landing is already wearing it.** motionsites.ai's own site
   is the archetype: near-black ground, a headline whose last word glows in a
   gradient (*"UNLOCK YOUR AI DESIGN **SUPERPOWERS**"*), a gradient CTA pill.
   Today's `page.tsx` is `dark`-scoped, cinematic, with a glowing hero moment.
   **Refused by name.** The register flips to light.
2. **The gallery's strongest entries are the LIGHT ones** — *Arctic Lab* (near
   white, thin condensed display type over an ice photograph), *OYLA*
   (**MEASURED PURITY** set huge over a photographic hand), *TrustFlow* (light,
   serif, architectural). The dark entries are competent and interchangeable.
3. **The principle worth stealing (never the pixels): display type that
   INTERLOCKS with the photographic subject** — depth from layering rather than
   parallax trickery. Same note Whitethorn banked at s104, independently
   re-observed. It is the secondary axis, used once, in the hero.
4. **Nothing in the sweep showed evidence.** Every AI page asserts capability;
   not one showed an artefact of its own product working, let alone failing.
   That gap is this page's whole concept.
5. **The em-dash tell.** The `impeccable` hook flagged em-dash density in the
   mock's body copy as an AI cadence tell — a real catch on a page whose entire
   argument is that its output is not slop. Held as a copy constraint.

## The concept — THE PAGE IS THE PRODUCT'S OWN RECEIPTS

Every competitor's landing page asserts that its AI is good. Thalon's asserts
something checkable and much stranger: **that it stops things.** The gate is
the product; a gate you cannot see is a gate you cannot trust.

So the page's spine is **one real recorded run, walked gate by gate**, and the
instrument is a **draft ledger that fills as you scroll**. The reader watches
drafts get written, screened, grounded, and — for four of the eight shown —
**stopped, with the real reason printed beside them.**

**One clock, and it follows the PROSE (㉑ s105).** Six chapters carry the run's
stages as data attributes; the ledger's state, the gate bar, the three counters
and the stage name all read off the chapter the reader is actually on. Nothing
interpolates off the scrollbar.

**Photographs carry the feeling, the instrument carries the evidence** (the
division of labour proved across all three A+ sites). The hero is minted and
moves; the ledger is code-drawn, 0cr, and responds to the visitor.

### The honesty constraint, which is stricter here than anywhere in the portfolio

Whitethorn's gait data may be invented because Whitethorn is invented. **Thalon
is real, so its instrument runs on real recorded data or it does not ship.**

Every number and every blocked sentence on this page was read out of this
workspace's own dev Postgres at build time (`self` tenant, the only tenant):

| Fact | Value | How it was measured |
|---|---|---|
| drafts | **21** | `select count(*) from drafts` |
| judge runs | **128** | `select count(*) from judge_results` |
| body versions judged | **28** | `count(distinct body_hash)` |
| drafts stopped ≥once at the final gate | **10** | `count(distinct draft_id) … gate='g3_final' and verdict='fail'` |
| currently blocked / approved / queued / rejected | **8 / 7 / 4 / 2** | `group by status` |
| posts ever sent unreviewed | **0** | the sequence gate; the queue's master key is empty |

**A trap caught before it shipped.** The raw gate tally reads `g3_final: 20
pass / 20 fail`, which invites the headline *"half of everything is blocked."*
That would be **false**: those are 128 judge RUNS over 21 drafts and 28 body
versions, not 40 drafts. The honest per-draft figure is **10 of 21 stopped at
least once**. This is §casting (3) — check the countable claim — applied to the
page's own instrument rather than to a minted image, and it is exactly the s79
D3 lesson: **state the bound, do not chase the number.** The ledger's caption
says `8 of 21 shown` for the same reason.

**Two things deliberately NOT on the page.** The dev DB also holds real outreach
drafts naming a real prospect and a real first name. Real third-party lead data
never reaches a public surface, whatever its provenance. And the pinned data is
a **committed snapshot**, not a live read: the landing tree touches no dynamic
API today and keeps that property, and a public page must never issue a live
query against tenant drafts.

## The mock's findings (why the claude-design stage earned its place again)

The mock was authored, rendered at 1440×900 and **driven** — scrolled chapter by
chapter with the states counted at each stop, per the s107/s108 lesson. Four
findings, and only the first two were visible by looking:

1. **THE INSTRUMENT PRINTED THE ANSWER BEFORE THE CHAPTERS ASKED THE QUESTION.**
   v1 shipped all eight rows with their verdicts already set, so `blocked ·
   ungrounded` was legible at chapter 02 — two chapters before the reader meets
   the judge. **The page's entire dramatic payload was spent in its first
   second.** This is the spine-level find, and the fix became the build's
   architecture: *the fill IS the instrument*. A row is invisible until the
   fan-out writes it, present-but-undecided until its gate runs, and only then
   shows its fate. It is the same shape as Whitethorn's dog getting better as
   you scroll — the argument is demonstrated, never pre-printed.
2. **The stage was under-filled on both sides** — a 487px ledger and three lines
   of prose inside a 900px viewport. Column ratio moved to 1.25/0.75 and the
   ledger grew to eight rows.
3. **The readouts contradicted the rows** — `Drafts 21` and `Stopped 10` sat
   above a visible list of 7 containing 3 blocked. Fixed by making the counters
   count *what has happened so far in this run* and captioning the window.
4. **FOUND ONLY BY COUNTING: the naive chapter rule reproduced the s107 clock
   lag.** Scrolling each chapter's heading to the reading line and asserting
   `.chap.on === that chapter` returned **true for chapter 0 and false for all
   five others** — the stage name read one gate behind the prose the whole way
   down. Cause: `if (centre <= line) seg = i` marks *the last centre passed*,
   and a heading exactly on the line misses by a sub-pixel. Small Hours already
   carries the fix and the warning (*"the NEAREST anchor, not merely the last
   one whose centre we passed"*); the mock was written the naive way and the
   count caught it. Re-measured after the fix: **6/6 chapters correct.**
   *Nothing looked wrong in either screenshot.*

## Chapters (the six stages of one real run)

| # | Stage | The ledger's state | The claim |
|---|---|---|---|
| 01 | **The prompt** | empty | one line in, plus the sources a claim may rest on and the words that are never allowed |
| 02 | **The fan-out** | 8 rows arrive, undecided | one idea written natively per destination, not pasted six times |
| 03 | **g1 · the screen** | denylist runs; 2 decided | the deterministic check runs before any judgement about truth |
| 04 | **g3 · the grounding** | 6 decided, **4 blocked with real reasons** | every claim traced to a source the operator gave it — *this is where most things die, and it should be* |
| 05 | **The queue** | 8 decided, survivors carry their history | what is left arrives with its whole gate record attached |
| 06 | **The click** | unchanged | nothing leaves without it; corrections become eval rows |

**The wink (§casting 6), and it must not be cute here.** The page's one
deliberate imperfection is that **it shows its own worst number**: chapter 04's
heading says most drafts die at the grounding gate, and the ledger proves it
while the reader watches. A landing page volunteering its own failure rate is
the register's equivalent of Whitethorn's Day-12 dip — the honesty that made
that page credible.

## Mint plan — RING-FENCED 180cr, and the motion is CYCLIC

**One hero slot with motion, plus stills only if the page earns them.**

The hero's job is feeling, and Thalon is a precision/B2B vertical, so §casting
(8)+(9) apply hard: **nature at the subject's own geometry, light and air, no
staff photography, humans absent.** The subject must mirror what the product
does rather than illustrate software.

**The image: a low stone sill in a river at first light** — still dark water
held above it, bright water spilling over and moving on. That is literally the
product's argument (what is held, and what passes) in a natural object, and it
answers the "cooped-up indoors" association the category carries.

⚠ **Deliberately NOT a gate.** The s104 Whitethorn corollary: a prompted *gate*
renders as a mullioned lattice and reads as BARS — any barrier object carries
the cage risk. Water over stone is an opening, not a leaf across one.

**⚠ THE MOTION IS CYCLIC, so it takes ONE `start_image` and NO `end_image`** —
the s108 corollary, applied at the first opportunity since it was written.
Flowing water is a cycle, not a transformation: the last frame looks like the
first. A keyframe pair here would buy a near-duplicate end frame at s106's ~50%
registration coin-flip, for nothing.

| Slot | Model seat | Est. | Note |
|---|---|---|---|
| Hero still (the sill at first light) | best image seat, checked per mint | ~1–3cr | anchor; count-anchor and check it BEFORE anything derives from it (s107) |
| Hero motion (water over the sill) | seedance 2.0, 5s/720p/fast/silent | **17.50cr** | single `start_image`, no `end_image`; measured price s108 |
| Frame density | — | 0cr | the take is **locked-off**, so ㉒'s 36 is the right neighbourhood — but MEASURE adjacent-frame difference against the shipped bloom before choosing (s108: a tracking take needed 61) |
| Contingency / one retake | | ~20cr | budget it rather than discover it |

**Projected: well under 45cr against the 180cr ring-fence.** Under the standing
rule every mint ≥40cr is named in the session summary; nothing here crosses it.

## Type & palette

**Palette — the one-colour rule, borrowed in principle from ㉒ Small Hours.**
There, a swatch always means a molecule. Here: **a colour always means a gate
verdict, never a decoration.** Ground is warm paper; ink is a near-black that
leans blue and is never pure. The only saturated values on the page are
`pass`, `blocked` and `waiting`. Nothing decorative is ever coloured — which
also means the page cannot acquire a gradient CTA without breaking its own rule.

**Type.** Display serif for the hero and chapter headings (the secondary axis,
used once, interlocking with the hero photograph); the app's existing
`Geist_Mono` for instrument apparatus only — readouts, gate names, verdicts.
Mono is a DATA label here and never section scaffolding, which is the mono
ratchet's actual rule rather than merely its count.

## No-JS / reduced-motion — a HONESTY gate, not a perf gate (㉑ s105)

Built static-first because `/guide` will say so in writing and **every claim
`/guide` makes is a claim that has to be TESTED, not intended**:

- The ledger's eight rows, their **final** verdicts and all three counters ship
  in the server-rendered markup. With JS off the reader gets the completed run
  as a static table — the whole argument, minus the reveal.
- One inert data block is the single source of truth; the static markup and the
  runtime both read it, so they cannot drift.
- Reduced motion holds the hero on one frame and never scrubs.
- The frame sequence ships absolutely stacked with **exactly one lit**, and the
  runtime's `shown` index is **seeded from the DOM** (the fifth killer, ㉒ s107).

## Decision annotations — the calls a reviewer should be able to reverse

1. **Rebuilding `/` rather than building beside it.** Reversible, but leaving
   two landings would ship a dead door. One word makes it a separate route.
2. **The instrument runs on a committed SNAPSHOT, not a live read.** Chosen for
   two independent reasons — the landing tree stays free of dynamic APIs, and a
   public page must never query real tenant drafts. Cost: the numbers age, so
   `/guide` stamps the date they were taken.
3. **`data-instrument` primary, animation demoted to secondary.** A deliberate
   break from the three A+ sites, whose primary was animation by commission.
4. **The hero is a metaphor, not a screenshot.** Photographs carry feeling;
   product screenshots on a landing hero read as documentation. The evidence is
   carried by the instrument directly below it.
5. **Showing our own rejects verbatim.** The strongest and riskiest decision on
   the page. Reversible in one edit, but it is the whole argument.

---

## ⚠ CORRECTION — the row is a CLAIM, not a draft

Everything above this line was written before the data was fully read, and it
describes the instrument as a **draft ledger** showing drafts with verdicts.
**That shape was wrong, and it would have invented a fact.**

Thalon's judge does not verdict whole drafts. It pulls each draft apart into
the individual claims it makes and rules on them one at a time, storing them in
`judge_results.evidence.claims`. Several of the most striking blocked
sentences failed inside drafts that were then revised and **approved** — which
is the loop working, not a draft dying. Pairing those sentences with draft rows
(an earlier version of `run-snapshot.ts` did exactly that, with real draft
ids) would have asserted a link the database does not contain.

**So the ledger shows claims**, and the honest headline changed with it — from
*"10 of 21 drafts stopped"* to **681 claims judged, 635 cleared, 46 stopped**.
The caption reads `8 of 681 claims this run judged`, not `8 of 21 shown`.

The numbers in the table above remain true and are still pinned; they are just
no longer what the instrument counts. The general lesson is rule 12's, one
level down: **ground in the data before speccing the shape of the thing that
displays it** — the shape of a spec can be wrong about the shape of a fact.

## What the BUILD found (s109) — appended at the close

Six findings, and **only two were visible by looking at the page.**

1. **The mock printed the answer before the chapters asked** (spine-level; see
   above). Fixed into the architecture: the fill IS the instrument.
2. **The mock reproduced the s107 clock lag** — found by counting `.chap.on` at
   each chapter, not by looking. 1 of 6 correct before the fix, 6 of 6 after.
3. **THE LEDGER WAS ONE CHAPTER LATE, ON THE REAL PAGE.** Standing on the
   chapter headed *g3 · the grounding*, the instrument had decided ONE row and
   every g3 verdict landed a chapter later, under the discoverability heading.
   Every hand-written `decidedAt` was one too high. The instrument was alive,
   monotonic and lit — and answering the wrong question at every stop.
   **The fix is structural, not a test:** `decidedAt()` now derives the index
   from the row's gate, so a row can no longer hold an opinion that disagrees
   with the chapter naming its gate.
4. **TWO OF THE FIVE NEW RATCHETS WERE DECORATION, and the break-test proved
   it.** The "static-first" and "exactly one lit frame" tests both passed
   identically with their subject deleted, because Testing-Library's `render`
   runs effects: `live` was already true and `seg` already sat at the last
   chapter, so the assertions never saw the server markup they claimed to
   check. Rewritten against `renderToStaticMarkup` — the document a reader
   with JS off actually receives — and then re-broken three ways to confirm
   red. *A ratchet you have not broken on purpose is a ratchet you do not
   have, and this is the second session running that rule has paid.*
5. **THE PAGE WAS BROKEN ON A PHONE, AND ONLY MEASUREMENT SAID SO.** At
   390×844 the pinned ledger measures **1087px tall in an 844px viewport** —
   243px taller than the screen — so the reading band below the sheet was
   *negative*. Chapter 02 never activated at all and every other heading sat
   behind the sheet while the instrument claimed the reader was on it. Killer
   4 with no room left to measure from. Narrow screens now do not pin: the
   instrument shows the completed run, the same trade the no-JS reader makes.
6. **The CTAs still wore the genre default.** The page's own "refuses the
   default" test caught `cta-glare` and an amber glow surviving in the
   waitlist button and the sticky bar — the exact thing the look-first sweep
   had refused by name, still in the markup two components away.

### The mint corollary this build adds

**Frame density is set by how much of the FRAME moves, not by whether the
CAMERA moves.** The s108 corollary reads "a panning take needs ~3× the frames
of a locked-off one", and this take is locked-off — yet it needed **81**
frames where ㉒'s locked-off bloom ships 36. Turbulent water changes every
pixel of the lower half every frame with the camera nailed down. Measured
adjacent-frame difference against the bloom's 1.26: 41 → 1.88, 61 → 1.56,
**81 → 1.24**, 121 (native) → 0.93. Banked in the meta-prompt.

### Verified at the close, by driving it

- pin holds at `top: 0` through the whole spine (desktop)
- the clock names the chapter the reader is on, 6/6
- **81/81 frames ever lit · 0 positions with a wrong lit count · 79 of 81
  reachable while the band is ≥75% visible · 0 reachable only under half
  visible** (Whitethorn's defect was 34 of 61)
- mobile: no horizontal overflow, ledger complete, exactly one frame lit
