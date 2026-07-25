# WRAP — lane `approve-rebuild` (exact-mock rebuild: the Approve surface)

Branch `agent/approve-rebuild`, two commits, worktree clean. The surface is
a PORT of `docs/research/mock-sheets/Approve.dc.html` — the sheet's own
markup and helmet atomics, its shared classes taken from `workspace.css`
read-only, wired to the existing `lib/approve-queue/*` clients with no API
or contract change and zero spend.

## The two commits

| step | commit | what |
|---|---|---|
| 1 — pure port | `1d53988` | The sheet's markup React-ized with its OWN placeholder content + `components/approve/approve.css` (helmet atomics verbatim). No data, no behaviour. **This is the structural verdict point** — check it out and screenshot it against the sheet with nothing of the old design in the frame. |
| 2 — wire + keepers | (this commit) | Real data, honest states, keepers woven in, old surface deleted, pins burned down. |

## Keepers woven back in (each named)

- **Approve keys — a approve · r reject · e edit, confirms intact.** j/k walk
  the view via the shared `useListKeys` grammar; `a` acts only on a QUEUED
  draft; `r` goes through the same named `window.confirm` the button uses, so
  keyboard triage never skips a confirm; `e` opens the editor in the draft
  card with Escape-cancel (allowed even from inside the textarea). The
  sheet's own footer rail is the legend: `j k row · a approve · r reject ·
  e edit`. Pinned in `__tests__/keyboard-triage.test.tsx`.
- **Bulk bar → the sheet's own bulk action.** The sheet draws
  "Approve all waiting (3)" in the header band, so the keeper re-enters as
  THAT button rather than a second bar: one named confirm carrying the
  count, acts on every queued draft in the CURRENT VIEW in view order, stage
  artifacts excluded (they advance through their own staged walk), stops
  loudly on the first failure. Pinned in `__tests__/batch-approve.test.tsx`.
- **Action toast.** `components/workspace/action-toast.tsx` unchanged and
  still mounted — approve/reject/batch fire it on SUCCESS only.
- **Judge-verdict provenance, reasons verbatim.** The sheet's checks band is
  the resting chrome (`✓ Denylist · ✓ Grounding — screen · ✓ Grounding —
  final · ◐ Discoverability …`); `reasons on record →` is the door to the
  per-gate receipt with every recorded claim + evidence line VERBATIM. A
  blocking failure opens the receipt without a click — a block must state
  its reason. The composite blocks (tier disagreement, exemplar overlap)
  keep their operator-copy rule, which no single gate row can show.
- **Fail-closed approve.** While any blocking check fails, Approve and
  Reject are ABSENT (not greyed) and the action rail says why; Edit and
  Re-judge stay as the ways forward.
- Also carried: `?run=`/`?draft=` deep-link consumption, waiting-work-first
  default selection (run-count scoped), the count-agreement invariant,
  post-action refresh + pulse nudge, the stale-fetch guard, staged-flow
  swap for stage artifacts, zero-inbox, and the whole `FormatDetail` family
  (clip plan / demo plan / web page / outreach email / exemplar provenance)
  — REBUILT in the sheet's classes rather than deleted, so the outreach
  copy-out door and the web_page deploy truth survive the demolition.

## New in this surface (from the sheet + the doctrines)

- **Media-first placeholders.** Drafts carry no media ref on the wire, so
  every media slot is honestly the sheet's striped placeholder naming what
  belongs there (`clip frame`, `page hero`, `demo capture`, `storyboard
  frame`) — row `.thumb-sm` and detail `.thumb-md`. Text-only formats get
  no slot at all, exactly as the sheet draws its two plain post rows.
- **Attributed version strip** (VISIBLE PROVENANCE, plan §5 doctrine 4b),
  derived honestly from the judge's own record: each distinct `bodyHash`
  the judge ran on is a version, ordered by first verdict. v1 = engine
  draft; a later version exists only because the operator edited; the strip
  states whether the judge re-ran on the current one.
- **Discoverability on the checks band** as an ADVISORY warning (◐, amber),
  never a block, with the draft's declared `meta.targetTerms` in its
  tooltip. `cadence` is deliberately NOT advisory — a failing cadence gate
  transitions the draft to `blocked`, so it wears the blocking ✗.
- **The invariant in operator copy** on the source line: *the judge gates —
  it never rewrites*.

## ⚠ Cross-lane hazard found — worth propagating to every rebuild

**A "surface-scoped stylesheet" is still a GLOBAL stylesheet**, and the
sheets deliberately reuse helmet class names with DIFFERENT values across
surfaces:

| class | Approve.dc.html | elsewhere |
|---|---|---|
| `.split` | `grid-template-columns: 600px 1fr` | Leads.dc.html: **480px 1fr** |
| `.ver-strip` | one-line strip, `align-items: center` | Video Dossier.dc.html: **stretch row**, different padding |

Two rebuilt surfaces would silently fight over those names, resolved by
whatever order Next happens to emit the CSS — and the loser renders at the
wrong column width with nothing failing. So every rule in `approve.css` is
anchored under a surface root, `.approve-surface`, applied to the surface's
`.content` div. **The markup still carries the sheet's own class names
byte-for-byte** — only the selectors are anchored, so the port stays a port.
Recommend the same anchor for Intel and every surface after it (and for
Leads/Video Dossier specifically, it's load-bearing, not hygiene).

## Named app adaptations (all in `approve.css`, none silent)

Real data is longer and wider than the canvas fixture. Every deviation is
commented in the stylesheet beside the verbatim block:

1. `.q-scroll` / `.draft-scroll` — the sheet leaves the row region and the
   detail column `overflow: hidden`; a real queue and a real body scroll
   INSIDE their card (the Bounded-List Rule) instead of clipping or growing
   the page. NOT `workspace.css`'s `.card-rows`: that adaptation is a
   `max-height: 260px` box for the dashboard's needs-you card, and this
   sheet's cards FILL the split's height — same rule, different geometry,
   so it lives in the surface's own stylesheet.
2. `.split > * { min-width: 0 }` and `.q-row .q-title/.excerpt` — nowrap
   titles/excerpts otherwise blow the 600px column out.
3. `.q-row.q-btn` — the sheet's rows are `<div class="row">`; a real row is
   a BUTTON (click + keyboard + `aria-pressed`). Compound selectors so the
   sheet's border/padding/hover/`.row.sel` treatment wins regardless of
   stylesheet order, plus a focus-visible ring that is invisible at rest.
4. `.sel-ctl` + `.sel-native` — the two picker chips keep the sheet's
   markup byte-for-byte with a transparent native `<select>` over them, so
   they are genuinely operable (keyboard, screen reader, platform menu)
   without a re-drawn popover.
5. `.check-err` — the sheet draws pass (green) and advisory-warn (amber);
   a BLOCKING failure is the third state its fixture never had to show.
   Same for the checks band's wash: red on a blocking failure, neutral
   while a gate is undecided, the sheet's green otherwise. The band must
   never read green over a failure.
6. `.fmt-*` — the format-detail block, rebuilt in the sheet's type roles.
   Absent entirely for a plain post, so the resting detail stays byte-true.
7. `.draft-editor` — the `e`-key editor takes the body's own slot and type.

## Deletions

`components/approve/`: `approve-queue.tsx` · `approve-panel.tsx` ·
`queue-list.tsx` · `judge-verdicts.tsx`.
`__tests__/`: `approve-consent` · `approve-queue` · `queue-states` ·
`zero-inbox` · `judge-verdicts` (every behaviour they pinned is re-pinned
against the rebuilt DOM — see test deltas).
KEPT deliberately: `judge-badge.tsx` — it is the STAGED flow's badge
(`components/staged/staged-flow.tsx` imports it), not approve chrome.
No workspace helper died with the old surface: `action-toast.tsx` and
`bulk-bar.tsx` are shared with leads/library/intel.

## Pin deltas

- `lib/__tests__/bridge-burndown.test.ts` — the five approve rows removed
  (`approve-panel` 36 · `approve-queue` 11 · `format-detail` 25 ·
  `judge-verdicts` 11 · `queue-list` 16 = **99 bridged tokens burned**).
  All six new/rebuilt approve files enter at ZERO.
- `lib/__tests__/mono-ratchet.test.ts` — four approve rows removed
  (`approve-panel` 6 · `approve-queue` 1 · `judge-verdicts` 1 ·
  `queue-list` 4 = **12 burned**); the dashboard comment now covers both.
- `lib/workspace/__tests__/selected-row.test.ts` — `approve/queue-list.tsx`
  left the list; the rebuilt rows mark selection with the sheet's `.row.sel`.

## Test deltas

New: `__tests__/approve-surface.test.tsx` (12 cases — the sheet's bands,
row grammar, blocked reason verbatim, fail-closed rail, queued rail +
seats, sort/filter re-cut, `?run=` deep link, waiting-work-first default,
failed queue read = alert + retry, failed detail read, inbox zero,
empty-vs-filtered-empty, media-first placeholder) and
`__tests__/approve-model.test.ts` (17 cases — platform/format/thumb/stamp
grammar, the queue view, the version strip, the checks band incl. the
advisory ◐, cadence-blocks, invariant I1, malformed-evidence fallback).

One test-fixture correction worth knowing: `operator-actions`' post-edit
mock returned ONLY the new body's judge rows. The real read returns every
row for the draft, old hashes included (`repos.judgeResults.listForDraft`)
— which is exactly the history the version strip attributes, so the mock
now matches the endpoint.
Rewritten against the new DOM: `keyboard-triage` · `batch-approve` ·
`operator-actions` · `format-detail`. Suite for the two dirs: 70 passing.

**One file outside my scope changed, and it had to:**
`components/staged/__tests__/staged-flow.test.tsx` imported the deleted
`ApproveQueue` — the import now points at `ApproveSurface`; no assertion
changed. (The staged wrapper deliberately carries no `aria-label` so the
"the plain detail pane is gone" assertion still holds.)

## Flagged — the sheet was ambiguous, I did NOT improvise

1. **The sort picker's label vs the sheet's own row order.** The sheet's
   chip reads "Oldest first" but its five rows are drawn NEWEST first
   (4 Jul 09:00 → 2 Jul 11:14), and the founder's s66 ruling is newest-first
   by default. Two of the sheet's own bytes disagree; I followed the ROWS
   plus the founder ruling — the surface defaults to newest first and the
   chip shows the CURRENT sort ("Newest first"). **Founder call if the chip
   was the intent** — it is a one-line default flip.
2. **"View diff →" has no data source.** Edits are recorded server-side
   (`edit_diffs`) but no read exposes the prior body, and the lane may not
   change APIs. The slot keeps its place in the strip and states the truth
   (`diff not on the wire`, with the reason in its title) rather than
   offering a door that opens onto nothing. Wiring it = one read endpoint.
3. **The source line's "From @handle on Bluesky ↗".** `FeedRun` carries an
   opaque `sourceId`, not a handle, and there is no capture read. The
   segment renders only when the draft carries a `captureId` (as
   `capture #xxxxxxxx`, plain text — no surface owns it yet); everything
   else on that line is real (run stamp, profile version, drafted/judged
   models, the invariant).
4. **The detail head's window label** (`0:12–0:47 · 35s`) exists only for a
   clip plan — the sheet draws no other format, so no other format invents
   a stat for that slot.
5. **Blocked rows quote their reason via a bounded extra read.** The sheet's
   blocked row shows the failing reason, but the queue endpoints carry no
   judge evidence. Rather than change an API, blocked rows read their own
   detail through the SAME existing client, capped at 12 per queue; past the
   cap a row keeps the neutral excerpt and still shows its reason once
   selected. Say the word if you'd rather I drop this and leave the excerpt
   neutral for every blocked row.
6. **`EmptyArt` is NOT wired into this surface's empty state.** The keeper
   inventory says it re-enters at each surface's empty states, but the
   plates are a light-paper-register asset (`mix-blend-multiply`) and would
   read as a white slab on the dark sheet. Nothing is deleted; re-entry is
   a design call for the shell polish pass, not a port decision.
7. **`Approve` is no longer a sentence-button.** The old button carried its
   consequence in its label; the sheet moves that into the adjacent
   `t-label` ("recorded — nothing publishes until the door arms"). Informed
   consent is intact, in the sheet's own words.

## Merge gate — what to check

`next dev` cannot run in this worktree, so the screenshot-vs-sheet diff is
yours. Worth a look at 1440×940, dark AND light: the 600px/1fr split, the
row band's `flex-start` alignment with the thumb's 1px nudge, the checks
band's green wash on an all-pass draft, and the footer rails on both cards.
The states the sheet never drew (blocked, judging, approved, error, empty)
are the ones where I made calls — they are listed above.

Full `npm run verify` from the repo root, unfiltered and unpiped, before
the final commit; grep guard clean on both commits.
