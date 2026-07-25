# KICKOFF — lane `runslib-rebuild` (exact-mock rebuild: Runs + Library, two-step each)

> **APPROVAL ON RECORD (founder, s73 close): parallel rebuild lanes opened
> — conditions binding on this lane: ui-overhaul-plan §5 "s73 close"
> block. You are a PORT, not a designer — the sheet's bytes win every
> call. This lane carries the wave's two SMALLEST sheets, in series:
> Runs first, then Library.**

Read `CLAUDE.md` first, then IN ORDER:
- `docs/research/mock-sheets/README.md` — THE CONTRACT (rule 0);
- `docs/research/mock-sheets/Runs.dc.html` and `Library.dc.html`
  (+ `theme.css`) — your specs;
- `docs/research/old-design-keepers.md` — the re-entry rule + YOUR rows
  (runs-list selection → the sheet's `.row.sel` · library transcript
  shelf rows/doors);
- `docs/research/ui-overhaul-plan.md` §5 DOCTRINE 0 + the two s73 blocks;
- THE WORKED EXEMPLAR: `apps/web/src/app/app/workspace.css` (READ-ONLY
  shared classes) + `apps/web/src/components/dashboard/` + its tests.

You are on branch `agent/runslib-rebuild`. Work ONLY in
`apps/web/src/components/runs/`, `apps/web/src/components/library/`,
`apps/web/src/app/app/runs/`, `apps/web/src/app/app/library/`, their
tests, and your OWN rows in the three pin files.

## Mission — TWO-STEP per surface, Runs then Library

Per surface: **step 1** pure port of its sheet (markup React-ized; helmet
atomics into a NEW surface-scoped css — `runs/runs.css`,
`library/library.css`; shared classes from workspace.css as-is; sheet
placeholder content; separate commit = the structural verdict point) →
**step 2** wire real data through the EXISTING lib clients (`/api/runs`
feed for Runs; `lib/library/*` for Library — no API changes), honest
states per the dashboard exemplar, keepers behind resting chrome (Runs:
failure triage doors + lastError verbatim; Library: ingest door + tag
rows + transcript doors + delete), sheet placeholder treatment for absent
media, DELETE the old surface components in the same step.

## Constraints (each is a merge-gate check)

- NAMED app adaptations only for real-data overflow (bounded `.card-rows`,
  min-width-0); never silently redesign a band.
- Pin files — edit ONLY your surfaces' rows (bridge-burndown ·
  mono-ratchet · selected-row: the `runs/runs-list.tsx` and
  `library/library-surface.tsx` rows leave the list as they rebuild).
- Zero spend · zero contracts/db/engine edits · no npm install ·
  `next dev` cannot run here — the LEAD screenshot-diffs both surfaces at
  the merge gate; when in doubt, the sheet's bytes.
- Component tests mirror `dashboard.test.tsx` (MSW fixtures).
- Full `npm run verify` at the repo root before wrap — never filtered,
  never piped through tail. Grep guard before every commit.

## Wrap

`agent_handoff/WRAP-runslib-rebuild.md`: per-surface step-1/step-2
commits, keepers woven, pin deltas, deletions, test deltas, ambiguities
flagged. Worktree clean; the lead merges behind screenshot-vs-sheet +
full post-merge verify.
