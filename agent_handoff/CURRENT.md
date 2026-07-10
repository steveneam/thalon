# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-10 (session 23) · **ENVIRONMENT MOVE PREPARED — sprint queue UNCHANGED, no code changes.** Everything the build needs now travels outside this machine (all detail deliberately gitignored: `.context/migration/PLAN.md`). Next act = **founder activates the lead in the new environment** → bring-up audit → then the session-22 queue exactly as written: deploy `thalon-web` at handoff-pack, then the B6.7 exit-gate tail.

## Resume prompt (paste verbatim on the new environment's first session)

> Stamped 2026-07-10. Written for a fresh host; also works unchanged on the old one.

**Resume · Thalon** — Sprint 6, **B6.7 deploy + exit gate** — first session after the environment move.

▎ ▸ **Bring-up audit FIRST — no sprint work until green.** Follow `.context/migration/PLAN.md` (gitignored; travels outside git) and the restore manifests it names. Verify in order: repo clone + `git config user.email steveneam@hotmail.com` + `npm ci` · `.context/` present at the clone root and still gitignored (`git status` shows none of it) · `apps/web/.env.local` present · **memories loaded** (the memory index lists ~20 entries — if empty, the project-dir slug rename step was missed) · vault restored and the pointer in `.context/READ-ME-FIRST.md` updated · `gh auth login` (device flow, phone browser) · pwsh installed → `pwsh scripts/ci-grep-guard.ps1` returns PASS · full suite green. Report gaps to the founder and fix together. **If `.context/` or memories are missing entirely — STOP and ask the founder for the migration materials.**

▎ ▸ Then read: `CLAUDE.md` → this file → `COORDINATION.md` session-22 message + its two addenda → `.context/notes/thalon-wiring-brief-2026-07-08.md` + `thalon-wiring-replies-2026-07-08.md` → memories `vps-deploy-swordfish` · `net-positive-speedups` · `machine-migration-2026-07-10`.

▎ ▸ **Queue (unchanged from session 22):** (1) if the infra handoff pack has landed ([founder] relays: scoped deploy credential + GHCR pull slot + staging hostname + volume) — **deploy the container behind the staging hostname** (create domains BEFORE first deploy per their landmine notes; runtime env per the day-one list in the replies note: WORKSPACE_BASIC_AUTH + DB_DUMP_TOKEN required, gateway key, TREND_SOURCE=bluesky + creds) → verify health/gate/dump-hook from the box → their pre-backup.d integration. (2) B6.7 exit-gate tail: hyperframes temp-jobDir cleanup · exit reviews across the three families · full green suite = sprint exit. (3) Carried: GSC verification at domain-live (arming checklist `docs/DATA-SPINE.md` §4). Note: **Docker is available in the new environment** — `Dockerfile.web` can be built/run locally now.

▎ ▸ **Stealth mode unchanged (founder call, on the record):** the real domain stays UNWIRED until the launch call (CT-log permanence); staging = neutral hostname + edge BasicAuth + noindex; the image bakes the launch origin so launch = add domains + DNS flip + drop edge auth, zero rebuild.

▎ ▸ **[founder] queue:** relay the wiring-replies note + handoff pack back · production transcript key · LinkedIn Page paperwork · X dev app · optional Trends alpha · carried `0b11d48` scrub decision · landing-template family = charter candidate at the next checkpoint · **post-move key rotation, founder-timed (locations listed in `.context/migration/PLAN.md`)**.

▎ ▸ **✅ SAFE TO CLEAR.** As of the stamp: no code changes this session; working tree clean (two stray local `.bak`s only); local = remote on main; guard passing; suite state unchanged from session-22 green; no open PRs; no worktrees; no mid-edit state.

## Pointer

Read in order: `CLAUDE.md` → this file → (new host only: `.context/migration/PLAN.md`) → `COORDINATION.md` session-22 message → `docs/adr/0007-vps-deploy-recharter.md` → the two wiring notes in `.context/notes/` → memory (`vps-deploy-swordfish`, `machine-migration-2026-07-10`). Founder runbook: `.context/runbooks/keys.md`.

## Delta (session 23)

- Environment move prepared end-to-end; every build dependency now travels outside this machine. All specifics deliberately gitignored (`.context/migration/PLAN.md`) — tracked files carry only this pointer.
- Sprint queue untouched; zero code changes.

## Next action

Founder: activate the lead in the new environment when it exists; paste the resume prompt above. Lead: bring-up audit → deploy-at-handoff-pack → exit-gate tail.
