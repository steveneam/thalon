# COORDINATION — lane board

> Parallel-lane ledger (protocol: `docs/SPINE.md` §5). **One writer per row** — the lead owns assignments + merge-order; each owner writes only its own `status`. Messages append-only. Status vocab: `pending · in_progress · blocked:<what> · review · merged`. **Contract** = `packages/contracts` + the drizzle schema — frozen per sprint once committed; a lane needing to edit it mid-flight = re-plan, not an ad-hoc edit. Merges serialize through `main` in merge-order: rebase → CI green (guard + lint + tests) → review → merge; never on red.

## Sprint 0 — proposed lanes (activate on founder go)

| lane | owner | owns (glob) | branch | status | depends-on | merge-order |
|------|-------|-------------|--------|--------|------------|-------------|
| a-core | lead terminal | `packages/**`, `proprietary/**`, `apps/web/**`, `eval/**` (B0.3 → B0.4) | `agent/a/b03-schema` | review | — | 1 |
| b-aws | second terminal (`claude --worktree b05-aws`) | `infra/**` (B0.5) | `worktree-b05-aws` | pending | AWS sub-account ([you]) | 2 |

## Messages (append-only)

- 2026-07-03 lead: board created. B0.3→B0.4 vs B0.5 are file-disjoint per the charter; Lane B is inert until the founder opens the second terminal (or we fall back to sequential). Worktree prereqs landed: `.worktreeinclude`, `.claude/settings.json` symlinks `node_modules`, dev DB/store/queue isolate per worktree via the local seams.
- 2026-07-03 lead: B0.3 complete on `agent/a/b03-schema` → at the founder checkpoint (status `review`). Contract (`packages/contracts` + drizzle schema) is now committed — **frozen for the sprint**. Lane B unaffected (`infra/**` untouched).
