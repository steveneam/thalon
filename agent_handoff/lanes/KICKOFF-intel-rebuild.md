# KICKOFF — lane `intel-rebuild` (exact-mock rebuild: the Intel surface, two-step)

> **APPROVAL ON RECORD (founder, s73 close): parallel rebuild lanes opened
> — conditions binding on this lane: ui-overhaul-plan §5 "s73 close"
> block. You are a PORT, not a designer — the sheet's bytes win every
> call.**

Read `CLAUDE.md` first, then IN ORDER:
- `docs/research/mock-sheets/README.md` — THE CONTRACT (rule 0: exact =
  the sheet's own HTML/CSS ported 1:1, NEVER re-expressed through a
  component library);
- `docs/research/mock-sheets/Intel.dc.html` + `theme.css` — your spec;
- `docs/research/old-design-keepers.md` — the re-entry rule + YOUR rows
  (capture doors promote/dismiss→create ctx · demo-banner + cadence-stamp
  honesty);
- `docs/research/ui-overhaul-plan.md` §5 DOCTRINE 0 + the two s73 blocks;
- THE WORKED EXEMPLAR: `apps/web/src/app/app/workspace.css` (READ-ONLY
  shared classes) + `apps/web/src/components/dashboard/` + its tests;
- `agent_handoff/lanes/WRAP-blearn.md` §Slice 3 — the trends read you consume:
  `/api/intel/trends` now serves the MERGED multi-source union + a NEW
  `sources` field (per-source sweep stamps). Additive; the wire types are
  in `apps/web/src/lib/intel/types.ts` (update the client type for
  `sources` if the s73 merge didn't already).

You are on branch `agent/intel-rebuild`. Work ONLY in
`apps/web/src/components/intel/`, `apps/web/src/app/app/intel/`, your
surface's tests, `lib/intel/types.ts` (additive `sources` only, if
needed), and your OWN rows in the three pin files.

## Mission — TWO-STEP (founder-ratified s73)

**Step 1 — pure port.** Rebuild the Intel surface EXACTLY from
`Intel.dc.html`: markup React-ized, helmet atomics into a NEW
surface-scoped `apps/web/src/components/intel/intel.css`. Shared classes
from workspace.css as-is. Sheet placeholder content; separate commit —
the structural verdict point.

**Step 2 — wire + keepers.** Real data through the EXISTING `lib/intel/*`
clients: the merged trends read (cards already carry `source`; the sweep
stamp band renders the honest freshest-sweep truth, and the per-`sources`
stamps feed whatever stamp slot the sheet draws — the sheet's bytes decide
presentation, the data stays honest). Keepers woven behind resting chrome:
every card action records its capture (promote/dismiss doors unchanged,
`lib/intel/store` semantics), the demo/fake-driver era stays NAMED never
implied live, thermal grammar = word-in-pill exactly as the sheet draws
it. Sheet placeholder treatment where live thumbnails are absent (never
synthesized). DELETE the old intel components in this same step.

## Constraints (each is a merge-gate check)

- Real data overflows the canvas fixture — NAMED app adaptations only
  (bounded `.card-rows`, min-width-0); never silently redesign a band.
- Pin files — edit ONLY your surface's rows (bridge-burndown ·
  mono-ratchet · selected-row list if applicable); the lead resolves
  overlaps.
- Zero spend · zero contracts/db/engine edits · no npm install ·
  `next dev` cannot run here — the LEAD screenshot-diffs your surface at
  the merge gate; when in doubt, the sheet's bytes.
- Component tests mirror `dashboard.test.tsx` (MSW fixtures; the trends
  handler already serves the store — extend the fixture for `sources` if
  you type it).
- Full `npm run verify` at the repo root before wrap — never filtered,
  never piped through tail. Grep guard before every commit.

## Wrap

`agent_handoff/lanes/WRAP-intel-rebuild.md`: step-1 vs step-2 commits, keepers
woven, pin deltas, deletions, test deltas, ambiguities flagged. Worktree
clean; the lead merges behind screenshot-vs-sheet + full post-merge verify.
