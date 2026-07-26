# WRAP — lane `planner-rebuild` (Calendar, then Board — two-step each)

Branch `agent/planner-rebuild`, eight commits, worktree clean. Both surfaces
shipped two-step off their sheets. Nothing outside the lane's file set was
touched except the two lines named under **Cross-lane notes** below.

| | step 1 (pure port) | step 2 (wire + keepers) |
|---|---|---|
| **Calendar** | `8343dfd` | `d8223ba` |
| **Board** | `d3e3ac0` | `a8b20bd` |

Four fixes followed from re-reading the wired surfaces before wrap — each its
own commit, each with a test: `098fa9e` (a calendar visit no longer PUTs its
view back; intel placeholders name their real source) · `5ecd8b3` (the keeper's
`↵` had been dropped in the step-2 rewrite while its comment still claimed it) ·
`160ccfd` (`↵` yields to a focused control — clicking a plan then pressing it
both deselected and navigated) · `e4f23ff` (the month density derived sweeps and
the waiting carry over the anchor WEEK, rendering its other three weeks quieter
than they are; and its bounded cells now rank marks so a 4-hourly sweep cannot
bury the work).

---

## Calendar

**Step 1 — `8343dfd`.** `Calendar.dc.html` ported 1:1: the header band (week
nav · density seg · scope seg · planned pill), the `.cal` block (day header,
the all-day *waiting* lane, both collapsed quiet bands, the 06:00–21:00 time
grid with its now-line, events, drop ghost and detail popover), and the
two-line footer. Helmet atomics → `components/calendar/calendar.css`, every
rule scoped under `.calendar-surface` (README rule 6). `.avatar` deliberately
not duplicated — it is already shared in `workspace.css`. The sheet's one
mapping is pinned in code: **06:00 at y=0, 44px/hour, the 660px column**.

**Step 2 — `d8223ba`.** Real reads through `fetchPlan()` and
`fetchViews`/`putView`; no API changes.

- **grid** — planned slots (`.ev-plan`), work that COMPLETED at the instant it
  completed (`published` → `.ev.done.ev-ok`; `approved`/`rejected` → `.ev.done`,
  neutral: a rejection is not dressed as a success), and the sweeps the engine
  WILL run, projected from the live pointer — **nothing at all from an overdue
  pointer** (`projectSweepTicks`, the s39 lesson).
- **waiting lane** — queued/blocked drafts on the day they started waiting,
  carried into today when older than the week.
- **footer** — the tenant's real cadence rules; "Plans, not uploads" verbatim
  (it is true: no publish door is armed).

### Keepers woven back in
- **The calendar engine** — month · week · agenda. Week is the sheet. Month and
  Agenda return behind the sheet's own density control (see deviation 2).
- **Saved-view tabs** — the tenant-wide view (`/api/views`, surface
  `"calendar"`, name `"Default"`) restores density/scope/expanded and saves
  changes back, debounced. It re-enters as **state behind the sheet's existing
  seg controls**, not as a new band (doctrine vii). Disclosure is the control's
  `title`; a failed view read never surfaces over the plan.
- **The one list keyboard grammar** — `j`/`k` walk the week's events in time
  order, `Escape` clears; selection wears the sheet's own `.ev-plan.sel` and
  opens the sheet's own `.detail` popover.
- **Honest states** — read failure says so with retry, an empty week says it is
  empty, counts read `–` until resolved.

### Deleted (DOCTRINE 0 rule 3)
`week-grid.tsx` · `month-grid.tsx` · `agenda-list.tsx` · `day-panel.tsx` ·
`slot-chip.tsx` · `model.ts` · `__tests__/model.test.ts`.
New: `calendar-model.ts`, `calendar.css`, `__tests__/calendar-model.test.ts`.

---

## Board (the pipeline board — HOME's second tab)

The sheet draws this at Home (`data-screen-label="Pipeline board"`, rail marks
Home, header "Today" with the Overview·Board control), so it lives at
**`/app/board`**. `activeSurface()` already resolves that to Home by
longest-prefix — no nav-registry change needed.

**Step 1 — `d3e3ac0`.** `Board.dc.html` ported 1:1: header + the six columns
with their counts, card grammar, the waiting column's signal dress. Helmet
atomics → `components/board/board.css`, all scoped under `.board-surface`.

**Step 2 — `a8b20bd`.** Each column is a real lifecycle slice of the plan read:
Composing (`generated`) · At the judge (`judging`, gate count when verdicts
exist) · Waiting on you (`queued`/`blocked`, oldest first, signal dress) ·
Approved (`approved`/`published`, "published ↗" only on a recorded deploy) ·
Planned (the slot store) · Intel picks (`fetchTrends`, real rank band, real
source thumbnail where one exists, striped placeholder where not). A draft
lands in exactly one column; **rejected work has left the pipeline and the
sheet draws no column for it**. Card titles are the draft's own excerpt; a
blocked card leads with the judge's reason in the error channel. The plan and
intel reads are independent — intel failing states it in its own column and
leaves the pipeline standing. Counts are TOTALS; a long column scrolls inside
itself.

No old implementation existed to delete: the Dashboard drew Board as a dead
label. `components/board/leads-board.tsx` is the **Leads** board (saved-view
surface `"leads"`) — untouched here; see Cross-lane notes.

---

## Flagged — where the sheet and the backend disagree

Each is a backend gap or a silent sheet, never a design choice. Founder verdict
wanted on all five.

1. **No reschedule door exists.** `repos.plannedSlots.plan/unplan` are real, but
   **no HTTP route exposes them** and this lane may not add one. So: the
   header's "drag to reschedule — snaps to cadence-legal slots" states the truth
   instead (`drag to reschedule isn't wired — the slot store has no write route
   yet`), the drop `.ghost` is not rendered, and Reschedule/Remove are disabled
   with the reason on them. **The ported CSS still says `cursor: grab` on `.ev`
   — I kept the sheet's bytes rather than edit them.** One thin route
   (`POST/DELETE /api/app/plan/slots`) turns all of this on.
2. **Month and Agenda have no canvas sheet.** The sheet draws only Week, but the
   keeper row names all three grids. They are built strictly from classes the
   sheets already own — `.cal-dh` header, the Dashboard's shared
   `.mark`/`.marks` day-chip grammar, `.row` for agenda — plus one month-cell
   frame (`.mcell`/`.mday`) that no sheet carries. **Worth two canvas sheets if
   the founder wants them exact.**
3. **The ⚑ has no store, so I gave it the sheet's own meaning.** "Flagged" is
   derived, not stored: a plan that breaks the tenant's **real** cadence rules
   (max/day, min gap), with the broken rule named verbatim in the popover and in
   the ⚑ Flagged scope. This is an interpretation of the sheet's own
   "cadence-legal" copy — flagging as a stored operator mark would need a table.
4. **Intel pick state is unreadable.** The Board sheet's `picked · video` /
   `unpicked` needs a captures LIST read; only `/api/intel/context/[captureId]`
   exists (one by id). The card meta states the monitored area instead.
5. **Age grammar.** The sheets' `26h` / `45m` keep an hour scale;
   `timeAgo` rolls to `1d` at 24h, which hides how long someone has waited. Both
   surfaces use whole hours for waiting work. `timeAgo` is untouched elsewhere.

Also worth the lead's eye: the plan read is a **±2-week server window**, so the
Month density can only show what that carries — the header says so in that
density rather than implying a full month.

---

## Cross-lane notes (the lead's calls, not mine)

- **`components/dashboard/dashboard.tsx` — 2 changes, outside my named scope**
  and unavoidable: the Board seg option was an inert `aria-disabled` label
  ("lands with its exact-mock rebuild"); shipping the surface without its door
  would have left it unreachable. It is now a `<button>` + `router.push`, and
  the dashboard suite gained one assertion pinning it as a real door. No other
  lane in this wave owns that file (crm = leads/profiles, estate =
  sites/settings).
- **Seg options are buttons, not links.** `workspace.css` has
  `.screen a { color: var(--act) }` and no `.screen a.seg-opt` override, so an
  anchor ships a **blue tab**. The week card's Today/This-week control set the
  button precedent, and `.seg-opt` already carries the button reset. If the lead
  prefers real links here, one line in `workspace.css` (`.screen a.seg-opt`,
  exactly parallel to the existing `.screen a.nav-item`) is the fix — a
  shell-contract edit only the lead may make.
- **`components/board/leads-board.tsx` is NOT mine.** It is the Leads surface's
  board tab (saved-view surface `"leads"`), it still holds its bridge (22), mono
  (5) and selected-row pins, and the **crm lane's Leads step 2 should retire
  it**. I left it and its pin rows completely untouched to avoid a merge
  collision. Both boards living in `components/board/` is now the only confusing
  thing left in that directory — worth a rename at the gate.
- **`impeccable` design hook** flagged six values across the two stylesheets
  (font sizes 9–11.5px, a 5px thumb radius, the popover shadow). Every one is a
  ported sheet byte. Left unchanged and **not** suppressed — suppression needs
  the founder's word.

---

## Pin deltas

| Pin | Delta |
|---|---|
| `bridge-burndown.test.ts` | all six `components/calendar/*` rows REMOVED (surface rebuilt, sub-components deleted) — the surface sits at ZERO. Board's new files enter at zero, never added. `components/board/leads-board.tsx` (22) untouched. |
| `mono-ratchet.test.ts` | same six `components/calendar/*` rows REMOVED. `components/board/leads-board.tsx` (5) untouched. |
| `selected-row.test.ts` | **no delta** — Calendar was never in the list (it marks selection with the sheet's own `.ev-plan.sel`), and the `board/leads-board.tsx` row belongs to the crm lane. |
| `surface-css-scope.test.ts` | green — `calendar.css` and `board.css` are fully scoped. |

## Test deltas

`components/calendar` 38 tests · `components/board` 29 tests, all green.

- `calendar/__tests__/calendar-surface.test.tsx` — old-design suite replaced;
  step 1 structural pin → step 2 behaviour + honesty (band structure, plan
  placement at its own pixel, done-vs-closed dress, the waiting lane, the ⚑ and
  its scope, the popover's disabled write doors, no-drag, sweep projection incl.
  the overdue case, read failure + retry, the two other densities, the empty
  week, the saved view round-trip and the no-write-on-visit rule, the quiet
  bands, j/k and ↵).
- `calendar/__tests__/calendar-model.test.ts` — NEW, over the time mapping,
  event derivation, sweep honesty, the waiting carry rule, cadence breaches,
  scope/layout/labels/mark-ranking.
- `board/__tests__/board-surface.test.tsx` — NEW, 8 tests.
- `board/__tests__/board-model.test.ts` — NEW, 7 tests.
- `dashboard/__tests__/dashboard.test.tsx` — 1 assertion changed (the Board door).
- deleted with the old implementation: `calendar/__tests__/model.test.ts`.

## Verify — GREEN

`npm run verify` at the repo root, unfiltered, redirected to a file and read
back (never piped through `tail` — the pinned main-RED #3 root cause).

```
guard    PASS: no forbidden brand tokens in tracked files.
tests    279 files passed | 4 skipped (283) · 1985 passed | 9 skipped (1994)
lint     12 problems (0 errors, 12 warnings — all pre-existing, none in this lane)
VERIFY_EXIT: 0
```

**Ran 19:10:40 → 19:15:49 UTC (suite 261.7s).** Box at start: load **4.14**;
at end: **5.42**. It was deliberately queued rather than run on demand — the
two sibling lanes held the box at 10–14 for ~20 minutes, and a fourth
concurrent suite is exactly the s74 pathology (load 34, a 4-minute suite
stretched to 14). A watcher fired the run the moment load fell below 5, after
waiting 390s.

Cheap gates ran continuously during the build instead: full `npm run typecheck`
(exit 0) and full `npm run lint` (exit 0) after each step, plus targeted vitest
on every touched suite.
