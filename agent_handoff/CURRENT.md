# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-06 (session 13) · **B6 CONTRACT WINDOW MERGED + FROZEN (PR #25) · wave-1 lanes fully prepped (worktrees + kickoffs) · founder chose Mode B via VS Code, launching NEXT session — the resume prompt below carries the go for exactly the three named lanes.**

## Resume prompt (paste verbatim to resume next session)

> Stamped 2026-07-06 19:09 (UTC+10:00). Safe to `/clear` after reading — see the clear-safe line at the end.

**Resume · Thalon** — stamped **2026-07-06 19:09 (UTC+10:00)** · Sprint 6 wave-1 launch (Mode B via VS Code). E:\thalon, main @ `25fc7ca`.

▎ ▸ Read `CLAUDE.md` → `agent_handoff/CURRENT.md` → `COORDINATION.md` (Sprint-6 board + the two 2026-07-06 wrap messages). The contract is FROZEN (PR #25, `570ce1e`): waitlist · monitored_areas · search_targets/search_snapshots · seoMeta capability; suite carries **596 passed / 3 skipped**. Deep specs only if needed — each lane kickoff carries its own reading list.

▎ ▸ **First act: wave-1 Mode B launch — this pasted prompt IS the founder's go for EXACTLY these three lane runs** (landing B6.1 · intel-engine B6.4 · search-engine B6.8), per the Sprint-4 precedent. Founder opens three VS Code terminals at `.claude/worktrees/landing` · `.claude/worktrees/intel-engine` · `.claude/worktrees/search-engine` (already prepped + verified; branches `agent/landing/b61-brand-landing` · `agent/intel/b64-areas-ranker` · `agent/search/b68-search-intel`), runs `claude` in each, pastes the matching kickoff from `.context/kickoffs/{landing,intel-engine,search-engine}.md` (gitignored; also copied into each worktree's `.context/`). Lead watches from the main terminal, answers stop-and-reports, drives the merge train **landing → intel-engine → search-engine** (rebase → CI → review → merge; worktrees are cut from `c2c7cc2`, main tip is `25fc7ca` — a one-commit rebase at merge is expected). **Any agent run beyond these three (reviewer agents, fix-round resumes) = pause for approve-or-defer.**

▎ ▸ **After `landing` merges:** cut wave 2 (workspace B6.2 · self-tenant B6.3) per the board — **fresh founder go required for that launch.**

▎ ▸ **Ratified, do not re-litigate:** contract frozen — lane friction ⇒ stop-and-report, never edit · never `npm install` in a worktree (deps = package.json edit + report; install runs in main) · one web writer per wave (landing only, wave 1) · no publish path in Sprint 6 · honest-claims rule on landing copy (ADR 0006) · guard hygiene: the founder brand-reference folder path contains guard token A — never echo it into tracked files.

▎ ▸ **New this session (use them):** `/contract-window` skill (the window SOP — invoke for any future schema/contract window) · tenant-salted-unique-index ratchet now executable in `packages/db/src/__tests__/tenant-id.test.ts`.

▎ ▸ **[you] — founder-supplied (none block wave 1):** domain registration (B6.7) · pricing tiers for landing §3 (placeholder until supplied) · gateway top-up (B6.5+) · transcript-vendor API key (B6.5) · optional Google Trends API alpha application · LinkedIn + X OAuth apps (parallel paperwork) · carried: guard-token scrub decision for historical commit `0b11d48`.

▎ ▸ **✅ SAFE TO CLEAR.** As of the stamp: working tree clean, local = remote (main `25fc7ca`), suite 596/3 (root run this session), guard passing, no open PRs, three prepped-idle worktrees (deliberate — wave 1), no mid-edit state.

---

## Pointer

Read in order: `CLAUDE.md` → this file → `COORDINATION.md` (Sprint-6 board + wrap messages). Lane kickoffs: `.context/kickoffs/*.md`. Frozen contract surfaces: `packages/db/src/schema/{intel,search,web}.ts` + repos (`monitored-areas` · `search-targets` · `search-snapshots` · `waitlist`) · `packages/contracts/src/{intel,search-intel}.ts` + the format-registry `seoMeta` capability. Deep specs: `CHARTER.md` (Sprint 6) · ADRs 0005/0006 · `docs/FRONTEND.md`.

## Delta (this session — session 13; PRs #25 #26, main `6f6c69f` → `25fc7ca`)

- **B6 contract window merged + frozen** (PR #25, rebase-merged `570ce1e`): migration 0005 (purely additive) — `waitlist` (idempotent join, monotonic position, loud code-collision) · `monitored_areas` (description as expansion seed + embedding anchor; validated config; paused-never-deleted) · `search_targets`/`search_snapshots` (watchlists/trend_snapshots mirrors; first-origin-wins; page='' keeps the idempotency key total) · contracts configs + seoMeta capability (additivity test-pinned). Suite 580 → 596/3. Full detail: the COORDINATION wrap message.
- **Founder-approved SOP follow-up** (PR #26, `25fc7ca`): `/contract-window` project skill (exemplar map + invariant checklist + mechanical sequence; kills the per-window pattern-survey cost) + executable ratchet: every composite uniqueIndex leads with tenant_id (one documented transitive exemption).
- **Wave-1 prep complete:** three worktrees added at `c2c7cc2` + `worktree:setup` verified each (junctions, env/vault includes, identity, eslint, guard); kickoffs authored in `.context/kickoffs/`.
- Founder decisions this session: mechanize-the-boilerplate direction (skill + ratchet yes, code generator no) · **wave-1 launch = next session via the vscode method (Mode B)** — the resume prompt above is the go for exactly those three lanes.

## Next action

Founder: paste the resume prompt into the lead terminal, then open the three VS Code terminals and paste the kickoffs. Lead: orchestrate wave 1, merge train landing → intel-engine → search-engine, then propose wave 2.

## [you] — founder-supplied (Sprint 6)

- Domain registration (blocks go-live only, B6.7).
- Pricing-tier names/prices for landing §3 (placeholder until supplied).
- Gateway credit top-up (B6.5 judge-tier dogfood onward).
- Transcript-vendor API key (B6.5).
- Optional: Google Trends API alpha application (B6.8 nice-to-have, never a dependency).
- LinkedIn + X OAuth developer apps (parallel paperwork; publisher stays pulled).
- Carried: decision on scrubbing the guard token from historical commit `0b11d48`.
