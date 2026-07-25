# KICKOFF — lane `approve-rebuild` (exact-mock rebuild: the Approve surface, two-step)

> **APPROVAL ON RECORD (founder, s73 close): parallel rebuild lanes opened
> ("if that rule and logic is followed exact, then parallel workflows
> should be safe now" · "plan to have some parallel workflows going next
> session"). Conditions binding on this lane: ui-overhaul-plan §5
> "s73 close" block. You are a PORT, not a designer — the sheet's bytes
> win every call.**

Read `CLAUDE.md` first, then IN ORDER:
- `docs/research/mock-sheets/README.md` — THE CONTRACT (rule 0: exact =
  the sheet's own HTML/CSS ported 1:1, NEVER re-expressed through a
  component library — that re-expression is the pinned s72 failure);
- `docs/research/mock-sheets/Approve.dc.html` + `theme.css` beside it —
  your surface's spec (open them in your head; you cannot run a browser);
- `docs/research/old-design-keepers.md` — the re-entry rule + YOUR rows
  (approve keys a/r/e "confirms intact" · bulk bar · action toast ·
  judge-verdict provenance blocks);
- `docs/research/ui-overhaul-plan.md` §5 DOCTRINE 0 + the two s73 blocks;
- THE WORKED EXEMPLAR: `apps/web/src/app/app/workspace.css` (the shared
  ported classes — READ-ONLY for you) + `apps/web/src/components/dashboard/`
  + its `__tests__/` (how a ported surface wires data, honest states, and
  tests on the MSW fixtures — mirror this discipline exactly).

You are on branch `agent/approve-rebuild`. Work ONLY in
`apps/web/src/components/approve/`, `apps/web/src/app/app/approve/`, your
surface's tests, and your OWN rows in the three pin files (below).

## Mission — TWO-STEP (founder-ratified s73)

**Step 1 — pure port.** Rebuild the Approve surface EXACTLY from
`Approve.dc.html`: the sheet's markup React-ized, its helmet `<style>`
atomics ported into a NEW surface-scoped stylesheet
`apps/web/src/components/approve/approve.css` (imported by the surface —
NEVER edit workspace.css/shell/theme/tokens). Shared classes (.card, .row,
.pill, .btn, .seg, .thumb-sm, type roles…) come from workspace.css as-is.
Sheet placeholder content in this step; commit it separately — it is the
founder's structural verdict point.

**Step 2 — wire + keepers.** Real data through the EXISTING
`lib/approve-queue/*` clients (no API changes); honest states everywhere
(loading/error/empty are never real-looking success — see the dashboard
exemplar); weave YOUR keeper rows back in BEHIND byte-true resting chrome
(keyboard grammar + confirms intact, bulk bar, toast, per-gate verdict
provenance with reasons verbatim); the sheet's placeholder treatment
(striped thumb + mono explainer) wherever the backend lacks media. DELETE
the old approve components in this same step (`components/approve/*` old
files, and any approve-specific workspace helpers that die with them).

## Constraints (each is a merge-gate check)

- Real data will overflow the canvas fixture — use the NAMED app
  adaptations only (`.card-rows` bounded scroll, min-width-0; see the
  workspace.css adaptation comments). NEVER silently redesign a band.
- Pin files — edit ONLY your surface's rows, the lead resolves overlaps:
  `apps/web/src/lib/__tests__/bridge-burndown.test.ts` (your deleted
  files' rows go, new files enter at ZERO bridged tokens),
  `apps/web/src/lib/__tests__/mono-ratchet.test.ts` (same),
  `apps/web/src/lib/workspace/__tests__/selected-row.test.ts` (your row
  leaves the list — rebuilt surfaces use the sheet's `.row.sel`).
- Zero spend · zero contracts/db/engine edits · no npm install ·
  `next dev` cannot run in this worktree (Turbopack rejects the symlinks)
  — the LEAD renders and screenshot-diffs your surface against its sheet
  at the merge gate; write for that gate: when in doubt, the sheet's bytes.
- Component tests mirror `dashboard.test.tsx` (MSW fixtures; pin the
  sheet's bands, doors, honest states, keyboard grammar).
- Full `npm run verify` at the repo root before wrap — never filtered,
  never piped through tail. Grep guard before every commit.

## Wrap

`agent_handoff/WRAP-approve-rebuild.md`: step-1 vs step-2 commits, keeper
rows woven (each named), pin deltas, deletions list, test deltas, anything
the sheet left ambiguous (flag — never improvise). Commit everything on
the branch, leave the worktree clean. The lead merges behind its own
screenshot-vs-sheet diff + a full post-merge verify.
