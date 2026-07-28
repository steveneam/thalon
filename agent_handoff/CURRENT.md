# CURRENT

## Stamp

2026-07-28 (session 81, syd4 — **zero credit spend**; FABLE 5 at boot, then the
founder set **Opus 5 (1M)** with `/model` before saying go). **THE EDITOR
BUILD-OUT IS FINISHED — every ratified step executed, both gates re-run rather
than trusted, and the two cheap provenance rows taken as well.** Final verify on
main: **2439 passed / 9 skipped, 0 lint errors** (2411 at the s80 close). Tree
clean, everything pushed, `main == origin/main`.

**THE TWO NUMBERS, START TO CLOSE.** Both were re-measured at boot before any
code (they reproduced the s80 stamp exactly) and re-run after every slice:

| gate | s81 boot | s81 close |
|---|---|---|
| **jobs** (`drive-surface.mjs --jobs editor`) | 14 works · **2 dead doors** · 10 no-affordance · 1 undriven | **21 works · 0 dead doors · 5 no-affordance · 1 undriven** |
| **render** (`measure-sheet.mjs`) | 10 missing · 38 drifted · **0 within ±2px** | **9 missing · 30 drifted · 9 within ±2px** |

**SLICE (d) WAS ONE DEFECT, NOT TWENTY — CONFIRMED BY MEASURING.** The sheet's
`.cop-box` is a div of doctrine text; the port made it a single-line `<input>`
and pushed that text into the placeholder, collapsing the band 79px → 60 and
shifting every band below by exactly 19. It also cost the **provenance promise
itself**: "never a silent change" vanished the moment the operator typed — the
one moment it is load-bearing — and was truncated by the input's width even
before that. The box is the sheet's box again, ask inside it, vow as visible
text. `.copilot` and `.player` are now within tolerance and the −19px cascade is
gone. The takes strip reserves its 110px band (an empty strip and an absent
strip are different things) and gained the **sideways Bounded-List rule its
sibling dossier surface already carried** — without which the new bed picker,
which renders into that same strip, would have shipped clipping 9 candidates.

**THE PLAYHEAD WAS A MARKER THAT POINTED AT THE WRONG SECOND.** Seeking *to* the
video already worked; playback never drove the marker back, and its CSS indexed
`.tl-body`'s padding edge rather than the lane track — 16px short. Invisible in
the sheet, because 0.34 there is a hardcoded fixture with no time behind it.
Both directions now share one geometry (the audit had independently prescribed
the same formula). `.lane-tr` also stopped overflowing its lane by 38px.

**THE MISSING VERBS.** *Swap the music bed* over the project's own candidates —
`patchMusic` only ever PATCHED a cue, so a silent cut could never acquire music
and a wrong bed could never be changed; no contract window, exactly as the
pre-plan ruled. A silent cut's lane said "no music lane on this EDL" as flat
text, true and a dead end on a project shipping seven beds; it is the way in
now. *Preview the working copy* — the same local ffmpeg against an **unsaved**
EDL. Three deliberate differences from the render door, each pinned by a test:
it takes the EDL from the caller, it does **not** refuse a non-draft cut (every
cut on this project is already rendered or approved, so draft-only would make
the verb useless exactly where it is wanted), and it **never** calls
`recordRender`. Its freshness is tied to **EDL object identity**, so any edit
invalidates it with no line to forget.

**BOTH DEAD DOORS CLOSED, AND THEY SHARED ONE CAUSE: a refusal only a mouse
could discover.** 16:9 was an `aria-hidden` span between two real buttons and
now routes to `lineage.parentCutId`. Refusals no longer *disable* — the control
stays focusable, says `aria-disabled` so AT announces it, and **answers with its
reason in the notice band when pressed**. Refusing is fine; refusing silently is
not.

**COPILOT HONESTY:** two of the four chips stopped needing the agent this
session, so *Swap music* and *Recut 9:16* run the local verbs instead of
spending a metered call to be refused; the two genuine asks say they spend, and
chips **append** rather than discarding a composed directive.

**PROVENANCE (the two cheap rows, both audit `high`):** every version now names
its author, and a derived cut states its parent and whether it has fallen
behind. It landed in the **timeline foot, not the header the audit suggested** —
the header is over-subscribed with real data, so one more line wrapped
`.t-headline` onto three lines and pushed every band down **85px**. Measured,
moved, re-measured back to zero. The foot is this surface's own versioning
sentence with the Cut-history door already in it.

**THE HARNESS WAS WRONG TWICE MORE, AND ONE OF THEM WAS FLAKY — WHICH IS WORSE
THAN FAILING.** (7) The copilot job pinned `input.cop-box`; when the box moved
back to the sheet's wrapper that would have read as "the chip has no ask field"
— a PRODUCT defect reported for a markup change. Now by role. (8) The playhead
job asserted the marker sits AT the lane origin — correct only while the
playhead never moved. Once playback drives it that is true at t=0 and false a
frame later, and the marker legitimately lags `currentTime` by one `timeupdate`
(~3.6px on this cut, over tolerance), so it **flipped ✓ / DEAD DOOR between
consecutive runs**. It now pauses, seeks to the midpoint and checks the marker
against where the cut actually is: four consecutive runs agree at **x=703 =
laneX 341 + 0.5 × 724**. Stronger, not looser — at the origin a wrong SCALE is
invisible, halfway through it is not, and the original 16px bug still fails it.
The music-swap job was also widened to read the **accessible name** rather than
`textContent`: a verb living in `aria-label` read as absent and one living only
in a `title` reads as present to nobody.

**DRIVING THE VERB FOUND A BUG IN THE VERB'S OWN DEFINITION.** `musicCandidatesFor`
filtered on "every slotless take" and offered
`motion/experiments/seedance-assembly-experiment-s43.mp4` — a silent video
experiment — as a music bed. Slotlessness is a *consequence* of being a
candidate, never the definition; the import's own marker is the path segment.
Pinned by a test, along with the near-miss (`music-candidates-old-rejects/`).

**TWO THINGS THE MERGE GATE CAUGHT THAT A TARGETED TEST RUN DID NOT** — both
instances of the standing lesson that **vitest does not typecheck and does not
lint**: an incomplete `attribution` fixture (the contract requires an
agent-authored cut to carry its whole replayable proposal), and
`setState`-in-effect for the pinned clock, which belongs in the load's own
resolution — the dossier's pattern, and it also avoids reading the wall clock
during a render (the s80 red-by-night lesson).

## Resume prompt (session 82, syd4 — "gogogo" boots this)

**Resume · Thalon** — the editor is DONE to its ratified scope. s82 is the
founder's call; the strongest candidates are below, none of them started.

**Read first:** CLAUDE.md → this file → `docs/research/video-editor-audit-s78.md`
(the 36 findings; the remaining ones are `medium`/`low` and named below) →
`docs/research/jobs-table-s79.md` (the harness's own bug ledger — READ BEFORE
TRUSTING A VERDICT; it now records **eight** wrong selectors, two added by s81).

0. **Self-check** — tmux `thalon` · `pg_isready` · both user units · dev 3111 ·
   `git status` + this stamp. **No open founder calls.**

**THE FIVE NO-AFFORDANCE ROWS THAT REMAIN**, in the harness's own words. Four of
the five are one theme — VERSION MANAGEMENT — and would make a coherent slice:
- **compare two versions** to see what changed between v6 and v7 (`Cut history →`
  leads to a version strip with authorship, not a diff)
- **save as a NAMED variant** instead of the next version of the same name (the
  primary button hard-codes `cut.name`)
- **delete a bad version** or an abandoned derived cut
- **check on a render after coming back** — the job poll starts fresh, so a
  render running when you navigate away is invisible when you return
- **tell candidate takes apart and watch one before swapping** — they now NAME
  their file (s81) but still cannot be previewed before you commit the swap

**ALSO OPEN, smaller:** the s78 `medium`/`low` tail not folded in this session —
"Remove easing" destroys tail values with no undo · a proposal on the caption or
music lane is marked by border colour alone · judge refusals name caption lines
that carry no timeline mark · the player has no failure state and no way out of
it · one shared `busy` flag makes two unrelated controls both claim to be
running · raw float duration prints where the sheet reserved 8 characters.

▎ ▸ **The render gate's remaining 30 drift rows are EXPLAINED, not unexamined.**
About ten are the sheet's `.prop-row` band, which the app renders only when a
proposal is pending — a **metered** call the sequence gate forbids, so it cannot
be driven; roughly ten more are topbar rows where the app carries real names and
counts wider than the fixture's; the rest are the named ruler/scroll adaptation
and real caption timings. `.cresc` stays deliberately undrawn: nothing measures
crescendos and drawing them would be an invented fact.
▎ ▸ **Known-and-stated gaps, unchanged:** the browser BACK button is not guarded
(a history pop cannot be cancelled without a decoy entry that corrupts the back
stack); `lib/workspace/pipeline.ts`'s `kanbanColumns` is still an orphan, left
visible per the s75 precedent.
▎ ▸ **Three design-hook findings on `editor.css` remain FALSE POSITIVES, no
suppression added (same verdict as s80):** `.play-tri` and `.playhead::before`
are the CSS border-triangle technique drawing the play glyph and the playhead
arrow — geometry, not card accents — and they are byte-true sheet values.
▎ ▸ **State:** main = origin, all pushed · verify **2439 passed / 9 skipped, 0
lint errors** · budget 2M · balance 584.12 · **zero spend s81**.
▎ ▸ ⛔ **THE SEQUENCE GATE, unchanged:** *"we're not posting anything yet until
all the walks are verified and fixed."* No publish path, no platform call, no
token-spending generation without his GO. The copilot's Propose and the judge
behind Send-cut-to-Approve SPEND — the jobs measure reachability and say so.
**The working-copy preview is LOCAL compute and was built inside that line.**
▎ ▸ **Standing:** stealth · hermes-relay = founder · blanket workspace grant ·
**every lane/subagent launch needs fresh founder approval** · **GATE ON THE
SUITE'S EXIT CODE — never pipe it into anything** (it earned its keep again: a
green-looking run exited 2 on a typecheck error and 1 on a lint error) ·
**vitest does NOT typecheck and does not lint** · verify-on-merged-main = THE
gate, plus a MEASURED render, plus DRIVE the surface, plus watch the console ·
a LANE CANNOT SCREENSHOT OR DRIVE ITS OWN WORK · wrap = verify+commit+push+restamp.
▎ ▸ **✅ SAFE TO CLEAR** — nothing in flight; tree clean and in sync with origin.

## Pointer

CLAUDE.md → this file → `docs/research/video-editor-audit-s78.md` →
`docs/research/jobs-table-s79.md` → `docs/research/video-editor-PREPLAN-s80.md`
(the contract-window ruling, now executed) →
`.claude/skills/thalon-check/SKILL.md` → COORDINATION.md → NEEDS-STEVEN.md.

## Delta (session 80)

s80 measured both editor gates for the first time and merged three slices — the
safety core (undo + exit guard + honest player), the blocker (keyboard-reachable
timeline blocks), and the missing verbs (insert/delete a beat and a caption). It
ruled the contract window NO on evidence, built `measure-sheet.mjs`, and caught
main-red #5: a calendar test that was green by day and red after ~19:00 local.

## Next action — s82: founder's call. Strongest candidate is the VERSION-MANAGEMENT slice (compare · name a variant · delete a version), which is four of the five remaining no-affordance rows in one coherent piece.
