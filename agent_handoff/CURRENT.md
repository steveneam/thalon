# CURRENT

## Stamp

2026-08-06 close of session 111 (syd4 — boot was `gogogo`, no other founder
input this session).

Wrap verify on main: **exit 0, 3481 passed / 9 skipped, 0 lint errors**
(3480 → 3481: the new scroll-anchor contract).

**SITE E IS BUILT. THE LANDING ARC HAS ONE SITE LEFT.**
⑳ ✅ → ㉑ ✅ → ㉒ ✅ → the landing ✅ + its three passes ✅ →
**㉓ `morningside` BUILT, passed and green (this session).** **Site D
(vineyard) is the only thing left in the arc.**

**Credits: 286.14** (286.74 − **0.60**). The whole site cost sixty cents of
credit because s110 had already minted and banked its spine; D's ~110cr tier is
comfortably funded.

Zero live posts, nothing armed, the queue consumer's master key still EMPTY.

## WHAT SHIPPED — site E, `morningside`

▎ **A coffee brand whose page IS its animation.** One ceramic cup holds the
centre of the screen from the first screen to the last while its contents go
**beans → grounds → poured cup** across **82 scrubbed frames** of two chained
Seedance takes. Every word the brand says hangs off those three states: origin
and roast belong to the beans, the freshness argument to the grounds, the payoff
to the pour. It is the only site in the arc whose animation is the page rather
than a chapter inside it.

▎ **It ships NO data instrument, on purpose.** Coffee has excellent ones — roast
curve, brew table, extraction chart — and `first-crack` already IS that page, so
the differentiation had to rest on **register**: first-crack is the expert page,
this is the product page. Consequence, stated in the pre-plan before the build:
with no instrument, the motion carries everything.

▎ **Brand not café, decided against the repo rather than argued.**
`fern-and-crumb` already holds `hospitality-cafe` **and** already spends
`soft-organic`, so a café E would have collided on vertical *and* secondary
axis. `otherworldly-animation` + `soft-organic` is portfolio-new against all 23
shipped `site.json` files. Type is **Piazzolla + Onest**, both OFL, both
portfolio-new, and deliberately **no monospace** — a mono is the instrument
register, and not being an instrument is this page's whole differentiation.

▎ **0.60cr:** five `text2image_soul_v2` stills at 0.12, three kept.

## THE FINDS — and the first one corrects s110's own corollary

1. **A CORRECTION DERIVED FROM ONE MEASURED FRAME PAIR INHERITS THAT PAIR'S
   ACCIDENTS.** s110 measured the chained seam once, found S2 came back ~5 units
   dark, and banked *"per-channel mean/std match onto the seam frame"*. Measured
   **per frame** on a static patch, that is aimed at an accident of the single
   pair it came from: the shift is **not a constant re-grade**, it is a
   **settling transient at the head of every take** — S2 recovers within ~16
   native frames, S1 over ~86. The banked fix would have levelled the join and
   pushed **the payoff shot** (the full cup, the page's last image)
   **+5.8/+3.1/+3.4 off grade.** Shipped instead: a per-frame flatten of *both*
   takes onto one measured reference. Seam fixed identically (6.93 → 4.41 raw,
   ≤0.56/channel on the shipped bytes), payoff held to −0.2/+0.1/+0.4, and the
   hero still — which is the take's own frame 0 and was **the darkest frame of
   its own take** — brought onto grade too. Same 0cr arithmetic, three defects
   instead of one.
2. **A frame COUNT is not a frame RATE.** Density was correct and the motion
   still stuttered: the scroll was moving **17.1px per frame** through the grind,
   so a 100px wheel notch skipped five or six frames of the beat the page exists
   for. Chapter length is now *derived* from how many frames each chapter drives.
3. **A shorthand that drops a calc() is invisible in review.** The narrow-screen
   rules re-declared `.ch { padding }`, silently discarding that calculation:
   **31 of 82 frames were unreachable on a phone** while desktop was perfect.
   The same block reset the stage's `position` but not its `height`, so the
   sticky column was taller than the window and **the mobile pin was dead**.
4. **Measure the PEAK adjacent difference, not only the mean.** Morningside's
   grind is ~6 of segment one's 41 frames, so the mean says almost nothing about
   the moment that matters. Checked on the peak against ㉒'s bloom (mean 1.19,
   **peak 2.09**): S1 0.95, S2 1.88. **41 held** — but the mean alone could not
   have established it.
5. **The negative-prompt trap fired twice on one still.** "One uninterrupted
   pane, no bars, no grid, no mullions" returned a six-pane mullioned grid plus a
   newspaper against "no newspaper". The fix was the s104 rule — **name the FRAME
   you want**: a re-prompt holding only the table, the cloth, the cup and the
   light, with no wall or window anywhere in shot. Two candidates, because it had
   already failed once; candidate A invented an open book with legible text.
6. **An accent can fail contrast only at the END of its own arc.** The warming
   amber measured **4.11:1** on linen when fully warmed — under AA — on the state
   readout and the order button. Moved to 4.79:1; every point on the arc passes.

## The ratchets this session bought

**Executable:** `gradeFlatten` + a single-frame `frame` derive in
`scripts/export-template-assets.ts` (s110's "the hero still IS the take's frame
0" made a first-class manifest concept, so a keyframe and a shipping asset can
never be confused again) · the **scroll-anchor contract** in
`tests/template-portfolio.test.ts` — anchors must start at 0, end at the last
manifested frame, strictly advance, and each declared `--span` must equal its
anchor delta. **All four broken deliberately and confirmed red**, then restored.
**Structural:** the stage is bounded on VIEWPORT HEIGHT as well as width, so the
s110 pin-fit failure is impossible here rather than guarded against.
**Documentary:** meta-prompt amended twice (seam corollary corrected; density
rule extended to the peak) · site E's PREPLAN §BUILT · arc spec · COORDINATION.

## Resume prompt (session 112, syd4)

**Resume · Thalon** — nothing is mid-flight.

**1 — SITE D (vineyard), the LAST site in the landing arc.** Untouched.
**286.14cr** against its ~110cr full tier. Hero beat **veraison** — a ONE-WAY
transformation, so mint the two endpoints and let one take supply the middle
(s107), NOT a cyclic single-frame case. **D's secondary axis is an open draw to
be made at D's own pre-plan**, with the portfolio in front of it:
`otherworldly`+`physics-interaction` and `otherworldly`+`brutalist-raw` are both
still portfolio-new. Differentiate from `orchard-house` on register: a winery
sells a **vintage**, one year that never repeats, where the orchard sells a
repeating cycle. **Read the meta-prompt's amended seam + density corollaries
before any mint** — both changed this session.

**2 — PHASE 0** (~1hr): the s103 seg still offers **Live — "Due posts go out on
their own"**, untrue while the queue's master key is empty. **Ship the
DISCLOSURE, not a door.**

**3 — CONTROL-ARC PART B**, which owes a DRAWN SHEET before any code
(DOCTRINE 0). Both MIT deps approved.

**CARRIED, recorded not fixed:** **`/blog` and `/brand` still scope `.dark`** and
now differ in register from `/` · ㉒'s mobile vertical rhythm · Schedule's
month-density chips clip their text · the Intel dossier-absence REASON does not
reach the wire · Intel dismiss reversibility · the sweep schedule's missing door
· the add-chip's missing keyword path · ㉑'s July hydrangea reads as a mophead
where the calendar names *Hydrangea quercifolia*.

**WAITING ON HIM — none blocking:** **the whole landing page** · **where `/` is
served and under what name — still his call** · ㉑'s, ㉒'s and now **㉓'s**
verdicts · ㉑'s casting reversal · the Higgsfield expiry date · the three s101
staged design calls. All on NEEDS-STEVEN.

▎ ▸ **The lesson, TWELFTH session running: RUN IT, MOVE IT, COUNT IT, CHECK
WHERE IT LANDS, CHECK THE AXIS — and now, CHECK WHETHER THE FIX GENERALISES.**
s110's seam correction was real, measured, and correct *about the frame it was
measured on*; applied to the whole take it would have wrecked the payoff shot.
Two sessions running the finding has been that **the previous session's answer
was the next session's defect** — and both times the cause was the same shape: a
rule derived from one measurement inheriting that measurement's accidents.
▎ ▸ **Traps worth keeping:** **a media-query shorthand silently drops the
calc() it replaces** — 31 of 82 frames unreachable on phones while desktop was
perfect · **resetting `position` without `height` leaves a sticky column taller
than the viewport, and the pin is simply dead** · **an accent can pass contrast
at the start of an arc and fail at the end** · a frame COUNT is not a frame RATE
· **measure a take's PEAK adjacent difference, not just its mean** · Seedance
re-grades AND ramps at the head of every take · `seedance_2_0_fast` cannot be
requested · the vendor SUBSTITUTES the model on nearly every call · negating a
printable surface or a barrier NEVER removes it — name the frame instead ·
`npm run verify | tail` REPORTS TAIL'S EXIT CODE · **a `cd` inside a shell
function changes the cwd for everything after it** (four break-tests silently
ran from the wrong directory and printed nothing) · the Bash tool's cwd PERSISTS
· eslint runs FROM `apps/web`, tsc FROM THE REPO ROOT · scripts need
`set -a; source apps/web/.env.local; set +a` · `html{scroll-behavior:smooth}`
defeats `window.scrollTo` — set `scrollBehavior='auto'` first · vendor mint URLs
expire, download immediately · **an unbuilt portfolio site may contain ONLY
`PREPLAN.md`** · **the full suite takes ~10 min; do not start it with `next dev`
running**.
▎ ▸ **⛔ SEQUENCE GATE, unchanged:** post = ARMED (founder GO s98); page still
409s at `POST /api/create`; bluesky is the one platform granted for live
testing; the queue consumer's key rests EMPTY. Two live posts total, both
bluesky. **This session spent 0.60 credits and posted nothing.**
▎ ▸ **Standing:** stealth · hermes-relay = founder · GATE ON EXIT CODE ·
verify-on-main = THE gate · rules 10/11/12 · platform logins live durably in
`.context` · no AGPL embedded · wrap = verify+commit+push+restamp.
▎ ▸ **State:** tree clean and main == origin (verified at wrap) · staging rolls
s93–s111 with the next auto-deploy · **no new migration this session** · four
social channels connected · dev PG live · 8899 preview + sweeper user units keep
running — NEVER hand-start the sweeper. **The 8899 preview served the browser
pass; no `next dev` was started this session.**
▎ ▸ **✅ SAFE TO CLEAR** — nothing in flight; no lanes; tree clean and pushed;
s112 boots on "gogogo" alone. **The PLAN is COORDINATION §s111** and
`docs/landing-arc/spec.md` is the spec of record — **A+B+C+capstone+E are BUILT;
site D is the last one.**

0. **Self-check** — tmux `thalon` · `pg_isready` · both user units (needs
   `XDG_RUNTIME_DIR=/run/user/$(id -u)`) · `git status` + this stamp · `npm run
   verify` before any new work.

CLAUDE.md → this file → COORDINATION.md (**§s111 = the plan**) →
`docs/landing-arc/spec.md` (**A+B+C+capstone+E BUILT; D remains**) →
`proprietary/templates/meta-prompt.md` (**READ BEFORE ANY MINT — the seam and
density corollaries BOTH changed this session**) →
`proprietary/templates/sites/morningside/` (**the newest site; its PREPLAN
§BUILT carries what the build changed about the plan**) →
`.context/mints/morningside/PROVENANCE.md` (**job ids, costs, the corrected
finding 4**) → `proprietary/templates/sites/whitethorn/` →
`proprietary/templates/sites/small-hours/` → `docs/control-arc/spec.md` (**A +
A2 BUILT; B owes a SHEET**) → `docs/research/ux-refinement-program.md` →
agent_handoff/NEEDS-STEVEN.md → `docs/research/prior-art-portal-automation-s84.md`
(BEFORE ANY PORTAL WORK). `docs/video-arc/spec.md` is a CLOSED record.

## Delta (session 111)

The arc's fourth site went up for sixty cents, because the expensive half had
been paid a session earlier and banked properly.

What the build was really for was finding out whether last session's answer was
right. It was not — not entirely. s110 measured the join between two chained
takes, found the second one came back five units dark, and wrote down a fix:
match its exposure onto the seam frame. Measured again, frame by frame instead
of once, that darkness turned out not to be a property of the second take at
all. It is a transient at the *head* of every take — both of them — and it
settles within about half a second. Applying the banked fix as written would
have made the join perfect and washed out the full cup at the bottom of the
page, which is the one image the whole thing is built to arrive at.

That is twice running that the finding was the previous session's fix, and both
times for the same reason: a rule derived from one measurement quietly inherits
that measurement's accidents. The correction here — flatten every frame of both
takes onto one measured reference — costs exactly the same nothing, and it also
fixed the hero still, which had been shipping as the darkest frame of its own
take without anyone noticing.

The browser found the rest. The page was correctly dense and still stuttered,
because density and pacing are different questions and only one of them had been
measured. A single CSS shorthand on phones threw away a third of the sequence
while every desktop screenshot stayed perfect. And the accent colour, which
warms as the coffee brews, passed contrast at the start of its arc and failed at
the end of it.
