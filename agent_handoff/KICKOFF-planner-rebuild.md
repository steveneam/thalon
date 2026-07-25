# KICKOFF — lane `planner-rebuild` (exact-mock rebuild: Calendar, then Board — two-step each)

> **APPROVAL ON RECORD (founder, s73 close): parallel rebuild lanes opened
> ("if that rule and logic is followed exact, then parallel workflows
> should be safe now"), reaffirmed at the s74 close ("rinse and repeat …
> for the next session parallel workflow redesign"). Conditions binding on
> this lane: ui-overhaul-plan §5 "s73 close" block. You are a PORT, not a
> designer — the sheet's bytes win every call.**

Read `CLAUDE.md` first, then IN ORDER:
- `docs/research/mock-sheets/README.md` — THE CONTRACT (rule 0: exact =
  the sheet's own HTML/CSS ported 1:1, NEVER re-expressed through a
  component library — that re-expression is the pinned s72 failure; rule 4
  carries the lanes-open amendment you are working under);
- `docs/research/mock-sheets/Calendar.dc.html` and `Board.dc.html` +
  `theme.css` beside them — your two surfaces' spec (open them in your
  head; you cannot run a browser);
- `docs/research/old-design-keepers.md` — the re-entry rule + YOUR rows
  (**saved-view tabs** — tenant-wide named views over `/api/views`, which
  BOTH your surfaces carry; **the calendar engine** — month/week/agenda
  grids, slot chips, reschedule doors);
- `docs/research/ui-overhaul-plan.md` §5 DOCTRINE 0 + the two s73 blocks;
- THE WORKED EXEMPLARS — three surfaces shipped this way already:
  `apps/web/src/app/app/workspace.css` (the shared ported classes —
  READ-ONLY for you), `apps/web/src/components/dashboard/`, and
  `apps/web/src/components/create/` + their `__tests__/`. Create is the
  closest model for a surface whose sheet fixture is richer than the
  backend: read its step-1 and step-2 commits (`7ddb43f`, `a22fdf7`) and
  copy that discipline exactly.

You are on branch `agent/planner-rebuild`. Work ONLY in
`apps/web/src/components/calendar/`, `apps/web/src/components/board/`,
their app routes under `apps/web/src/app/app/`, your surfaces' tests, and
your OWN rows in the pin files (below).

## Mission — TWO-STEP PER SURFACE (founder-ratified s73)

Do **Calendar first, complete (both steps), then Board** — one surface in
flight at a time, so each has a clean verdict point.

**Step 1 — pure port.** Rebuild the surface EXACTLY from its sheet: the
sheet's markup React-ized, its helmet `<style>` atomics ported into a NEW
surface-scoped stylesheet (`calendar.css` / `board.css`, imported by the
surface — NEVER edit workspace.css/shell/theme/tokens). Shared classes
(.card, .row, .pill, .seg, .btn, .thumb-sm, type roles…) come from
workspace.css as-is. Sheet placeholder content in this step; commit it
separately — it is the founder's structural verdict point.

**Step 2 — wire + keepers.** Real data through the EXISTING clients (no API
changes); honest states everywhere (loading/error/empty are never
real-looking success — a failed read says so and offers retry); weave YOUR
keeper rows back in BEHIND byte-true resting chrome (saved-view tabs on
both surfaces; the calendar engine's grids, slot chips and reschedule
doors). DELETE the old implementation of that surface in the same step.

## Constraints (each is a merge-gate check)

- Real data will overflow the canvas fixture — use the NAMED app
  adaptations only (`.card-rows` bounded scroll, min-width-0; see the
  workspace.css adaptation comments). NEVER silently redesign a band.
- Where the backend genuinely cannot fill a band, ship the sheet's
  placeholder treatment and STATE the gap in your wrap — never improvise a
  replacement band, and never fabricate a value to make the fixture match
  (Create's wrap shows the three-deviation form this takes).
- Pin files — edit ONLY your surfaces' rows, the lead resolves overlaps:
  `apps/web/src/lib/__tests__/bridge-burndown.test.ts` (a rebuilt file
  LEAVES the map — rebuilt surfaces sit at ZERO bridged tokens),
  `apps/web/src/lib/__tests__/mono-ratchet.test.ts` (same),
  `apps/web/src/lib/workspace/__tests__/selected-row.test.ts` (your row
  leaves the list — rebuilt surfaces use the sheet's `.row.sel`).
- Zero spend · zero contracts/db/engine edits · no npm install ·
  `next dev` cannot run in this worktree (Turbopack rejects the symlinks)
  — the LEAD renders and screenshot-diffs your surfaces against their
  sheets at the merge gate; write for that gate: when in doubt, the
  sheet's bytes.
- Component tests mirror `create-surface.test.tsx` (MSW fixtures; pin the
  sheet's bands, the doors, the honest states, the keyboard grammar).
- Full `npm run verify` at the repo root before wrap — never filtered,
  **never piped through `tail`** (that pattern is the pinned main-RED #3
  root cause: it hides the test result behind the lint tail). Redirect to a
  file and read it. Grep guard before every commit.

## Wrap

`agent_handoff/WRAP-planner-rebuild.md`: per surface, step-1 vs step-2
commits, keeper rows woven (each named), pin deltas, deletions list, test
deltas, and anything the sheet left ambiguous (flag — never improvise).
Commit everything on the branch, leave the worktree clean. The lead merges
behind its own screenshot-vs-sheet diff + a full post-merge verify.
