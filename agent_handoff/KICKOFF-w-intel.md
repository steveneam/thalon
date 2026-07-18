# Lane kickoff — W-intel (s60 workspace Phase I)

You are a Phase I build lane on branch `lane/w-intel` in this worktree. The founder approved this run (s60 opener, "GO — all three"). You implement the approved **Intel Dossier** design in the real Next.js workspace app. This is design implementation — the design files are the spec of record; build what they show, not a variation on it.

## Scope — hard boundaries

- You own ONLY: `apps/web/src/components/intel/**` · `apps/web/src/components/library/**` · `apps/web/src/app/app/intel/**` · `apps/web/src/app/app/library/**`. Touch no other path — not the app shell (`app/app/layout.tsx`, `app/app/page.tsx`), not `components/ui`, not handoff files, not COORDINATION.md.
- **UI-only. The contract is frozen:** no edits to `packages/contracts`, `packages/db`, migrations, or any API route's request/response shape. Bind to existing repos/APIs/hooks. If the design needs data that doesn't exist, render an honest empty/planned state and flag it in your wrap — never invent a schema change.
- **Never `npm install`** (root preinstall guard; this worktree is prepped).
- Commit to `lane/w-intel` only. Do NOT push, do NOT merge, do NOT touch main. The lead batch-reviews, rebases you onto the merged W-spine shell, and merges.

## Spec of record (read before writing code)

1. The design: claude-design MCP, project id `c86680f5-6095-4d75-a1a5-d1418936719e`, file **`Intel Dossier.dc.html`** (read via `read_file`; its in-file annotation table is part of the spec). If the MCP is unreachable, STOP and say so in your wrap — do not build from memory.
2. `docs/research/workspace-phase-d-designs.md` — the decision ledger (design #4 is yours; the survey answers and v1 exclusions bind you).
3. `DESIGN.md` §5 — list grammar incl. the Bounded-List Rule. Two-channel purity: **blue = act, amber/bronze = signal-only** — audit every color you place.
4. `docs/research/workspace-ux-v2.md` §1/§3 — the dossier/context-spine critique the design answers.
5. The current surfaces: `apps/web/src/components/intel/`, `components/library/`, and their routes — reuse the data wiring; the redesign reshapes presentation.

## What the design demands (headlines, not a substitute for reading it)

- The dossier card as launchpad: heat + magnitude + outlier, provenance with source link, why-it's-moving, 4 ready titles with copy buttons, 3 angles, 1 hook, per-family exits with an honest "suggested" pre-pick.
- Cadence stamp + Sweep-now in the header; watchlist chips in place (auto-discovered wear a bronze "auto" word); Dismiss = the quiet teaching verb.
- Rising list bounded (14rem, count stated). Every bound states its count — no silent truncation.
- Pick is a state, not a route: the pick exits live on the dossier cards (the spine's station 2 will point here).

## Gates

- Light-first workspace styling; keyboard grammar preserved where the surface has one (useListKeys).
- Tests updated/added in the same change (`__tests__` dirs); the affected web tests + lint must be green before wrap.
- Accessibility: interactive elements are real buttons/links; sr-only where the design uses visual-only signals.
- No AGPL or copied third-party code; no new dependencies.

## Wrap

1. From the worktree root: `pwsh scripts/ci-grep-guard.ps1` — must be clean.
2. Run the web test suite for your owned dirs + lint; report results honestly (red = say so).
3. Conventional commit(s) on `lane/w-intel` (e.g. `feat(web): intel dossier redesign - ...`). **No AI attribution anywhere.**
4. End with a founder-readable summary: what was built vs the design, any honest deviations + why, data gaps flagged, test/lint status. Then stop — do not idle-loop.
