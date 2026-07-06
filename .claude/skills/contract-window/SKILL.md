---
name: contract-window
description: Open, build, and freeze a sprint contract window — additive tables/repos in packages/db plus config schemas/capabilities in packages/contracts. Use when the charter or lane board calls for "the sprint's contract window", or any time new tables, repos, or contract schemas are being added between lane launches.
---

# Contract window SOP

> **Ratchet grade: opinion** (convention — revise freely at re-charter). The invariants it points at are executable tests; this file is the map, not the enforcement. One window per sprint, ONE owner, lead terminal, **freezes at merge** — every lane consumes it frozen; a lane needing a mid-sprint contract edit = re-plan, never an ad-hoc edit (COORDINATION.md header).

## 1. Scope the window (judgment — do not skip to code)

- Read the sprint's charter intro + its ADRs. The window = **ALL** additive schema/contract needs for the sprint's lanes, consolidated (A13 lesson: one opening window beats two mid-sprint ones).
- For each need, decide: new table, new column, or **no schema change at all** — open `jsonb meta` columns often already carry it (Sprint-6 example: area provenance on exemplars rides `sources.meta.trend`, zero migrations).
- Everything is **additive-only**: never rename/remove a field or tighten a type outside a window; inside one, only with an explicit charter mandate.

## 2. Mirror the exemplars (read these, don't re-derive)

| Shape needed | Canonical exemplar |
|---|---|
| Config-row table (tenant runtime config) | `packages/db/src/schema/intel.ts` (`watchlists`, `monitored_areas`) + `repos/watchlists.ts`, `repos/monitored-areas.ts` |
| Append-only snapshot/history table | `schema/intel.ts` `trend_snapshots` / `schema/search.ts` `search_snapshots` + their repos — structural idempotency key, `onConflictDoNothing` + read-back-or-throw, `created` flag, event on creation only |
| Idempotent get-or-create with provenance | `repos/search-targets.ts` (first origin wins) · `repos/waitlist.ts` (monotonic position, collision fails loud) |
| Contracts config schema (zod) | `packages/contracts/src/intel.ts`, `src/search-intel.ts` |
| Format-registry capability extension | `packages/contracts/src/format-registry.ts` — new capability flag + **optional** meta field, additivity test-pinned |

**zod 4 trap (test-pinned in `contracts/src/__tests__/intel.test.ts`):** `.partial()` does NOT strip `.default()` — a "partial override" schema built that way fills defaults on parse and silently pins unset values. Write an explicit `…OverridesSchema` with `.optional()` fields.

**Postgres trap:** NULLs are distinct in unique indexes — a nullable column in a structural idempotency key breaks replay-appends-nothing. Use a `''`/sentinel default (`search_snapshots.page`).

## 3. Invariant checklist (each is an executable ratchet — extend it in the SAME change)

- **tenant_id on every table** → add the table name to the list in `packages/db/src/__tests__/tenant-id.test.ts`.
- **Composite unique indexes lead with tenant_id** (structural idempotency keys are tenant-salted) → same file; transitive salting via a tenant-scoped uuid FK goes in the exemption map with a reason.
- **Every state-changing repo write emits an `events` row in the same transaction** → pin the event names in the sprint's repo test file (the `sprint6-repos.test.ts` pattern); the header of `events-coverage.test.ts` says where the pins live. Reads and idempotent replays emit nothing.
- **Enum-ish text columns get check constraints** whose literals come from contracts `as const` arrays (`content.ts` `inList` pattern) — one source of truth.
- **Repos validate config at the write door** (zod parse — invalid config fails loud, nothing stores) and are **tenancy-walled** (every WHERE carries `ctx.tenantId`; foreign writes throw `NotFoundError`).
- **Registry/meta changes must let every pre-window draft parse unchanged** — prove it with an additivity test (old meta without the new field parses; the engine format-registry ratchet stays green).

## 4. Mechanical sequence

1. Branch `agent/contract/<sprint>-window` from clean main.
2. Contracts first (schemas + enums + capability), export from `contracts/src/index.ts`.
3. Schema files (import the contracts enums for checks), export from `schema/index.ts`.
4. Repos (mirror an exemplar), wire `repos/index.ts` + row-type exports in `db/src/index.ts`.
5. `npm run generate -w @thalon/db -- --name <sprint>_window` → **read the generated SQL and confirm it is purely additive** (CREATE/ADD only).
6. Tests: extend the tenancy ratchet lists · new `<sprint>-repos.test.ts` (tenancy wall + idempotent replay + event pins per repo) · contracts tests (validation + additivity proof).
7. Verify: workspace suites (`-w @thalon/contracts`, `-w @thalon/db`) → root `npm test` + `npm run typecheck` + `npm run lint` + the grep guard.
8. Commit (`git commit -F <file>` for multi-line), PR via `--body-file`, CI green, **rebase-merge → the contract is frozen**. Update the COORDINATION.md status cell + append the wrap message (bottom of the log), then prep lanes.

## 5. What does NOT belong in a window

Driver implementations, pollers, UI, prompts, judge lenses — those are lane work against the frozen contract. The window ships storage + validated shapes + capabilities + their ratchets, nothing that *runs* against live services.
