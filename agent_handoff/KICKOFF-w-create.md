# Lane kickoff — W-create (s60 workspace Phase I)

You are a Phase I build lane on branch `lane/w-create` in this worktree. The founder approved this run (s60 opener, "GO — all three"). You implement the approved **Create Handoff** and **Approve Consent** designs in the real Next.js workspace app. This is design implementation — the design files are the spec of record; build what they show, not a variation on it.

## Scope — hard boundaries

- You own ONLY: `apps/web/src/components/create/**` · `apps/web/src/components/approve/**` · `apps/web/src/components/staged/**` · `apps/web/src/app/app/create/**` · `apps/web/src/app/app/approve/**`. Touch no other path — not the app shell (`app/app/layout.tsx`, `app/app/page.tsx`), not `components/ui`, not handoff files, not COORDINATION.md.
- **UI-only. The contract is frozen:** no edits to `packages/contracts`, `packages/db`, migrations, or any API route's request/response shape. Bind to existing repos/APIs/hooks. If the design needs data that doesn't exist, render an honest empty/planned state and flag it in your wrap — never invent a schema change. Known v1 exclusion: undo-after-terminal rides a queued B-crm contract change — do NOT build it.
- **Never `npm install`** (root preinstall guard; this worktree is prepped).
- Commit to `lane/w-create` only. Do NOT push, do NOT merge, do NOT touch main. The lead batch-reviews, rebases you onto the merged W-spine shell, and merges.

## Spec of record (read before writing code)

1. The designs: claude-design MCP, project id `c86680f5-6095-4d75-a1a5-d1418936719e`, files **`Create Handoff.dc.html`** and **`Approve Consent.dc.html`** (read via `read_file`; the in-file annotation tables are part of the spec). If the MCP is unreachable, STOP and say so in your wrap — do not build from memory.
2. `docs/research/workspace-phase-d-designs.md` — the decision ledger (designs #5 and #6 are yours).
3. `DESIGN.md` §5 — list grammar incl. the Bounded-List Rule. Two-channel purity: **blue = act, amber/bronze = signal-only** — audit every color you place.
4. `docs/research/workspace-ux-v2.md` §10 — the approve-queue informed-consent critique the design answers.
5. The current surfaces: `apps/web/src/components/create/`, `components/approve/`, `components/staged/`, and their routes — reuse the data wiring; the redesign reshapes presentation.

## What the designs demand (headlines, not a substitute for reading them)

- **Create Handoff** — the seam that never re-asks: carried intel context rendered as six typed removable chips (title · angle · hook · source · area · heat); working title + prompt pre-seeded; settings rows marked "profile" where a profile supplies them; One-prompt | Advanced toggle; honest five-step goal gradient (steps a profile completed show ✓ as genuinely done); the generate button states its outcome and names the judge gate.
- **Approve Consent** — informed consent: lineage chips (intel → run → judge, every node a deep link); profile + model seats visible; per-check judge verdicts with reasons VERBATIM (positive case included); the consequence-stating approve sentence; quiet-red Reject with named confirm; the blocked-sibling inset stating the fail-closed rule in UI copy. Approve is a list + detail, NEVER a board — its stages are engine-derived and drag would fake agency.

## Gates

- Light-first workspace styling; keyboard grammar preserved where the surface has one (useListKeys, Four-Verbs letters, named confirms).
- Tests updated/added in the same change (`__tests__` dirs); the affected web tests + lint must be green before wrap.
- Accessibility: interactive elements are real buttons/links; judge reasons readable by AT, not visual-only.
- No AGPL or copied third-party code; no new dependencies.

## Wrap

1. From the worktree root: `pwsh scripts/ci-grep-guard.ps1` — must be clean.
2. Run the web test suite for your owned dirs + lint; report results honestly (red = say so).
3. Conventional commit(s) on `lane/w-create` (e.g. `feat(web): create handoff + approve consent redesign - ...`). **No AI attribution anywhere.**
4. End with a founder-readable summary: what was built vs the designs, any honest deviations + why, data gaps flagged, test/lint status. Then stop — do not idle-loop.
