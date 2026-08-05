# CURRENT

## Stamp

2026-08-05 close of session 108 (syd4 — boot was `gogogo`).
Wrap verify on main: **exit 0, 3454 passed / 9 skipped** (3453 → 3454: the
static-stack ratchet, generalised off the manifest).

**One substantive commit.** ⑳ **Whitethorn's Day-84 handoff MOVES.** **The check
that matters is not the sha but the state: tree clean, main == origin, verify
exit 0, all confirmed at wrap.**

**⚠ THE BLOCKER IS GONE. THE CAPSTONE IS NEXT:**
⑳ ✅ built, approved, **now moving** → ㉑ ✅ built and moving → ㉒ ✅ built and
moving → **THE THALON LANDING PAGE ← THE NEXT ACTION** → then **D (vineyard) and
E (café/coffee) on leftover credit.**

Zero live posts, nothing armed, the queue consumer's master key still EMPTY.
**Credits: 361.72** (spent 17.50, reconciled live). **The 180cr ring-fence for
the Thalon landing is UNTOUCHED — and the leftover is now ~181.72, not the ~109
the spec projected, because every site landed far under its line.**

## WHAT SHIPPED — the page finally shows the dog walking

▎ **Six chapters measuring a limp evening out, and the page never once showed
him walk.** Now the instrument hands off to a photograph that **moves**: 61
stills scrubbed by the same scroll that drives the gait study. **One clock read
twice** — no timer, no autoplay, no second rAF loop — so the added motion spends
the site's stated motion budget rather than breaking it.

▎ **THE SPEC'S CONSTRUCTION WAS WRONG, AND THE REPO'S OWN COROLLARY SAID SO.**
The arc spec scheduled ⑳ as `start_image` = the pinned Day-84 still, `end_image`
= "the same dog mid-stride". ㉑'s seasons and ㉒'s bloom are **one-way
transformations** where an end frame is a genuinely different picture — but **a
trot is a CYCLE**, and its last frame looks like its first. That `end_image`
would have bought a near-duplicate of the start frame at s106's registration
coin-flip (~50% of seeds drift). Built as a **single `start_image` with no
`end_image`**: zero registration risk *by construction*, one already-approved
asset, **first take, 17.50cr against a ~72cr line**. s107 said *the cheapest
registered edit is the one you never make*; cyclic motion goes one further —
**there is no second endpoint to mint at all.**

▎ **The honesty constraint drove the PROMPT, not the review.** Day 84 reads 0/5
lameness and 94% symmetry, so the brief named the failure modes as explicit
negatives (not galloping, not bounding, feet low, never all four airborne) and
landed a sound even trot first take. **The pinned still turned out to already BE
a trot** — the only thing over-claiming was its alt text ("running at full
stretch"), now corrected. `/guide` discloses the generation and the constraint.

## THE FIND — the count passed, and the scrub was still wrong

▎ **s107 learned to COUNT the lit frames. s108's correction: a count proves a
scrub is ALIVE, it does not prove it is AIMED.** The new ratchet passed
perfectly — 61/61 decoded, exactly one lit at every sampled position, strictly
monotonic 0→60. A **visibility-bucketed** sweep then showed the sequence was
mis-mapped: across the band's full centre travel, frames 0 and 60 sat at the
clamps, and **34 of 61 frames — over half the shipped bytes — were only
reachable while the band was under half on screen.** In the prime window the
reader saw frames 17–43 and nothing else. Ending the sweep a sixth of a viewport
early at each end moved that to **10–50, 33 distinct frames.** *The invariant
check and the aim check are different questions, and only the first has a
ratchet.*

▎ **Three more, all measured, none visible in source:** **frame density is set
by the CAMERA, not by precedent** — ㉑ ships 18/sequence and ㉒ ships 36, but both
are *locked-off*; this take **tracks**, so adjacent-frame difference measured
**9.24 at native 24fps against the bloom's 1.26**, and 36 would have been
visibly steppy (shipped 61) · **the vendor answered the literal call with a
preset suggestion and NO job** — nothing rendered, nothing charged, but a build
assuming the mint was running would have waited on a job that did not exist ·
**`close.webp` is deleted, not orphaned** — trot-00 measured 6.41 against it,
less than one adjacent-frame step, and the bijection is manifest↔disk so dead
weight would have passed every ratchet silently.

## The ratchets this session bought

**Executable:** the s107 static-stack check keyed off an inert JSON data block,
so it covered ㉒ alone and **⑳'s stack would have shipped uncovered** (*"a ratchet
applied to three assets out of four is not applied"*). It now keys off the
**manifest** — which every site has — and counts lit frames **per sequence**, so
a two-sequence page cannot pass by lighting two of one and none of the other. ㉑
is skipped by design (runtime-built frames behind a `.still` fallback).
**Proven to FAIL on both real defects — a second lit frame, and a missing frame
— before it was trusted.**
**Documentary:** three corollaries in `proprietary/templates/meta-prompt.md`
(**READ BEFORE ANY MINT**) — cyclic motion has no end frame · a count proves
ALIVE not AIMED · frame density is set by the camera (plus the preset-interception
trap). A **correction block in `docs/landing-arc/spec.md`** on the keyframe pair,
written there because **site E's pour is cyclic too**.

## Resume prompt (session 109, syd4)

**Resume · Thalon** — nothing is mid-flight. **The plan is COORDINATION §s104
(the PLANNED block), minus what shipped.**

**⚠ Open with the meta-prompt in hand.** It gained three corollaries this
session, and the landing page is the most expensive thing in the arc to get
wrong.

**1 — THE THALON LANDING PAGE. THE CAPSTONE, AND IT IS NOW UNBLOCKED.** A, B and
C are complete *including their generated moments*, which was his stated
precondition — *"so that way, you have the full landing page to learn from
rather than just mock."* It inherits a **proven scroll-scrub component** and
three finished pages. **NOT a portfolio site:** the portfolio sells fictional
businesses to imagined customers; this sells Thalon to people who will actually
land on it, and **it must be honest about what the engine does TODAY.** Mint
budget **ring-fenced at 180cr, still intact**. Stealth unchanged — **where it is
served and under what name is his separate call**, and building it does not
decide it. Per standing method the **claude-design mock runs in FRONT of the
pre-plan** (both, never either). Which of the three instruments becomes the
landing's spine *cannot be decided from the spec* — that is decided by having
built them, which is the whole reason for this order.

**2 — SITES D AND E**, after the landing. **The arithmetic improved a lot:**
every site landed under its line (2.40 + 13.00 + 35.00 + 17.50 = **67.90 total**
against ~262 allocated), so the leftover after the ring-fence is **~181.72, not
the ~109 the spec projected** — **both now fit at lean-to-full scope** rather
than one-or-the-other. D = vineyard (hero beat **veraison**; **its secondary axis
is an OPEN DRAW** — C took exceptional-palette) · E = a coffee **brand**, whose
**animation IS the page**. **If only one fits, still build E.** ⚠ **Read the s108
correction first:** D's veraison is a one-way transformation, E's beans→grounds→
pour is correctly two chained segments — **but the pour itself is cyclic**, so
ask which kind each motion is before reaching for a keyframe pair. Full brief:
`docs/landing-arc/spec.md` §SITES D AND E.

**3 — PHASE 0** (~1hr): the seg shipped at s103 offers **Live — "Due posts go
out on their own"**, untrue while the queue's master key is empty and **nothing
in `apps/web` mentions `SOCIAL_QUEUE_ARMED`**. **Ship the DISCLOSURE, not a
door.** Arming from the UI is his sequence-gate call, NOT in scope.

**4 — CONTROL-ARC PART B**, which owes a DRAWN SHEET before any code
(DOCTRINE 0). Both MIT deps approved. Finding banked in `docs/control-arc/spec.md`.

**CARRIED, recorded not fixed:** ㉒'s **mobile vertical rhythm is airier than it
should be** — a chapter heading clears the pinned sheet at some scroll positions
and not others, so a reader can meet a paragraph before its title; every
correctness invariant holds there, so this is ergonomics and it is the first
thing a fix round should buy · Schedule's month-density chips clip their own
text · the Intel **dossier-absence REASON does not reach the wire** (a
contract-window ask) · Intel dismiss reversibility · the sweep schedule's
missing door · the add-chip's missing keyword path · **㉑'s July hydrangea reads
as a round mophead where the calendar names *Hydrangea quercifolia*** (oakleaf,
conical) — cosmetic, inherited from s105.

**WAITING ON HIM — none blocking:** **⑳'s moving band** — the design verdict is
his and STANDS (`gogogo design is approved`, s105); the walk is the one part of
that page he has not seen · ㉒'s verdict (`site.json` is loudly `awaiting`) ·
㉑'s verdict, and **the casting reversal inside it** — the studio's one human is
an experienced WOMAN at the board, one word to flip · the Higgsfield **expiry
date** (pacing aid only) · the three s101 staged design calls. All on
NEEDS-STEVEN.

▎ ▸ **The lesson, NINTH session running, and it moved again: RUN IT, MOVE IT,
COUNT IT — then check WHERE the count lands.** s105 said render it. s106 said a
still page hides what a scrub exposes. s107 said a moving page hides what only a
count exposes. **s108: a passing count hides whether the motion is AIMED** — the
scrub was alive, monotonic and correct, and was spending half its bytes off the
edge of the reader's eye.
▎ ▸ **Traps worth keeping:** **CYCLIC motion (a gait, a pour, a spin, a flame)
has NO end frame to mint — one `start_image`, no `end_image`** · **frame density
is set by the CAMERA: a panning take needs ~3× the frames of a locked-off one,
measure adjacent-frame difference against a sequence that reads well** · **the
vendor may answer `generate_video` with a PRESET SUGGESTION AND NO JOB — re-send
with `declined_preset_id` and confirm a job id** · **the vendor SUBSTITUTES the
model — record what RAN (`seedance_2_0_fast`), not what you requested, or
`/guide` lies** · **a stacked `<img>` scrub needs its "shown" index SEEDED FROM
THE DOM — starting at `-1` strands the markup's initial frame lit and it
composites over everything** · **`margin:0 auto` on a GRID ITEM shrink-wraps it —
add `width:100%`** · **an rAF-scheduled scroll handler has NOT run when you read
the DOM straight after `scrollTo` — await two frames** · **seedance ignores
`width`/`height`; resolution is `resolution`+`mode`, defaults to 720p WITH audio,
and 720p/5s/fast/silent = 17.50cr** · `npm run verify | tail` REPORTS TAIL'S EXIT
CODE — redirect to a file and echo `$?` · `pgrep -f <pattern>` MATCHES ITS OWN
COMMAND LINE — use `pgrep -x` · the Bash tool's cwd PERSISTS between calls ·
scripts need `set -a; source apps/web/.env.local; set +a` ·
`html{scroll-behavior:smooth}` silently defeats `window.scrollTo` in an evaluate
— set `scrollBehavior='auto'` first · chrome-devtools `fill` does NOT reach React
controlled inputs · vitest does NOT typecheck (`npx tsc --noEmit -p apps/web`
FROM THE REPO ROOT) · eslint runs from `apps/web` · **portfolio sites trip the
impeccable design hook — false positive by construction** · vendor mint URLs
expire in 30–60 min — **download and pin immediately** · `packages/db` exposes
`repos` as its ONLY query API.
▎ ▸ **⛔ SEQUENCE GATE, unchanged:** post = ARMED (founder GO s98); page still
409s at `POST /api/create`; bluesky is the one platform granted for live
testing; the queue consumer's key rests EMPTY. Two live posts total, both
bluesky. **This session spent 17.50 credits and posted nothing.**
▎ ▸ **Standing:** stealth · hermes-relay = founder · GATE ON EXIT CODE ·
verify-on-main = THE gate · rules 10/11/12 · platform logins live durably in
`.context` · no AGPL embedded · wrap = verify+commit+push+restamp.
▎ ▸ **State:** tree clean and main == origin (verified at wrap) · staging rolls
s93–s108 with the next auto-deploy · **no new migration this session** · four
social channels connected · dev PG live · 8899 preview + sweeper user units keep
running — NEVER hand-start the sweeper.
▎ ▸ **✅ SAFE TO CLEAR** — nothing in flight; no lanes; tree clean and pushed;
s109 boots on "gogogo" alone. **The PLAN is COORDINATION §s104** and
`docs/landing-arc/spec.md` is the spec of record — **A, B and C ALL BUILT AND
ALL MOVING; the capstone is the next action.**

0. **Self-check** — tmux `thalon` · `pg_isready` · both user units (needs
   `XDG_RUNTIME_DIR=/run/user/$(id -u)`) · `git status` + this stamp · `npm run
   verify` before any new work.

CLAUDE.md → this file → COORDINATION.md (**§s108 = what shipped · §s104 = the
plan**) → `docs/landing-arc/spec.md` (**A+B+C BUILT AND MOVING; read the s108
CORRECTION block on the keyframe pair and the s107 one on the D axis**) →
`proprietary/templates/meta-prompt.md` (**READ BEFORE ANY MINT — three new
corollaries**) → `proprietary/templates/sites/whitethorn/` (the newest precedent;
its PREPLAN carries the s108 finds) →
`proprietary/templates/sites/small-hours/` → `docs/control-arc/spec.md` (**A + A2
BUILT; B owes a SHEET**) → `docs/research/ux-refinement-program.md` →
agent_handoff/NEEDS-STEVEN.md → `docs/research/prior-art-portal-automation-s84.md`
(BEFORE ANY PORTAL WORK). `docs/video-arc/spec.md` is a CLOSED record.

## Delta (session 108)

The blocker is gone, and the thing that found the defect was not the thing that
was supposed to find it.

⑳ Whitethorn spent six chapters measuring a limp evening out and never once
showed the dog walking. It does now, and it cost one take — because the spec's
own instruction to mint a second keyframe was wrong. A trot is a cycle, not a
transformation: its last frame looks like its first, so the "end frame" the plan
called for would have been a near-duplicate of the start, bought at a fifty-fifty
registration risk. One start frame, no end frame, first take, 17.50 credits
against a seventy-two credit line.

Then the ratchet passed — sixty-one frames decoded, exactly one lit at every
sampled position, strictly monotonic from zero to sixty — and the scrub was still
wrong. Mapped across the band's full travel, more than half the frames were only
reachable while the band was mostly off the screen, and a reader looking straight
at it saw a third of what had been shipped. Nothing failed. Nothing could have
failed, because "exactly one frame is lit" and "the frames are landing where
someone is looking" are different claims, and only the first one had a test.

That is the ninth session running that the finding has been a version of *run it
and read it*, and it has now sharpened three sessions in a row. s106: a still
page hides what a scrub exposes. s107: a moving page hides what only a count
exposes. s108: **a passing count hides whether the motion is aimed.** Each time
the previous session's answer became the next session's blind spot — which is
the actual pattern worth carrying, more than any one of the checks.
