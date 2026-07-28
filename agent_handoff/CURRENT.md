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

**Resume · Thalon** — s82 = **EXECUTE THE THREE-LANE PLAN. THE LAUNCH IS
ALREADY APPROVED** — the founder took the lead's recommendations on all four
calls at the s81 close ("I'll go with your recommendations"), and call #1 was
the named-lane approval, so the boot goes STRAIGHT to pre-flight + launch, no
re-ask. Plan of record: **`docs/research/s82-PREPLAN.md`** (§3 records the
decisions). The **B-dist DISTRIBUTION CHARTER is RATIFIED → ADR 0012**
(`docs/research/distribution-charter.md`; founder s81: "ratify the charter,
and go with your recommendations on the rest") — connector seam s83 ·
closed-loop analytics · composer parity · REDESIGN PHASE 4/5's four sheets
(design wave starts AFTER s82, his adopted recommendation). NOTHING is open
for him at the boot — all calls decided; "gogogo" goes straight to work.

**Read first:** CLAUDE.md → this file → `docs/research/s82-PREPLAN.md` →
COORDINATION.md §s82 → `docs/research/jobs-table-s79.md` (the harness ledger —
eight wrong selectors on record; READ BEFORE TRUSTING A VERDICT).

0. **Self-check** — tmux `thalon` · `pg_isready` · both user units · dev 3111 ·
   `git status` + this stamp. **No open founder calls** — the four s82 calls
   AND the charter ratification all closed s81 (NEEDS-STEVEN 2026-07-28d).
1. **PRE-FLIGHT, lead-direct, FREEZE FIRST:** W1 = the small contract window
   (`publishQueue` repo over the existing dormant table · `videoCuts.remove`
   with the call-#2 refusals · platform capability matrix in contracts) via the
   contract-window skill; W2 = the shared `TakeAudition` component with its own
   namespaced stylesheet. Both merged green before any lane launches.
2. **LAUNCH the approved lanes** (Mode B, `scripts/launch-lane.sh`, strongest-
   tier pin, kickoffs name file ownership verbatim from the plan):
   **editor-verbs** (version management + editor.tsx tail) ·
   **editor-polish** (the s78 medium/low tail B1–B10) ·
   **sched-spine** (capability matrix + queue producer/consumer, DISARMED).
3. **Merge gates, unchanged and lead-owned:** verify-on-merged-main BY EXIT
   CODE · drive the jobs (extend the tables with the new verbs: compare · named
   save · delete + refusals · resume-poll · audition ×2 · schedule · fit line) ·
   measure the render · read the screenshots. A lane cannot drive its own work.

▎ ▸ **Postiz, two lines:** AGPL-3.0 — patterns re-implemented, never code; the
s82 take is finishing OUR half-built queue (table exists, both ends missing).
The founder-directed DEEP DIG (s81 second half) is plan §1b — the integration
secret is one provider interface + one hardened base + one generic OAuth dance,
NOT the auth folder — and §4 is the recommended s83 headline: the CONNECTOR
SEAM, proven by adding Reddit + Bluesky (no review wall on either).
▎ ▸ **Editor state after s81:** jobs 21 works · 0 dead doors · 5 no-affordance ·
1 undriven(metered); render 9 missing · 30 drifted · 9 within ±2px, all
explained (≈10 rows = the proposal band, needs a metered call). The five open
rows are exactly what lane editor-verbs + the audition seam close.
▎ ▸ **Known-and-stated gaps, unchanged:** browser BACK unguarded · `kanbanColumns`
orphan stands · the three editor.css design-hook findings remain FALSE POSITIVES
(border-triangle technique, byte-true sheet values).
▎ ▸ **State:** main = origin, all pushed · verify **2439 passed / 9 skipped, 0
lint errors** · budget 2M · balance 584.12 · **zero spend s81**.
▎ ▸ ⛔ **THE SEQUENCE GATE, unchanged:** *"we're not posting anything yet until
all the walks are verified and fixed."* No publish path, no platform call, no
token-spending generation without his GO. sched-spine ships DISARMED — queue
rows sit pending; arming + per-platform GO + per-post GO all still his.
▎ ▸ **NEW STANDING RULE (founder s81, ratcheted): RESEARCH BEFORE BUILD.**
Before any capability charter/plan and before ANY plan assigning the founder
manual work, run the box `prior-art` skill (`~/.claude/skills/prior-art/`) —
AGENTS.md build rule 10; ADR 0012 carries the record; a founder-manual step in
a plan is a DEFECT until research proves no better path exists.
▎ ▸ **Standing:** stealth · hermes-relay = founder · blanket workspace grant ·
**every lane/subagent launch needs fresh founder approval** (his call #1 covers
exactly the named lanes) · **GATE ON THE SUITE'S EXIT CODE — never pipe it** ·
**vitest does NOT typecheck and does not lint** · verify-on-merged-main = THE
gate + MEASURED render + DRIVE the surface + watch the console · a LANE CANNOT
SCREENSHOT OR DRIVE ITS OWN WORK · **no AGPL code embedded, ever** — Postiz is
reference-only · wrap = verify+commit+push+restamp.
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

## Next action — s82: boot straight to W1 window + W2 seam (lead, freeze first) · launch the three APPROVED lanes (editor-verbs + editor-polish + sched-spine) · lead-owned merge gates. Charter ratified (ADR 0012); D4 design wave queues after this session's wrap; D1 connector seam = the s83 headline.
