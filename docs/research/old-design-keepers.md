# Old-design keepers — the salvage inventory (s73, founder-directed)

> **Rule of re-entry (founder, s73): structure first, keepers after.**
> "Only after the new claude design is structurally in place are you free
> to add/change things as required (like adding back the thalon logo) …
> more sophisticated things can be added/changed, as long as the overall
> new structure and design is not changed." Each surface rebuild is a
> TWO-STEP: (1) pure port of its sheet — the sheet's own markup/CSS with
> its own placeholder content, screenshot-diffed 1:1, a clean verdict
> point with zero old-design contamination; (2) wire real data and weave
> the keepers below back in, re-verify with real data. A keeper NEVER
> modifies sheet geometry — it lives behind byte-true resting chrome (a
> panel, a behavior, a state) or in the data layer. The only structural
> deltas step 2 may introduce are the NAMED app adaptations real data
> forces (bounded/scrolling regions, min-width-0 — each documented in
> `apps/web/src/app/app/workspace.css`), never silent redesigns. Old
> surface code is deleted in the same change that ships step 2 (DOCTRINE 0
> rule 3).
>
> **Recovery:** nothing here is lost — every demolition commit lists its
> deletions, and the pre-demolition refs below make retrieval a checkout,
> not archaeology. Wave-1a deletions (shell chrome + dashboard) live intact
> at `8da5df2` (the last commit before `01f8179`).

## Carried through wave 1a already (woven into shell + Dashboard, s73)

These survived by design — the rebuild deleted only presentation code and
rebuilt against the untouched `lib/` layer:

- **Pulse plumbing** — `lib/workspace/*` clients/types, `pulse-context.tsx`
  (one shared read; badge never lies).
- **Honest states** — engine-unreachable alert with retry (critique P0
  2026-07-14), "–" for unresolved reads, never a real-looking zero, read
  failures are never quiet days.
- **Bounded regions** — needs-you card scrolls at ~4 rows; week days fold
  at 3 marks + "+N more" (the Bounded-List Rule).
- **The one list keyboard grammar** — j/k move · ↵ open
  (`lib/workspace/keyboard.ts`), selection = the sheet's `.row.sel`.
- **Week math honesty** — `lib/workspace/week.ts` untouched: overdue
  pointers project nothing; waiting drafts carry into today, never vanish.
- **s66 findability door** — Settings + Manage profiles reachable from the
  topbar tenant panel (behind resting chrome).
- **Light mode** (the founder's wave-0 keeper) — the toggle lives in the
  tenant panel; the token aliases make light ride `light-dark()` free.
- **Work-tray honesty** — stage words never percents, started-time never
  ETA, completion raises the dot never a modal, quiet chrome when idle.
- **First-run tutorial** — 3-step card (simplified; the illustrated
  `EmptyArt` version is a keeper below).

## Keepers awaiting their surface's step 2

| Keeper | Home today (all still tracked) | Re-enters at |
|---|---|---|
| Approve keys (a approve · r reject · e edit, "confirms intact") + bulk bar + action toast | `components/approve/*`, `workspace/bulk-bar.tsx`, `workspace/action-toast.tsx` | Approve step 2 |
| Judge-verdict provenance blocks (per-gate verdicts, reasons verbatim) | `components/approve/judge-verdicts.tsx`, `lib/approve-queue/*` | Approve step 2 |
| Capture doors (promote/dismiss → create ctx; every action records a capture) | `components/intel/*`, `lib/intel/store.ts` | Intel step 2 |
| Demo-banner + cadence-stamp honesty (fake-driver era named, never implied live) | `components/intel/demo-banner.tsx`, `cadence-stamp.tsx` | Intel step 2 |
| Saved-view tabs (tenant-wide named views, `/api/views`) | `components/board/`, `components/calendar/`, `lib` views client | Board + Calendar step 2 |
| Calendar engine (month/week/agenda grids, slot chips, reschedule doors) | `components/calendar/*` | Calendar step 2 |
| Staged-flow multi-stage video UX (candidate picker, direction editor, storyboard) | `components/staged/*` | Videos/Create step 2 (per plan §4.2 wave-2 mini-spec) |
| **The Thalon logo** (BrandMark, landing-amber DNA) — the rail currently wears the SHEET's gradient square; the real mark re-enters once the whole shell structure is verdicted (founder named this one s73) | `components/brand/marks.tsx` | shell polish pass, after all-surfaces structural |
| EmptyArt illustrations + demo media | `components/ui/empty-art.tsx`, `lib/brand-assets.ts`, `public/` | each surface's empty states; NEVER deleted |
| Command palette (⌘K, one nav registry) | `workspace/command-palette.tsx` (still live) | its own restyle pass, last |
| Lead-score provenance (weights + reasons spelled out) | `components/leads/weights-provenance.tsx` | Leads step 2 |

## Retired, deliberately (not keepers)

- **Journey-spine dashboard band** — superseded by the sheet's stat-tile
  grammar (the founder rejected the old dashboard wholesale).
- **Astryx shell chrome** (AppShell/SideNav/TopNav/Popover usage) — the
  sheet's own `.rail`/`.topbar`/`.tray` port replaced it; the token/theme
  build pipeline STAYS (the tokens are the sheets' values).
- **Legacy semantic-token styling** — burns down file-by-file
  (`src/lib/__tests__/bridge-burndown.test.ts` pins the count; the
  globals.css bridge block is deleted when the map empties).
