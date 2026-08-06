# CURRENT

## Stamp

2026-08-06 close of session 112 (syd4 — boot `gogogo`, **then a founder design
review that rejected and rebuilt site D's spine**).

> ## ⚠ READ THIS FIRST — THE TASTE CORRECTION IS THE SESSION'S REAL OUTPUT
>
> *"did you not learn that my taste is not precise or scientific but imaginative
> and abstract"*
>
> Site D shipped an 81-frame veraison time-lapse — the best-measured thing in
> the arc, and the wrong idea. He supplied the replacement himself: **grapes →
> burst for their juice → into the bottle → poured into the glass**, and named
> Morningside as the standard (*"but that was under my direction. so that's the
> kind of abstraction i want"* — i.e. generating that abstraction is the bar,
> not executing his).
>
> **TIME-LAPSE vs JOURNEY**, now §THE HOUSE TASTE at the top of the meta-prompt.
> A time-lapse observes one subject while nature acts on it. A journey follows a
> MATERIAL through states, by an act, to a payoff. **Three of the arc's four
> other motions are time-lapses**, and his verdicts track exactly that: Aspect &
> Fall and Small Hours *"ok, but not memorable"*; Whitethorn's kinematic plot
> *"too scientific"* for a vet, where he wanted **a dog walking across the
> screen** — playful, not clinical. He said **keep Whitethorn** ("i cant be
> bothered to review the changes"), so it is untouched.
>
> He also caught the copy: *"wasnt the ratchet for these, dont be too wordy or
> verbose?"* It was already on record (*"less is more, but still with the same
> effect"*, s90) in a workspace-UX doc no portfolio build opens. **Site D was
> 851 words, third-wordiest of 25, against a 628 median and Morningside's 594.
> Now 371, and the budget is executable.**

Wrap verify on main: **exit 0, 3495 passed / 9 skipped, 0 lint errors**
(3481 → 3495: six `resolveFrameRange` contracts, a plotted-instrument drift
alarm, the copy budget, and six phase-0 honesty pins).

**THE LANDING ARC IS COMPLETE. ALL SIX SITES ARE BUILT.**
⑳ ✅ → ㉑ ✅ → ㉒ ✅ → the landing ✅ + its three passes ✅ → ㉓ ✅ →
**㉔ `marl-and-cane` BUILT, passed and green (this session).** **Nothing in the
arc remains.**

**Credits: 153.98** (286.14 − 38.96 first build − **93.20 rebuild**). The
rebuild is where the money went: 12 stills, 2 registered edits and 4 takes, one
of which was discarded.

Zero live posts, nothing armed, the queue consumer's master key still EMPTY.

## WHAT SHIPPED — site D, `marl-and-cane`

▎ **A single-vineyard estate whose page follows the juice out of the fruit.**
140 scrubbed frames across three takes — a heap of whole grapes giving way and
bleeding across concrete, the stream falling into a bottle, the glass filling.
The masthead names the two things that never change (marl, the clay-limestone
soil; cane, the one-year wood cane-pruning leaves) and the page argues the one
year that never repeats, which is how it differentiates from `orchard-house`'s
repeating cycle. **(The first build's veraison spine is described in the FINDS
below; it was rejected on review and replaced — see the addendum.)**

▎ **The name was decided by killing the spec's own favourite.** *Veraison*
**fails a collision check** — several live trading names, a near-homophone
winery, and a registered trademark holder (*Veraison Wine Cellars, Inc.*).
*Southfacing* silently picks a hemisphere and collides with `aspect-and-fall`.
Axis pair `otherworldly-animation` + **`brutalist-raw`**, portfolio-new in both
orderings; `physics-interaction` was rejected because it would have been a
second motion system competing with the spine for one clock.

▎ **It ships a LIGHT instrument — the opposite call to Morningside's none.**
Nothing in the portfolio plots ripeness, a Brix/acid curve with a picking window
is what the discipline actually produces, and the lay twin is free and unusually
honest: veraison IS the visible proxy for sugar accumulation, so the curve and
the fruit are two readings of one process.

▎ **132.16cr across both builds.** Type is **Syne + Geist + Geist Mono**, all
OFL, all portfolio-new.

## THE FINDS — from the FIRST build (the veraison spine, since replaced)

Findings 1, 3, 4, 5 and 6 are about the pipeline and stand unchanged; 2, 7 and 8
concern the veraison sequence specifically and are kept as the record.

1. **A GENERATED TAKE DOES NOT SPREAD ITS TRANSFORMATION EVENLY ACROSS ITS OWN
   DURATION.** The 8s take is 193 frames; measured against its own final state
   the subject is flat for the first ~48, changes across ~75, and is **pinned
   within noise for the last ~65** — frames 128/144/168/192 are visibly one
   picture. `frames: N` samples the whole clip, which is what every prior site
   did, so it would have spent **a third of the page's scroll on a still
   image**. Now a manifest `range`, resolved by `resolveFrameRange`.
2. **"Green grapes" is a VARIETY, not a ripeness stage.** Two anchor takes
   asking for unripe "pale yellow-green" berries returned **ripe WHITE wine
   grapes** — and a white variety has no veraison to purple at all, so chaining
   a black end-frame off one would have been a lie about the plant, not a
   cosmetic miss. Fixed by pinning the attribute that determines the colour
   (name a red variety) and describing the stage by hardness and opacity.
   Caught on the ANCHOR for 0.24cr, before anything derived from it.
3. **The density benchmark this repo quotes does not reproduce.** The
   meta-prompt records ㉒'s bloom at "mean 1.19"; the shipped bytes measure
   **1.52**, and Morningside's shipped beans **1.51**. The gap is the ENCODER —
   encoding is deterministic, but two slightly-different frames land on
   different quantisation decisions, and a true 1.18 measures **2.25 at webp
   q54**, an additive ~1.0 unrelated to motion. **Measure in one space and say
   which; compare shipped to shipped.**
4. **The mobile pin was dead at 724 of 724 in-view samples — and NOT for
   s111's reason.** Both `position` and `height` were restated, exactly as last
   session's lesson says. The cause was neither: `.stage-col { flex: 0 0 auto }`
   makes the sticky element's containing block *exactly its own height*, so
   there is no travel. Desktop escapes it only because `align-items: stretch`
   hides it. 0 of 688 after the sticky moved onto the column.
5. **A registered edit re-grades too, and the patch decides the conclusion.**
   Both end-frame candidates landed in register (dx=0 dy=0), but a "static"
   patch containing the vine leaf said the edit lifted the frame +5.3/+7.3/−4.2
   while three pure-background patches all said **blue alone drops ~6.5**. The
   leaf had been re-lit by the very edit being measured.
6. **A fixed HSL lightness cannot survive a hue sweep.** The accent walks
   green→red→violet; at constant L the yellow-greens measured 3.67:1 and
   **29 of 81 frames failed AA**. Solving L per hue for a constant 4.85:1 passes
   every frame and holds a constant visual weight.
7. **The instrument was never on screen while the scrub drove it** — the chart
   is a section below the season, so "one clock, two readings" was satisfied in
   letter and never once in fact. The stage's stamp now carries the chart's own
   interpolated numbers beside the picture.
8. **The colour readout lagged the picture by ~20 frames** because its
   thresholds were guessed; read off the shipped contact sheet instead. Three
   further page-arithmetic errors (65 not 68 days, 36 not 68, 24.2 not 24.3)
   were found by re-deriving the page's own claims.

## The ratchets this session bought

**Executable:** `resolveFrameRange` + the manifest `range` field
(`packages/engine/src/assets/frames.ts`, six new contracts) so a take's live
range is a property of the pinned bytes, not a hand-trim · a
**plotted-instrument drift alarm** in `tests/template-portfolio.test.ts` that
RECOMPUTES the static SVG polylines from the page's own data block and checks
every reading reaches the static table. **Both broken three ways and confirmed
red**, as were the four existing portfolio ratchets against this new site.
**Documentary:** meta-prompt amended five times (the live-range rule; the
measurement-space rule; the variety-not-stage rule; killer 3 rewritten with the
`flex: 0 0 auto` cause; the twin-must-share-a-screen and hue-sweep-contrast
rules) · site D's PREPLAN §BUILT · arc spec · COORDINATION §s112.

**Three method notes worth keeping, all self-inflicted:**

1. The first attempt at breaking the four existing ratchets **passed**, and I
   nearly recorded "the contract does not cover this site". The substitutions
   were no-ops — the real markup had `data-day` between the attributes I was
   matching. **A break test that does not change the file is indistinguishable
   from a ratchet that does not fire**; break tests now assert the file changed.
2. **`cmd > log; echo "EXIT: $?"` makes the WRAPPER exit 0**, so the harness
   notification reported "exit code 0" for a verify that had actually failed
   with two red tests. Same disease as `verify | tail` reporting tail's code.
   **Write `ec=$?; echo …; exit $ec`** so the reported code is the gate's, and
   never trust a completion summary over the log.
3. **`pgrep -f "[v]itest"` self-matches** when the waiting shell's own command
   line also contains `vitest` further along — an `until ! pgrep …` wait then
   never terminates. The `[v]` trick only dodges grep's own process.

## Resume prompt (session 113, syd4)

**Resume · Thalon** — nothing is mid-flight.

**1 — THE ARC IS DONE, so the next move is the founder's call, not an inherited
one.** Six sites and the front door are built and awaiting verdicts. The
standing candidates, in the order I'd take them:

**2 — PHASE 0 IS DONE (s112c).** The arm control no longer promises what the box
cannot do: `queueArmed` reaches the surface from the engine's own predicate, the
head control carries one standing disclosure, the `Live` hint is conditional, and
a `Held:` line outranks the scope claim wherever a control would otherwise
promise an unattended send. Disclosure only — nothing added arms the queue.

**3 — CONTROL-ARC PART B is now the next build item**, and it owes a DRAWN SHEET
before any code (DOCTRINE 0). Both MIT deps approved. Design work is Fable 5
lead-direct, never delegated.

**4 — WHITETHORN HAS A LIVE REDESIGN BRIEF IN HIS OWN WORDS** whenever he wants
it: *"a dog (real or cartoon) on the side bar or at the top of the screen walking
or running across the screen, making the vet more playful and fun."* He said keep
it for now. Its 1,119 words are also the portfolio's worst. **Aspect & Fall and
Small Hours are "ok, but not memorable"** — both time-lapses, neither re-briefed.

**5 — 153.98cr remain on a use-it-or-lose-it subscription.** No site needs them.

**CARRIED, recorded not fixed:** **`/favicon.ico` 404s on every site — 0 of 25
ship one**, portfolio-wide and pre-existing · **`/blog` and `/brand` still scope
`.dark`** and differ in register from `/` · ㉒'s mobile vertical rhythm ·
Schedule's month-density chips clip their text · the Intel dossier-absence
REASON does not reach the wire · Intel dismiss reversibility · the sweep
schedule's missing door · the add-chip's missing keyword path · ㉑'s July
hydrangea reads as a mophead where the calendar names *Hydrangea quercifolia*.

**WAITING ON HIM — none blocking:** **the whole landing page** · **where `/` is
served and under what name — still his call** · ㉑'s, ㉒'s, ㉓'s and now
**㉔'s** verdicts · ㉑'s casting reversal · the Higgsfield expiry date · the
three s101 staged design calls. All on NEEDS-STEVEN.

▎ ▸ **THE LESSON THE FOUNDER ADDED, and it outranks the rest: MEASURING A THING
PERFECTLY DOES NOT MAKE IT THE RIGHT THING.** Site D's veraison spine was the
most carefully measured artefact in the arc — live range, density, registration,
grade, contrast, pacing, all instrumented — and it was the wrong idea, because
nobody asked whether a time-lapse was what the page wanted. **Run the taste
question BEFORE the measurement questions: is this a journey or a documentary?**
▎ ▸ **The lesson, THIRTEENTH session running: RUN IT, MOVE IT, COUNT IT, CHECK
WHERE IT LANDS, CHECK THE AXIS, CHECK WHETHER THE FIX GENERALISES — and now,
CHECK THAT YOUR CHECK ACTUALLY RAN.** Three times this session a measurement
was right about the wrong thing: a break test that silently changed no file, an
exposure patch that contained the subject it was measuring, and a benchmark
quoted from a different measurement space than the thing compared to it. **The
previous session's fix was again this session's defect** — s111 said "restate
position AND height for the mobile pin", both were restated, and the pin was
still dead at 724 of 724 because the cause was a third thing.
▎ ▸ **Traps worth keeping:** **a take can reach its end state a third of the way
from the end** — measure the live range · **webp adds ~1.0 to adjacent-frame
difference regardless of motion** · **`flex: 0 0 auto` on a sticky element's
parent kills the pin, invisibly on desktop** · **a colour word can name a
variety rather than a stage** · **a fixed HSL lightness fails AA somewhere on
any hue sweep** · a frame COUNT is not a frame RATE · measure a take's PEAK
adjacent difference, not just its mean · Seedance re-grades at the head of every
take, and so does the EDIT seat · passing `mode: "std"` explicitly stopped the
model substitution this session · the vendor may answer with a preset and NO job
· negating a printable surface NEVER removes it — name the frame instead ·
`npm run verify | tail` REPORTS TAIL'S EXIT CODE — **and so does
`verify > log; echo $?`, whose WRAPPER exits 0 and makes the harness report a
red gate as "exit code 0"; write `ec=$?; …; exit $ec`** · **`pgrep -f "[v]itest"`
SELF-MATCHES when the same command line mentions vitest later, so an
`until ! pgrep` wait hangs forever** · a `cd` inside a shell
function changes the cwd for everything after it · the Bash tool's cwd PERSISTS
· eslint runs FROM `apps/web`, tsc FROM THE REPO ROOT · scripts need
`set -a; source apps/web/.env.local; set +a` · `html{scroll-behavior:smooth}`
defeats `window.scrollTo` — set `scrollBehavior='auto'` first · **a scroll
handler's rAF means one rAF after `scrollTo` is NOT enough to read the result**
· vendor mint URLs expire, download immediately · **an unbuilt portfolio site
may contain ONLY `PREPLAN.md`** · **the full suite takes ~10 min; do not start
it with `next dev` running**.
▎ ▸ **⛔ SEQUENCE GATE, unchanged:** post = ARMED (founder GO s98); page still
409s at `POST /api/create`; bluesky is the one platform granted for live
testing; the queue consumer's key rests EMPTY. Two live posts total, both
bluesky. **This session spent 38.96 credits and posted nothing.**
▎ ▸ **Standing:** stealth · hermes-relay = founder · GATE ON EXIT CODE ·
verify-on-main = THE gate · rules 10/11/12 · platform logins live durably in
`.context` · no AGPL embedded · wrap = verify+commit+push+restamp.
▎ ▸ **State:** tree clean and main == origin (verified at wrap) · staging rolls
s93–s112 with the next auto-deploy · **no new migration this session** · four
social channels connected · dev PG live · 8899 preview + sweeper user units keep
running — NEVER hand-start the sweeper. **The 8899 preview served the browser
pass; no `next dev` was started this session.**
▎ ▸ **✅ SAFE TO CLEAR** — nothing in flight; no lanes; tree clean and pushed;
s113 boots on "gogogo" alone. **The PLAN is COORDINATION §s112** and
`docs/landing-arc/spec.md` is a **CLOSED record — every site in it is built.**

0. **Self-check** — tmux `thalon` · `pg_isready` · both user units (needs
   `XDG_RUNTIME_DIR=/run/user/$(id -u)`) · `git status` + this stamp · `npm run
   verify` before any new work.

CLAUDE.md → this file → COORDINATION.md (**§s112 = the plan**) →
`docs/landing-arc/spec.md` (**CLOSED — all six built**) →
`proprietary/templates/meta-prompt.md` (**READ BEFORE ANY MINT — amended five
times this session**) → `proprietary/templates/sites/marl-and-cane/` (**the
newest site; its PREPLAN §BUILT carries what the build changed about the plan**)
→ `.context/mints/marl-and-cane/` → `proprietary/templates/sites/morningside/` →
`docs/control-arc/spec.md` (**A + A2 BUILT; B owes a SHEET**) →
`docs/research/ux-refinement-program.md` → agent_handoff/NEEDS-STEVEN.md →
`docs/research/prior-art-portal-automation-s84.md` (BEFORE ANY PORTAL WORK).
`docs/video-arc/spec.md` is a CLOSED record.

## Delta (session 112)

The arc's last site went up for thirty-nine credits against a hundred-and-ten
budget, because the budget was written before the rule that made two-thirds of
it unnecessary: veraison is one subject transforming one way, so it is one take
between two minted endpoints, not three chained segments.

The find worth carrying is that a generated clip lies about its own pacing. Ask
for eight seconds of a bunch changing colour and you get roughly three seconds
of it, with two seconds of nothing at the front and nearly three of a frozen
picture at the end. Every previous site sampled frames evenly across the whole
clip, which here would have spent a third of the page's scroll on an image that
does not move. The range is now measured and written into the manifest, so the
next site cannot inherit the assumption.

Twice more the measurement was right about the wrong thing. An exposure check
said the edit seat had brightened the frame; measured on patches that did not
contain the leaf the edit had re-lit, it had done something quite different and
only to the blue channel. And the density benchmark this repo has quoted for
two sessions does not reproduce from the shipped bytes at all — the difference
turns out to be the webp encoder adding about a unit of apparent motion to any
sequence, which means a number measured before encoding and a number measured
after are not the same quantity and never were.

The mobile pin was dead again, for the third distinct reason in three sessions,
and last session's fix was applied correctly and did not help. That is the
pattern worth naming: each session's lesson has been true and each has been
about a different cause, so the ratchet that matters is not the fix but the
measurement — check the pin at a phone width every time, because the desktop
result carries no information about it.

---

## ADDENDUM — the s112 founder review and the rebuild

**What changed on the page.** The spine is now **140 frames across three takes**
— a heap of whole grapes giving way and bleeding across concrete, the stream
falling into a bottle neck, the glass filling — over five chapters (anchors
0 · 36 · 71 · 99 · 139). Copy **371 words**. The Brix/acid chart stays (it is
*visual*, and "more visual, fewer words" cuts words not pictures); its 11-row
table and explanatory paragraphs are gone. The wine-glass still he flagged for
compression is **deleted, not re-encoded** — the pour sequence ends on a glass,
so the photograph was saying the same thing twice.

**Three findings worth carrying.**

1. **Ask what KIND of motion each BEAT is, not each SITE.** This spine holds one
   transformation and two pours. s108 says a pour is a *cycle*, so two of three
   takes needed only a start frame — no end keyframe, no registration risk, less
   money. The question is per-shot.
2. **A chained take drifts because of what it AIMS at, not its prompt.** The
   first crush take recomposed across native frames 31–59 (steps to **7.62**
   against a 0.54 median). The instinct is a sterner prompt; the rule (s106) says
   fix the keyframe, and the rule was right — the end frame had been minted
   independently at a wider framing. Re-minting it as a **registered edit of the
   start** gave dx=0/dy=−1 and a clean take (0 cuts, max 0.93). One 22.50cr take
   spent proving it.
3. **A multi-sequence stack needs `.is-live`.** Three sequences cannot each carry
   a lit frame *and* show only one. Every sequence keeps its own lit frame so
   no-JS is never blank; a class on the container decides which paints. The
   portfolio ratchet caught this the moment the third sequence landed.

**Measured on the shipped page** — 140/140 frames reachable and **none starved**
at 1440×900 and 390×844 · exactly one lit frame and one live sequence at every
sampled position · pin held **0/943** desktop, **0/591** phone · **42–54px of
scroll per frame**. Shipped adjacent-frame difference: crush 1.73, fill 1.60,
pour 1.29 against house references of 1.51–1.52.

**Ratchets added on the review:** an executable **copy budget** (900 words,
visible copy only) with whitethorn recorded as an explicit grandfathered
exceedance *because he said keep it* — the exceedance is visible in the test
rather than hidden behind a loose threshold. Broken deliberately and confirmed
red, as were the drift alarm, the anchor contract and the frame-stack contract
against the rebuilt page.

**Open for the next session, in his words:**
- **Whitethorn is untouched by his instruction** but he described what he
  wanted: *"a dog (real or cartoon) on the side bar or at the top of the screen
  walking or running across the screen, making the vet more playful and fun."*
  That is a live redesign brief whenever he wants it — and its 1,119 words are
  the portfolio's worst.
- **Aspect & Fall and Small Hours are "ok, but not memorable."** Both are
  time-lapses. Neither has been re-briefed.
- **153.98cr remain** on a sunsetting subscription.

---

## ADDENDUM 2 — phase 0 shipped (s112c, 0 credits)

**The arm control stops asserting what the engine will not do.** Three gates are
AND — `SOCIAL_QUEUE_ARMED` (env) → posting scope → the destination's state — and
the surface could only see the bottom two, so it offered *"Live — due posts go
out on their own"* on a deployment whose tick cannot send. Fixed as a
**disclosure, never a door**: arming stays a deployment act and the founder's
sequence-gate call.

- `GET /api/integrations` serves **`queueArmed`** from the engine's own
  `publishQueueArmed` + `SOCIAL_QUEUE_ARM_KEY`, so page and tick cannot disagree.
- **One** standing line at the head control; the `Live` hint is now a function of
  the master key; a per-card `Held:` line **only** where a control would
  otherwise promise a send, and it **outranks the scope overlay** because "this
  destination posts" is false while the master key is off.
- Client state defaults to **not armed**, so a failed read never claims live.

**Driven in the real app**, not only jsdom: disclosure renders once, every Live
tooltip carries the honest sentence, flipping LinkedIn to Live produced the
`Held:` line on that card alone — then restored to `off` and confirmed through
the API. One existing test asserted the now-false scope sentence; it was updated
to arm the gate above it, and a new test pins the precedence.

**Five ratchets, broken three ways and confirmed red** (flat hint restored,
`queueArmed: true` served, scope claim outranking the master key).
