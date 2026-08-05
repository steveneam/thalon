# CURRENT

## Stamp

2026-08-05 close of session 106 (syd4 — boot was `gogogo`).
Wrap verify on main: **exit 0, 3452 passed / 9 skipped** (3441 → 3452: eleven
new frame-helper tests).

**One substantive commit.** ㉑ Aspect & Fall's **video pass** — the item the
s105 stamp put first, and the one that builds the scroll-scrub machinery ONCE
so site C inherits it instead of inventing it under video cost. **The check
that matters is not the sha but the state: tree clean, main == origin, verify
exit 0, all confirmed at wrap.**

**⚠ THE ARC IS STILL FIVE SITES + THE LANDING, AND ITS ORDER IS HIS:**
⑳ ✅ approved (owes its Day-84 motion) → ㉑ ✅ built **and now moving** →
**site C** → **THE THALON LANDING** → then **D (vineyard) and E (café) on
leftover credit only.**

Zero live posts, nothing armed, the queue consumer's master key still EMPTY.
**Credits: 414.22** (spent 137.00, reconciled live). **The 180cr ring-fence for
the Thalon landing is UNTOUCHED.**

## WHAT SHIPPED — ㉑'s stage now leads with the photograph, and the photograph moves

**Both of his s105 directions are answered.** *"Dont have to be stingy"* and
*"a top down view doesnt really display the full beauty and power"*:

▎ **The stage is REBALANCED.** The photograph holds **63% of the instrument
area where it held 24%** — measured on the rendered page, not estimated: sticky
`top:0`, photograph 471px against the plan's 279px. The plan is not weakened;
it still drives every readout, the shade polygon and the calendar playhead.

▎ **The photograph MOVES** — three generated Seedance transitions
(Feb→May→Jul→Oct) of one locked-off corner, **scrubbed by scroll position, never
played**. The mp4s are the pinned originals; the frames are the derive.

▎ **Three things had to give way to make it fit**, each a real call: the plan's
annotation type was **enlarged** (it is issued at half the sheet size now, and
at 4px it was decoration) · the interest calendar **left the pinned sheet** for
its own full-width section, because thirteen species in 117px collided — it is
no longer a mobile-only fallback · and mobile **now shows the photograph at
all**, which it never did (the old rule hid it outright, so a phone reader saw
the drawing of the garden and never the garden).

## THE FIND — and it is the part worth reading before site C

▎ **A CROSS-FADE HIDES MISREGISTRATION; A SCRUB EXPOSES IT.** ㉑ shipped at
s105 with an **October keyframe that was a different camera** — lower, further
back, hard backlight — measured **24px+ out of register** against the other
three, under a caption reading "the same corner". Nothing was visibly wrong on
the still page, because a dissolve between differently-framed shots reads as a
dissolve. **Making the page move is what found it.**

▎ **The cause was a ratchet applied to three assets out of four.** Feb and May
used the s105 layout-naming fix; **October still carried the exact phrasing that
fix replaced** (*"keep the camera position … identical to the reference"*).
Writing a mint corollary now obliges you to **re-mint every asset in the batch
made the old way**.

▎ **A generated transition is pulled by its END frame.** Two Jul→Oct segments
recomposed their own first frame **even when handed the previous segment's exact
last frame as `start_image`** — they were interpolating honestly toward a bad
end frame. **Do not chase a bad segment with prompt language; fix the keyframe
it aims at.** Once October was re-minted in register, the next segment landed
with a **zero-pixel seam** (measured dx=0, dy=0).

▎ **MEASURE registration, never eyeball it — and mint TWO.** A greyscale
mean-abs-difference search over a ±24px window takes a minute and returns a
number; two of four pairs looked identical and were not. On the re-mint,
**candidate A landed within 1px and candidate B drifted the same 24px+ on the
same prompt** — so the technique is roughly a coin flip per seed and picking by
measurement IS the job.

## The ratchets this session bought

**Executable:** `packages/engine/src/assets/frames.ts` + **11 tests** —
frame-pattern expansion (refuses a pattern too narrow for its count, which would
silently collide two frames onto one name) and even sampling that **always keeps
both endpoints**, because those are the pinned keyframes the scrub must land on.
· `frames:N` manifest entries in `scripts/export-template-assets.ts` (ext-aware
pinned key; **an mp4 without `frames` fails loud**) · the portfolio ratchet
extended so a pattern entry expands to its N filenames and the manifest↔disk
bijection still holds.
**Documentary:** two corollaries in `proprietary/templates/meta-prompt.md`
(**READ BEFORE ANY MINT**).

## Resume prompt (session 107, syd4)

**Resume · Thalon** — nothing is mid-flight. **The plan is COORDINATION §s104
(the PLANNED block), minus what shipped.** His running order is settled: sites
first, then the capstone.

**⚠ Open with the meta-prompt in hand.** It gained two corollaries this session
that exist so site C does not pay ㉑'s bill again.

**1 — SITE C: botanical perfumery (~82cr)** (`bloom video` — the arc's headline
video). **It now inherits a proven scrub component**: `frames.ts`, the `frames:N`
manifest entry, and a working stage pattern in
`proprietary/templates/sites/aspect-and-fall/`. Loop per
`docs/landing-arc/spec.md` §Method: **claude-design mock → PREPLAN.md →
code-direct → mint → /guide → fix round.** **Draw a portfolio-unique axis PAIR**
— `orchard-house` holds otherworldly+cinematic, `whitethorn`
otherworldly+data-instrument, `aspect-and-fall` otherworldly+editorial-print.
C's banked idea is a *video*, so it dodges the picture-of-a-thing trap; its
equivalent question is what a perfumer's own document looks like (a formula? a
note pyramid? a maceration log?). **Budget the segments at 22.50 each at 720p/5s
— NOT the 36/45 in the spec table, which is the 1080p price** (§5 of the video
turn predates the measurement; 720p is ample for a ~940px-wide derive).

**2 — ⑳ WHITETHORN, the Day-84 handoff MOVING (~68cr, 3 takes).** His third
s105 message: *"can you also apply that motion to the site A and site C too?"*
⑳'s is the payoff — the page spends six chapters measuring a limp evening out
and **never once shows the dog walking**. Start frame = the pinned Day-84 still,
end frame = the same dog mid-stride. **One honesty constraint the others do not
carry:** it depicts a clinical outcome, so the Day-84 state must match what the
instrument says — a sound, even trot, never a bounding hero-dog — and `/guide`
discloses it. **A video that over-claims the recovery would undo the exact
honesty (the Day-12 dip) the page was praised for.** ⚠ **Check ⑳'s keyframes
are mutually registered BEFORE minting any segment** — that is precisely what
bit ㉑, and ⑳ has never been measured.

**3 — THE THALON LANDING PAGE**, the capstone. A, B and C complete *including
their generated moments*, so the landing inherits a proven scrub component and
three finished pages — *"rather than just mock."* NOT a portfolio site. Stealth
unchanged; **where it is served and under what name is his separate call.** Mint
budget **ring-fenced at 180cr and still intact.**

**4 — SITES D AND E**, on the leftover, **ONLY after the landing is finished.**
D = vineyard/winery (hero beat **veraison**) · E = a coffee **brand**, whose
**animation IS the page** (beans → grounds → pour as three acts top to bottom;
two chained transitions, middle frame minted once). **E's floor is ~75cr and D
can degrade to ~40.** With ~130 projected after the landing, **both now fit**
where the s105 stamp said only one would — the 720p price is the reason. **If
only one fits, build E.** Full brief: `docs/landing-arc/spec.md` §SITES D AND E.

**5 — PHASE 0** (~1hr): the seg shipped at s103 offers **Live — "Due posts go
out on their own"**, untrue while the queue's master key is empty and
**nothing in `apps/web` mentions `SOCIAL_QUEUE_ARMED`**. **Ship the DISCLOSURE,
not a door.** Arming from the UI is his sequence-gate call, NOT in scope.

**6 — CONTROL-ARC PART B**, which owes a DRAWN SHEET before any code
(DOCTRINE 0). Both MIT deps approved. Shaping finding banked in
`docs/control-arc/spec.md`.

**CARRIED, recorded not fixed:** Schedule's month-density chips clip their own
text · the Intel **dossier-absence REASON does not reach the wire** (a
contract-window ask) · Intel dismiss reversibility · the sweep schedule's
missing door · the add-chip's missing keyword path · **㉑'s July hydrangea reads
as a round mophead where the calendar names *Hydrangea quercifolia* (oakleaf,
conical)** — inherited from the s105 still, cosmetic, a landscape architect
would catch it.

**WAITING ON HIM — none blocking:** ㉑'s verdict (its `site.json` is still
loudly `awaiting`, now with the video pass in it) · **the casting reversal
inside it** — the studio's one human is an experienced WOMAN at the board, one
word to flip · the last un-spent vertical (**botanical perfumery**, and site C
is about to spend on it, so this is the cheapest moment to overrule) · the
Higgsfield **expiry date** (pacing aid only) · the three s101 staged design
calls. All on NEEDS-STEVEN.

▎ ▸ **The lesson, SEVENTH session running: RUN IT AND READ IT.** The
highest-severity find this session was invisible to types, lint and 3,452 tests
**and invisible on the still page too** — it took making the thing move. The
generalisation: *a defect can hide inside a transition you chose for its
softness.*
▎ ▸ **Traps worth keeping:** `next dev` at `localhost:3111`, **not started this
session — the portfolio serves off the 8899 preview unit instead** ·
**`npm run verify | tail` REPORTS TAIL'S EXIT CODE, not verify's — a pipeline
masks the gate; redirect to a file and echo `$?`** (cost a false green this
session) · **the Bash tool's cwd PERSISTS between calls — `cd` to the repo root
in the same command** (bit twice) · scripts need `set -a; source
apps/web/.env.local; set +a` · **`json.dump` escapes non-ASCII by default —
pass `ensure_ascii=False` or every em-dash becomes `—`** · chrome-devtools
`fill` does NOT reach React controlled inputs · **`html{scroll-behavior:smooth}`
silently defeats `window.scrollTo` in an evaluate — set `scrollBehavior='auto'`
first** · **NEVER edit nested SVG/HTML with non-greedy regex — index-slice on a
unique anchor instead** · **an SVG with `preserveAspectRatio="none"` and no
height keeps its intrinsic aspect and overflows its grid row** · **a stacked
frame that has not DECODED paints nothing — guard the swap or the stage goes
blank** · **seedance ignores `width`/`height`; resolution is the `resolution` +
`mode` params, and it defaults to 720p WITH audio** · vitest does NOT typecheck
(`npx tsc --noEmit -p apps/web` FROM THE REPO ROOT) · eslint runs from
`apps/web` · **portfolio sites trip the impeccable design hook — false positive
by construction** · vendor mint URLs expire in 30–60 min — **download and pin
immediately** · `packages/db` exposes `repos` as its ONLY query API.
▎ ▸ **⛔ SEQUENCE GATE, unchanged:** post = ARMED (founder GO s98); page still
409s at `POST /api/create`; bluesky is the one platform granted for live
testing; the queue consumer's key rests EMPTY. Two live posts total, both
bluesky. **This session spent 137.00 credits and posted nothing.**
▎ ▸ **Standing:** stealth · hermes-relay = founder · GATE ON EXIT CODE ·
verify-on-main = THE gate · rules 10/11/12 · platform logins live durably in
`.context` · no AGPL embedded · wrap = verify+commit+push+restamp.
▎ ▸ **State:** tree clean and main == origin (verified at wrap) · staging rolls
s93–s106 with the next auto-deploy · **no new migration this session** · four
social channels connected · dev PG live · 8899 preview + sweeper user units keep
running — NEVER hand-start the sweeper.
▎ ▸ **✅ SAFE TO CLEAR** — nothing in flight; no lanes; tree clean and pushed;
s107 boots on "gogogo" alone. **The PLAN is COORDINATION §s104** and
`docs/landing-arc/spec.md` is the spec of record — **sites A and B BUILT (B now
MOVING), C and the Thalon landing UNSTARTED.**

0. **Self-check** — tmux `thalon` · `pg_isready` · both user units (needs
   `XDG_RUNTIME_DIR=/run/user/$(id -u)`) · `git status` + this stamp · `npm run
   verify` before any new work.

CLAUDE.md → this file → COORDINATION.md (**§s106 = what shipped · §s104 = the
plan**) → `docs/landing-arc/spec.md` (**A + B BUILT; C and the capstone next**)
→ `proprietary/templates/meta-prompt.md` (**READ BEFORE ANY MINT — it gained
two corollaries this session**) → `proprietary/templates/sites/aspect-and-fall/`
(the precedent to copy, now including the scrub) → `docs/control-arc/spec.md`
(**A + A2 BUILT; B owes a SHEET**) → `docs/research/ux-refinement-program.md` →
agent_handoff/NEEDS-STEVEN.md → `docs/research/prior-art-portal-automation-s84.md`
(BEFORE ANY PORTAL WORK). `docs/video-arc/spec.md` is a CLOSED record.

## Delta (session 106)

The page that was already built is the one that taught the lesson.

㉑ shipped last session looking finished, and it was — as a still page. Adding
the motion the founder asked for did two things at once: it answered his
critique (the drawing no longer outranks the thing it describes; the photograph
leads at 63% where it held 24%, and it moves), and it **broke a claim the page
had been making all along**. The four photographs were captioned "the same
corner". Three of them were. The October frame was a different camera — a
measurable 24 pixels and more out of register — and the cross-fade that joined
them was soft enough to hide it for a whole session.

That is the transferable part, and it is sharper than the usual version of the
lesson. *Run it and read it* has been the finding for six sessions, but this
time running it was not enough: the still page ran fine and read fine. **The
defect only surfaced once the transition between two states became something the
reader controls.** A dissolve is a place where two images are allowed to
disagree. A scrub is not.

The second-order finding is the more useful one for the next site. The two
failed Jul→Oct segments were not badly prompted — they were **aimed at a bad
target**, and no amount of prompt language was going to fix a model
interpolating faithfully toward a misregistered end frame. Two takes went into
rewriting the prompt before the right question got asked, which was not *"why is
this segment wrong"* but *"what is it interpolating toward"*. Fix the keyframe,
not the video.

And the cheapest habit to carry: **measure, and mint two.** The re-minted
October's two candidates came off the same prompt with different seeds; one
landed within a pixel and the other reproduced the original 24px drift exactly.
Eyeballing would have picked either. A minute of arithmetic picked the right one.
