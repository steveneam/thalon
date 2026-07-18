# Lane kickoff — W-boards (s60 workspace Phase I)

You are a Phase I build lane on branch `lane/w-boards` in this worktree. The founder approved this run (s60 opener, "GO — all three"). You implement the approved **Content Calendar (month)**, **Calendar Week**, and **Leads Board** designs in the real Next.js workspace app. This is design implementation — the design files are the spec of record; build what they show, not a variation on it. Three designs = the biggest lane; month calendar first, then week, then the board.

## Scope — hard boundaries

- You own ONLY: **new homes** `apps/web/src/components/calendar/**` · `apps/web/src/components/board/**` (create them) · a **new route** `apps/web/src/app/app/calendar/**` · `apps/web/src/app/app/leads/**` + `apps/web/src/components/leads/**` (the board mounts as a saved-view tab on the Leads surface — keep the leads diff minimal: the tab wiring, not a leads rewrite). Touch no other path — not the app shell (`app/app/layout.tsx`, `app/app/page.tsx`), not `components/ui`, not handoff files, not COORDINATION.md.
- **UI-only. The contract is frozen:** no edits to `packages/contracts`, `packages/db`, migrations, or any API route's request/response shape. Bind to existing repos/APIs/hooks (leads stage field is operator-owned data that exists; scheduled-content reads come from existing surfaces). If the design needs data that doesn't exist, render an honest empty/planned state and flag it in your wrap — never invent a schema change. Known v1 exclusions (checkpoint-flagged, do NOT build): recurrence series-edit + date overrides (v1 = one-shot only, marker grammar only) · undo-after-terminal · per-tenant audience-zone lock.
- **Never `npm install`** (root preinstall guard; this worktree is prepped).
- Commit to `lane/w-boards` only. Do NOT push, do NOT merge, do NOT touch main. The lead batch-reviews, rebases you onto the merged W-spine shell, and merges.

## Spec of record (read before writing code)

1. The designs: claude-design MCP, project id `c86680f5-6095-4d75-a1a5-d1418936719e`, files **`Content Calendar.dc.html`**, **`Calendar Week.dc.html`**, **`Leads Board.dc.html`** (read via `read_file`; the in-file annotation tables are part of the spec). If the MCP is unreachable, STOP and say so in your wrap — do not build from memory.
2. `docs/research/workspace-phase-d-designs.md` — the decision ledger (designs #2, #3, #7 and all nine survey answers; the v1 exclusions bind you).
3. `DESIGN.md` §5 — list grammar incl. the Bounded-List Rule. Two-channel purity: **blue = act, amber/bronze = signal-only** — advisory WIP "over" is a bronze word, never a block.
4. `docs/research/boards-calendar-ui-patterns.md` — the survey behind the designs (§4 adopt/adapt/reject).
5. The current Leads surface: `apps/web/src/components/leads/` + its route — the board is a tab beside the existing list view, sharing its data wiring.

## What the designs demand (headlines, not a substitute for reading them)

- **Calendar (month)** — month grid + right-hand day panel (same route, no navigation); Month/Week/Agenda density tabs; channel filter chips + first-class exclusion filters; always-visible operator-local timezone chip; drag-to-reschedule = one update + Terminal Toast with "view" link, no dialog; terminal verbs are never drop targets; recurrence marker = word + icon ("↻ wk"); cells show 3 chips then "+N more"; day panel scrolls internally past 8; always scoped to the active tenant.
- **Calendar Week** — 06:00–20:00 window, quiet hours collapsed with honest count; ONE shared time→position mapping (a label may never drift from the slot it names); now-line on the act channel; same drag/toast/terminal discipline as month.
- **Leads Board** — the only v1 board, a saved-view tab on Leads: columns = operator-owned stage field values; drag = one UPDATE; advisory WIP `count / limit · over` chip (bronze word, never blocks); GitHub-model saved views with unsaved-dot + word (per-operator until "Save view" shares tenant-wide); bulk bar spans columns; Dismissed stays a tab, never a column; board region 30rem with sticky-header counts; 2D keyboard grammar — useListKeys extended: j/k in column, h/l across, x multi-select spans columns, Four-Verbs letters act, named confirms intact.

## Gates

- Light-first workspace styling. Every bound states its count — no silent truncation.
- Tests updated/added in the same change (create `__tests__` dirs in your new homes); the affected web tests + lint must be green before wrap.
- Accessibility: drag affordances have keyboard + AT equivalents (the 2D grammar IS the keyboard path — wire it, don't stub it); toasts announced politely.
- No AGPL or copied third-party code; no new dependencies (no dnd libraries — hand-rolled HTML5 drag or pointer events, matching repo idiom).

## Wrap

1. From the worktree root: `pwsh scripts/ci-grep-guard.ps1` — must be clean.
2. Run the web test suite for your owned dirs + lint; report results honestly (red = say so).
3. Conventional commit(s) on `lane/w-boards` (e.g. `feat(web): calendar month/week + leads board - ...`). **No AI attribution anywhere.**
4. End with a founder-readable summary: what was built vs the designs, any honest deviations + why, data gaps flagged, test/lint status. Then stop — do not idle-loop.
