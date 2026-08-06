# CURRENT

## Stamp

2026-08-06 close of session 110 (syd4 — boot was `gogogo`, no other founder
input this session).

Wrap verify on main: **exit 0, 3480 passed / 9 skipped, 0 lint errors**
(3469 → 3480: the 11 new pin-fit assertions).

**THE OWED PASS IS DONE, AND IT FOUND THE WORST DEFECT ON THE PAGE.**
⑳ ✅ → ㉑ ✅ → ㉒ ✅ → **the landing ✅ (s109) + its third iteration pass ✅
(this session)** → **site E's motion spine MINTED and verified; the site itself
is NOT built.** Site D untouched.

**Credits: 286.74** (343.98 − **57.24**). E's whole three-beat spine cost under
half its ~120cr full tier, so **286.74 covers E's remaining stills AND all of
site D** comfortably.

Zero live posts, nothing armed, the queue consumer's master key still EMPTY.

## WHAT SHIPPED — commit `a6502a3`

▎ **THE GUARD WAS ON THE WRONG AXIS.** s109 fixed the pinned ledger on a phone
and guarded it with *"do not pin below 900px of WIDTH"*. Width was only ever a
proxy: the constraint is HEIGHT. Driven at **950×620** — an ordinary laptop
window — the stage still pinned an **849px ledger into a 620px viewport**, and
because `.gs-stage` centres its content the overflow was clipped at **both
ends**. Measured at every one of the six chapters, the reader **never saw the
four readouts** — 681 judged / 635 cleared / 46 stopped / **sent unreviewed 0**.
Those totals ARE the argument: they are what stops the sample of eight being
read as a rate, and "sent unreviewed: 0" is the sequence-gate claim. The page
made a weaker and less honest case than the one it was built to make, on a large
share of real screens, and looked perfect doing it.

▎ **Fixed on both axes.** The sheet COMPACTS at short viewports (868→**723px**
at the narrow edge, 777→**592px** at ≥1280) so the reveal survives on real
laptops, and the width floor moved 900→**1100** because at 901px the sheet is
still 723px and the chapter column beside it is only 300px. New worst case
1101×700: sheet 648px, **52px headroom**.

▎ **THE SPLIT WAS ITSELF A FIND.** The pinning rules gained a height clause and
the width-only rules — pricing tiers, proof band, hero art — were sitting in the
same block. Folded in, a **1920×650** window would have dropped the tiers to two
columns and squashed the hero art to 4:3 purely because the window was short.

▎ **The band spent 2.65 MB to animate a thumbnail.** At 390×844 it pulled all 81
frames — **2,712 KB** — into a box measuring 350×197. Narrow screens now hold the
poster: **81 requests → 1.**

▎ **LANE B: the hero delivers the axis it has claimed since it was built.**
`page.tsx` described *"display type interlocking with the photographic
subject"*; measured at 1440 the type ran down the left, the photo sat underneath
at full width, and a **604px dead column** held nothing. The photograph now
rises into exactly that column, **its bottom edge on the foot of the form to the
pixel**. Dead column **604px → 32px**. A first attempt narrowed the headline to
make room and was thrown away — it cost the 82px line, the page's strongest
gesture.

## SITE E (`morningside`) — the spine is minted, the site is not built

**Coffee BRAND, not café** — and grounded against the repo rather than argued:
`fern-and-crumb` already holds `hospitality-cafe` **and** already spends
`soft-organic`, so a café E would have collided on vertical AND secondary axis.
The pair `otherworldly-animation` + `soft-organic` is portfolio-new (verified
against all 23 shipped `site.json` files).

**One cup, three states, contents transforming: beans → grounds → pour.** Two
5-second Seedance segments, both verified by measurement:

- camera held on both: first→last offset **dx=0, dy=0**
- K2→K1 registration **1 pixel** (dx=0, dy=−1) — ㉒'s benchmark, and *both*
  candidates landed in register where ㉑ was a 50/50 coin flip
- density vs ㉒'s 1.26 benchmark → **41 frames per segment** (S1 0.82, S2 1.00);
  82 frames for the whole spine where the landing needed 81 for one

**⚠ THE BYTES ARE IN `.context/mints/morningside/` (gitignored, durable) with
full provenance. DO NOT RE-MINT** — every re-mint draws a new seed and the
registration chain would have to be re-earned. They are not in the site
directory because `template-portfolio.test.ts` requires an unbuilt site to hold
**only** `PREPLAN.md`; they move into `assets/` as part of the build.

## THE FINDS — and two are new mint law

1. **A viewport can be wide enough and still too short** (above). The guard is
   now a pure predicate both the CSS and the component read.
2. **Seedance does not start on the still it is given** — S1's first frame sat
   **MAD 7.36** off its own anchor. So keyframes are **directing instruments,
   not shipping assets**: the hero still is the take's frame 0, and any later
   keyframe must be derived from the TAKE, not from the still that made it. The
   first K3 was edited off the still, carried the still's wider framing, and
   would have made the camera pull back across the whole second beat. Re-derived
   from S1's actual last frame it registers at dx=0, dy=−2. Cost of finding it: 2cr.
3. **End-frame-to-start-frame chaining buys exact GEOMETRY, not exact GRADE.**
   s106 says the seam is then *"exact by construction"*; measured, it is half
   true. S2's first frame is geometrically exact (offset 0,0) and **~5 RGB units
   darker** with contrast unchanged — the model re-grades. It is fixable
   **locally at 0cr**: a per-channel mean/std match takes the seam **6.87 →
   4.53**. *Measure a seam's offset and its exposure separately; only one is free.*
4. **`seedance_2_0_fast` is not a requestable model** — asking for it errors. It
   is only ever a name the vendor reports back, and s109 recorded it as what
   RAN. Request `seedance_2_0`. The vendor substituted on every other call
   (`soul_2`→`text2image_soul_v2`, `nano_banana_pro`→`nano_banana_2`).
5. **The preset trap fired a third time** — `generate_video` answered with a
   preset and NO job, nothing charged; `declined_preset_id` returned a real one.
6. **A copy constraint from the picture:** the grind renders finer than a medium
   pour-over grind, so beat 2's copy must not name a brew method the frame
   contradicts (the ㉑ hydrangea class). Write it about grinding fresh vs
   pre-ground — method-agnostic and true to the frame.

## The ratchets this session bought

**Executable:** `pin-fit.ts` (a pure predicate — the same shape as s109's
`decidedAt()` derive) + `pin-fit.test.ts`, **11 assertions**: the predicate, the
CSS↔JS agreement (a JS breakpoint drifting from its CSS breakpoint is invisible
to every test that only renders markup), the band's payload door, and the
width/height split. **All four guards deliberately broken and confirmed red** —
reverting `canPin` to the s109 rule reds 4, drifting the CSS query reds 1,
dropping the band's narrow clause reds 1, folding the width-only rules back in
reds 1.
**Documentary:** the s110 seam corollary in the meta-prompt; the pass-3 log in
`docs/landing-arc/thalon-landing-PREPLAN.md`; site E's pre-plan.

## Resume prompt (session 111, syd4)

**Resume · Thalon** — nothing is mid-flight. The landing arc's four sites are
built and the capstone has had all three of its mandated passes.

**1 — BUILD SITE E (`morningside`).** The spine is already minted and verified;
this is a BUILD, not a mint. Read
`proprietary/templates/sites/morningside/PREPLAN.md` first — its
"⚠ THE MOTION IS ALREADY MINTED" block carries the four findings that change
what the build does, and `.context/mints/morningside/PROVENANCE.md` carries the
job ids, costs and measurements. **Ship 41 frames per segment; the hero still is
the take's frame 0; the assembly recipe carries a per-channel tone match at the
seam.** The site needs `site.json` + `index.html` + `guide/index.html` + assets
+ vendored fonts, then **three two-lane iteration passes**, then the portfolio
ratchets. Remaining spend for E is stills only (~a few cr).

**2 — SITE D (vineyard).** Untouched. **286.74cr available** against its ~110cr
full tier, so it fits comfortably even after E's stills. Hero beat **veraison**
— a ONE-WAY transformation, so mint the two endpoints and let one take supply
the middle (s107), NOT a cyclic single-frame case. **D's secondary axis is an
open draw to be made at D's own pre-plan**, with the portfolio in front of it:
`otherworldly`+`physics-interaction` and `otherworldly`+`brutalist-raw` are both
still portfolio-new (verified this session against all 23 site.json files).
Differentiate from `orchard-house` on register: a winery sells a **vintage**,
one year that never repeats, where the orchard sells a repeating cycle.

**3 — PHASE 0** (~1hr): the s103 seg still offers **Live — "Due posts go out on
their own"**, untrue while the queue's master key is empty. **Ship the
DISCLOSURE, not a door.**

**4 — CONTROL-ARC PART B**, which owes a DRAWN SHEET before any code
(DOCTRINE 0). Both MIT deps approved.

**CARRIED, recorded not fixed:** **`/blog` and `/brand` still scope `.dark`** and
now differ in register from `/` — a real public-site inconsistency, deliberately
not fixed alongside the capstone or its pass · ㉒'s mobile vertical rhythm ·
Schedule's month-density chips clip their text · the Intel dossier-absence
REASON does not reach the wire · Intel dismiss reversibility · the sweep
schedule's missing door · the add-chip's missing keyword path · ㉑'s July
hydrangea reads as a mophead where the calendar names *Hydrangea quercifolia*.

**WAITING ON HIM — none blocking:** **the whole landing page** (he asked not to
be shown Whitethorn until complete; the landing is the same class) · **where `/`
is served and under what name — still his call, and building it did not decide
it** · ㉑'s and ㉒'s verdicts · ㉑'s casting reversal · the Higgsfield expiry
date · the three s101 staged design calls. All on NEEDS-STEVEN.

▎ ▸ **The lesson, ELEVENTH session running: RUN IT, MOVE IT, COUNT IT, CHECK
WHERE IT LANDS, CHECK THE TEST — and now, CHECK THE AXIS THE GUARD IS ON.**
s109's fix was real and it was measured and it was still wrong, because it
guarded WIDTH when the failure was about HEIGHT. **A guard derived from one
measured failure inherits that failure's accidents.** The previous session's
answer keeps becoming the next session's blind spot, and this time the answer
itself was the blind spot.
▎ ▸ **Traps worth keeping:** **`display:none` on a `loading="lazy"` image
genuinely prevents the fetch** (verified with a cache-busted probe — 81 requests
→ 1) · **a media query mixing width and height concerns will fire on the wrong
one** — split them · **Seedance re-grades between chained segments; match tone
locally, never re-mint** · **`seedance_2_0_fast` cannot be requested** ·
the vendor SUBSTITUTES the model on nearly every call — record what RAN ·
`generate_video` may answer with a preset and NO job — re-send with
`declined_preset_id` · **`pkill -x -f` matches nothing** (exact match against a
full command line) — find the PID and `kill` it · `npm run verify | tail`
REPORTS TAIL'S EXIT CODE · the Bash tool's cwd PERSISTS · eslint runs FROM
`apps/web`, tsc FROM THE REPO ROOT · scripts need
`set -a; source apps/web/.env.local; set +a` · `html{scroll-behavior:smooth}`
defeats `window.scrollTo` — set `scrollBehavior='auto'` first · vendor mint URLs
expire, download immediately · `packages/db` exposes `repos` as its ONLY query
API · **the landing + portfolio files trip the impeccable hook by construction —
the landing keeps its own register, stated in writing at
`bridge-burndown.test.ts:21` and enforced by its `SKIP_DIRS`** ·
**an unbuilt portfolio site may contain ONLY `PREPLAN.md`** or the portfolio
ratchet goes red · **the full suite takes ~9 min; do not start it with `next dev`
running** (load average hit 19.7 on 6 vCPU).
▎ ▸ **⛔ SEQUENCE GATE, unchanged:** post = ARMED (founder GO s98); page still
409s at `POST /api/create`; bluesky is the one platform granted for live
testing; the queue consumer's key rests EMPTY. Two live posts total, both
bluesky. **This session spent 57.24 credits and posted nothing.**
▎ ▸ **Standing:** stealth · hermes-relay = founder · GATE ON EXIT CODE ·
verify-on-main = THE gate · rules 10/11/12 · platform logins live durably in
`.context` · no AGPL embedded · wrap = verify+commit+push+restamp.
▎ ▸ **State:** tree clean and main == origin (verified at wrap) · staging rolls
s93–s110 with the next auto-deploy · **no new migration this session** · four
social channels connected · dev PG live · 8899 preview + sweeper user units keep
running — NEVER hand-start the sweeper. **A `next dev` on :3111 was started for
the browser pass and STOPPED at the wrap.**
▎ ▸ **✅ SAFE TO CLEAR** — nothing in flight; no lanes; tree clean and pushed;
s111 boots on "gogogo" alone. **The PLAN is COORDINATION §s104** and
`docs/landing-arc/spec.md` is the spec of record — **the capstone is DONE and
passed; E's spine is MINTED and its site is the next build; D remains.**

0. **Self-check** — tmux `thalon` · `pg_isready` · both user units (needs
   `XDG_RUNTIME_DIR=/run/user/$(id -u)`) · `git status` + this stamp · `npm run
   verify` before any new work.

CLAUDE.md → this file → COORDINATION.md (**§s104 = the plan**) →
`proprietary/templates/sites/morningside/PREPLAN.md` (**THE NEXT BUILD — read
its already-minted block**) → `.context/mints/morningside/PROVENANCE.md` (**job
ids, costs, measurements**) → `docs/landing-arc/spec.md` (**A+B+C + capstone
BUILT; D and E remain**) → `docs/landing-arc/thalon-landing-PREPLAN.md` (**its
CORRECTION block, its six build findings and the s110 pass-3 log**) →
`proprietary/templates/meta-prompt.md` (**READ BEFORE ANY MINT — five
corollaries now**) → `proprietary/templates/sites/whitethorn/` →
`proprietary/templates/sites/small-hours/` → `docs/control-arc/spec.md` (**A +
A2 BUILT; B owes a SHEET**) → `docs/research/ux-refinement-program.md` →
agent_handoff/NEEDS-STEVEN.md → `docs/research/prior-art-portal-automation-s84.md`
(BEFORE ANY PORTAL WORK). `docs/video-arc/spec.md` is a CLOSED record.

## Delta (session 110)

The session was supposed to be about spending credits, and the most valuable
thing it did cost nothing.

The landing page owed a third iteration pass — the meta-prompt asks for three
and s109 ran two and said so. Driving that pass at an ordinary laptop window
found the page silently eating its own argument: a 620px-tall window pinned an
849px sheet and clipped the run's four totals off the bottom of the screen, at
every chapter, on a page whose entire claim is that it shows you what it
refused. s109 had already fixed this failure once, measured it on a phone, and
guarded it on WIDTH — and width was an accident of where it happened to be
found. **A guard derived from one measured failure inherits that failure's
accidents.** That is the eleventh consecutive session where the finding was a
version of *run it and read it*, and the first where the thing that was wrong
was the previous session's fix.

Then site E's spine got minted: one ceramic cup on linen, its contents
transforming through beans, grounds and a poured cup, in two five-second takes
that hold the camera to the pixel. It cost 57 credits against a 120-credit tier
and it taught the mint method two things it did not know. Seedance does not
start on the still you give it — so a keyframe is a directing instrument, not a
shipping asset. And chaining a segment from the previous one's last frame buys
an exact geometry and a *different exposure*, which no amount of re-minting
fixes and thirty lines of arithmetic does, for nothing.

The site itself is not built. The bytes are banked with their provenance, and
saying that plainly is better than a half-built front door for a coffee brand.
