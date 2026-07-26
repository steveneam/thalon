# WRAP — lane `leadboard-wire` (Leads board STEP 2: wired, legacy set deleted)

Branch `agent/leadboard-wire`, one commit, worktree clean. The Board tab of
the Leads surface now shows the real ranked queue in the sheet's column
grammar, and the orphaned Phase-I board (`components/board/leads-board.tsx` +
`model.ts` + both tests) is deleted in that same commit (DOCTRINE 0 rule 3).
No API, contract or engine change; zero spend.

**`npm run verify` GREEN at the repo root** — guard first in the chain, then
2034 passed / 9 skipped (282 files), typecheck clean across all 7 workspaces,
lint 0 errors (12 pre-existing warnings, none in a file this lane touched).

---

## 1. What got wired

**Real leads in the columns.** `leadBoardColumns()` (new, in
`components/leads/leads-model.ts`) groups the queue by `status` into
`LEAD_BOARD_COLUMNS` — still contract-derived, still `LEAD_STATUSES` filtered
by whether the status has exits in `LEAD_TRANSITIONS`, never hand-listed —
and sorts each column by the SAME `compareLeadCards` the list ranks by, so the
two views agree about who is at the top. Counts are the column's real total.

**The card is a LEAD card.** `leadInitials` badge, `leadTitle`
(name · company) and the score bar painted by `heatColor` — the same thermal
band the list grades by. The model helpers are reused, not restated. A pinned
lead wears the sheet's `.k-meta` pill dress as a `hot` pill (it already floats
first via `compareLeadCards`; the board had no other hot signal).

**Honest states, all four of them.**

| state | what it says |
|---|---|
| unread (loading / error) | count is `–`, never a real-looking zero |
| read failure | a `role="alert"` band: *"this is a read failure, not an empty pipeline"* + Try again, and each column notes it. Appears only on failure — resting chrome is untouched |
| empty column | what would actually put a lead there (*"A recorded send sets contacted — nothing is ever sent from here"*), not a bare 0 |
| unscored lead | `–` with an empty trough and `title="not scored yet"` — never an invented grade |

**Terminal leads are counted, not hidden.** `dismissed`/`unsubscribed` have no
column (a terminal state is not a drop target), so the foot names them:
`3 dismissed · 1 unsubscribed — terminal, so they have no column here`.

**A card is a door.** Clicking one opens that lead in the List tab, where its
dossier (reasons, activity, drafted outreach) already lives — the board
carries no second dossier and no dead cards. The `aria-label`/`title` say so
literally: *"Open Mara Kessler · Fieldline Robotics in the list"*. It also
clears the Dismissed toggle on the way, because the board only ever draws
non-terminal leads and landing on a filtered list would hide the pick.

**One consequence handled:** the header's `Import contacts` button opens a
panel that lives under the list. From the Board tab it is now a door back to
the list with that panel open, rather than a control that silently does
nothing.

## 2. The layout call — Board takes the full content width

**Chosen: the Board tab REPLACES the list/detail split.** Three reasons, in
order of weight:

1. **The sheet says so.** `Leads.dc.html` draws List and Board as mutually
   exclusive `seg-opt`s — a view switch, not a pane switch. And
   `Board.dc.html` draws the column grammar as a full-content-width band.
   Rendering that grammar inside the Leads sheet's 480px list pane is a
   *re-expression* of it, which README rule 0 forbids by name.
2. **The arithmetic.** 480px minus gaps ≈ 150px per column. `.l-name` is
   12.5px and ellipsised — nearly every real `name · company` would truncate,
   so the board's one identifying field would be unreadable at rest.
3. **The right half had nothing to do.** The split's second card is the
   selected lead's dossier; beside a kanban it is either dead or a second
   selection model. Making the card a door instead keeps one selection state
   and one dossier.

**One deliberate non-port, flagged:** the sheet's `.cols { flex: 1 }` is NOT
carried. In `Board.dc.html` nothing follows the columns, so that rule only
fills empty background; here the honest-limit footnote follows them and
`flex: 1` stranded it ~300px below the last card — a layout the sheet never
draws. With `align-items: start` the columns hug their content either way, so
the column band renders identically. Caught on the render, fixed, re-shot.

## 3. The keyboard-grammar verdict — LEFT OUT, and why

The legacy 2D grammar (j/k within a column, h/l across) **cannot re-enter as
it stood**: `h` is already this surface's *"mark hot"* verb in the list
(`useListKeys`, beside `j`/`k`/`d`). Re-entering h/l as lateral movement would
give one key two meanings on one surface — precisely what the ONE-list-grammar
rule exists to prevent. And the board's resting chrome draws no legend to
teach a second grammar, so it would need the extra control band the re-entry
rule forbids.

So: no bespoke grammar on the board. The cards are real `<button>`s, which
reach the keyboard the way every other control does — native focus order, ↵ to
open, `:focus-visible` on the sheet's accent. `useListKeys` stays gated to
`view === "list"`, unchanged.

## 4. Proof the deleted files were genuinely orphaned

Checked before deleting, not taken on the kickoff's word. Two greps over
`apps/web/src`:

- **Module-level:** `board/leads-board` resolved to exactly four places — its
  own test, the step-1 file's comment about deleting it, and the three ratchet
  pins. `board/model` resolved to its own test, the legacy component, and
  `__tests__/leads-board.test.tsx`. **No route, surface or component imported
  either.**
- **Symbol-level**, for every export of `model.ts` (`BOARD_COLUMNS`,
  `COLUMN_LABELS`, `groupColumns`, `terminalCounts`, `clampCursor`,
  `moveCursor`, `cursorLead`, `coerceView`, `decodeView`, `viewsEqual`,
  `viewConfig`, `encodeView`, `wipChip`, `BOARD_VIEW_*`, `DEFAULT_VIEW`):
  zero hits outside the deleted set. (`calendar-surface.tsx` has its own local
  `coerceView`/`moveCursor` functions — same names, not imports.)

Post-deletion the full suite is green with nothing dangling, which is the
executable half of the same proof. `components/board/board-surface.tsx`,
`board-model.ts` and `board.css` — the shipped CONTENT board — were not
touched.

## 5. Pin deltas

| pin | delta |
|---|---|
| `lib/__tests__/bridge-burndown.test.ts` | `components/board/leads-board.tsx: 22` **removed** (file gone; the rebuild sits at 0 bridged tokens) |
| `lib/__tests__/mono-ratchet.test.ts` | `components/board/leads-board.tsx: 5` **removed**; the `heat-grade` comment re-trued (see §6) |
| `lib/workspace/__tests__/selected-row.test.ts` | `board/leads-board.tsx` **removed — the list is now EMPTY.** Rather than leave a vacuously-passing loop, it gained an explicit `expect(SELECTION_SURFACES).toEqual([])` so a name reappearing there fails loudly: that would mean a rebuilt surface reached for the legacy recipe instead of the sheets' `.row.sel` |

`surface-css-scope.test.ts` stayed green throughout — every new rule is under
`.leads-surface`.

## 6. Above this lane's pay grade (three, all real, none touched)

1. **`components/intel/heat-grade.tsx` — the `HeatGrade` COMPONENT is now
   orphaned.** Every live consumer (leads, board, create, intel) imports the
   pure `heatBand`; the component lost its last caller when the legacy board
   went. It is the sole reason that file holds 1 mono pin **and** 1
   bridge-burndown pin — deleting it burns both to zero. That is a
   `components/intel/**` change, outside this lane's file set. Noted in the
   mono pin's own comment so it cannot rot.
2. **`components/workspace/bulk-bar.tsx` is now imported by nothing** (the
   legacy board was its last caller; Approve's rebuild took the bulk action
   into the sheet's own header button). It holds a bridge pin of 2.
   `components/workspace/**` is likewise outside this lane.
3. **Three Phase-I capabilities retired with the legacy board** — the 2D
   grammar (§3), advisory WIP limits, the board's tenant-wide saved view, and
   board multi-select. Each is homed in
   `docs/research/old-design-keepers.md` under a new *"Retired with the legacy
   leads board"* section with the reasoning and the pre-demolition ref
   (`73a4752`), so restoring any of them is a checkout, not archaeology.
   **The WIP-limit / saved-view pair is a founder call**, and it reads as
   belonging with the operator-owned stage field rather than before it.
   The stale "Saved-view tabs" keeper row was re-trued in the same file: the
   store and its client are still live, for the Calendar.

## 7. Honest limit preserved, not quietly fixed

**No drag-between-columns.** Stated in the foot, in plain words: *"dragging
between them waits for the operator-owned stage field — today the engine sets
the stage, so a drop target would fake a control you don't have."* Pinned by a
test that asserts no `[draggable='true']` exists and that the sentence is on
screen. Thumbnails: not applicable — lead cards carry no media, and none was
invented.

## 8. Visual proof

`next dev` can't run inside a lane (Turbopack rejects the out-of-root
node_modules symlinks), so the render was done against the REAL stylesheets —
`docs/research/mock-sheets/theme.css` + the app's `workspace.css` +
`components/leads/leads.css`, with the sheet's own rail/topbar — at 1440×940
via chrome-devtools. Two shots taken (populated + empty-column), both in the
session scratchpad; the `flex: 1` finding in §2 came out of the first one.

**The lead still owes the gate its own screenshot-vs-sheet diff against the
live app on merged main** — this harness proves the CSS renders as intended,
not that the running route does.
