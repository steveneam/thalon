# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-11 (session 24) · **TWO HOMES NOW EXIST — laptop ACTIVE, box idle; gitignored payload staged to the drive.** The founder's environment moved to a Linux workstation VPS ("syd4") on 2026-07-11; `~/work/thalon` there is a fresh clone, content-identical to origin/main, with agent memory re-attached from a 2026-07-10 seed. **This Windows laptop (`E:\thalon`) is the active home this weekend.** Full ops rules: `agent_handoff/FROM-SWORDFISH-2026-07-11.md` (committed alongside this). Sprint queue UNCHANGED from session 22.

## Sync rules (binding, from Swordfish ops — see the FROM-SWORDFISH file)

- **Git is the bus.** Every session ends commit + push; the box-side copy catches up with `git pull`. Never hand-copy repo files over the box's clone.
- **One active home at a time.** While the laptop is active, the box-side agent does not run.
- **Laptop network rule:** IT-monitored — general websites + GitHub (git/gh over HTTPS) only; anything else needs founder go-ahead first.
- Box auth (claude + gh) is already live per-box; no logins needed there.
- Headless phone-dispatched runs may land on isolated branches — review as PRs/diffs, normal rules.

## Gitignored payload — staged 2026-07-11, restore map (for the box-side agent)

Nothing gitignored crossed with the fresh clone. Staged copy-only to the migration drive at `thalon-migration/secrets/` (3,360 files / 88.3 MB), mirroring repo-relative paths; the founder scp's that folder to the box. **Authoritative restore commands + full inventory: `secrets/RESTORE.md` inside that folder.** Summary — restore each item to the same repo-relative path under the clone root (`~/work/thalon/`):

| Item | Note |
|---|---|
| `apps/web/.env.local` 🔐 | the 12 runtime vars; rotate post-migration per the drive manifests |
| `.context/` | vault pointer + prompts + notes + tenant profiles + runbooks + tools (renders/ excluded — regenerable). Stays gitignored; fixup: repoint `.context/READ-ME-FIRST.md` at the vault's new location |
| `.data/` · `apps/web/.data/` · `eval/.data/` | PGlite dev DBs / object store — dogfood state carried to avoid re-seeding |
| `.claude/settings.local.json` | reference only — Windows paths; recreate on the box |

After restore: `git status --short` in the clone must show none of it. Then the session-23 bring-up audit below still applies verbatim.

## Resume prompt (box-side first session — paste after the secrets folder lands)

> Stamped 2026-07-10, still current. On the LAPTOP, skip the bring-up audit and just work the queue.

**Resume · Thalon** — Sprint 6, **B6.7 deploy + exit gate**.

▎ ▸ **Bring-up audit FIRST — no sprint work until green.** Follow `.context/migration/PLAN.md` (gitignored; travels outside git) and the restore manifests it names. Verify in order: repo clone + `git config user.email steveneam@hotmail.com` + `npm ci` · `.context/` present at the clone root and still gitignored (`git status` shows none of it) · `apps/web/.env.local` present · **memories loaded** (the memory index lists ~20 entries — if empty, the project-dir slug rename step was missed) · vault restored and the pointer in `.context/READ-ME-FIRST.md` updated · gh auth live · pwsh installed → `pwsh scripts/ci-grep-guard.ps1` returns PASS · full suite green. Report gaps to the founder and fix together. **If `.context/` or memories are missing entirely — STOP and ask the founder for the migration materials.**

▎ ▸ Then read: `CLAUDE.md` → this file → `agent_handoff/FROM-SWORDFISH-2026-07-11.md` → `COORDINATION.md` session-22 message + its two addenda → `.context/notes/thalon-wiring-brief-2026-07-08.md` + `thalon-wiring-replies-2026-07-08.md` → memories `vps-deploy-swordfish` · `net-positive-speedups` · `machine-migration-2026-07-10`.

▎ ▸ **Queue (unchanged from session 22):** (1) if the infra handoff pack has landed ([founder] relays: scoped deploy credential + GHCR pull slot + staging hostname + volume) — **deploy the container behind the staging hostname** (create domains BEFORE first deploy per their landmine notes; runtime env per the day-one list in the replies note: WORKSPACE_BASIC_AUTH + DB_DUMP_TOKEN required, gateway key, TREND_SOURCE=bluesky + creds) → verify health/gate/dump-hook from the box → their pre-backup.d integration. Note Swordfish's six ask-backs from the wiring brief remain outstanding; staging/Dokploy wiring waits on those + the parked DNS cutover. (2) B6.7 exit-gate tail: hyperframes temp-jobDir cleanup · exit reviews across the three families · full green suite = sprint exit. (3) Carried: GSC verification at domain-live (arming checklist `docs/DATA-SPINE.md` §4). Docker is available on the box — `Dockerfile.web` can be built/run locally there (never on the laptop).

▎ ▸ **Stealth mode unchanged (founder call, on the record):** the real domain stays UNWIRED until the launch call (CT-log permanence); staging = neutral hostname + edge BasicAuth + noindex; the image bakes the launch origin so launch = add domains + DNS flip + drop edge auth, zero rebuild.

▎ ▸ **[founder] queue:** scp `thalon-migration/secrets/` from the drive to the box · relay the wiring-replies note + handoff pack back · production transcript key · LinkedIn Page paperwork · X dev app · optional Trends alpha · carried `0b11d48` scrub decision · landing-template family = charter candidate at the next checkpoint · **post-move key rotation, founder-timed (locations listed in `.context/migration/PLAN.md` + drive manifests)**.

▎ ▸ **✅ SAFE TO CLEAR.** As of the stamp: no code changes this session (handoff docs only); guard passing; local = remote on main after push; suite state unchanged from session-22 green; no open PRs; no worktrees; no mid-edit state.

## Pointer

Read in order: `CLAUDE.md` → this file → `agent_handoff/FROM-SWORDFISH-2026-07-11.md` → (box only: `.context/migration/PLAN.md`) → `COORDINATION.md` session-22 message → `docs/adr/0007-vps-deploy-recharter.md` → the two wiring notes in `.context/notes/` → memory (`vps-deploy-swordfish`, `machine-migration-2026-07-10`). Founder runbook: `.context/runbooks/keys.md`.

## Delta (session 24)

- Swordfish ops handoff received and committed (`FROM-SWORDFISH-2026-07-11.md`): two copies of the agent now exist; laptop active this weekend; sync rules recorded above.
- Repo gitignored payload staged copy-only to the drive (`thalon-migration/secrets/`, 3,360 files / 88.3 MB, counts verified against source) with restore map (`RESTORE.md`) + refresh block; drive MANIFEST updated — its "nothing to stage" claim superseded.
- Zero code changes; sprint queue untouched.

## Next action

Founder: scp the drive's `thalon-migration/secrets/` folder to the box (whenever the box becomes active). Laptop-side lead: continue the session-22 queue here this weekend. Box-side lead: restore per the map above → bring-up audit → queue.
