# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-11 (session 24, late) · **SPRINT 6 EXIT CRITERIA MET + SPRINT 7 PROPOSED.** B6.7 exit tail complete this session: temp-jobDir leak fixed (cleanup-handle contract + 4 tests), exit reviews across all three families recorded in `COORDINATION.md` (invariants grep-proven at the root), **full suite 1050 passed / 3 skipped / 0 failed**. Sprint-6 exit awaits founder ratification at this checkpoint, alongside two open decisions: **approve the Sprint-7 charter proposal** (`docs/proposals/2026-07-11-visual-uplift-and-template-portfolio.md` — visual uplift via asset-vendor MCP · AssetSource seam · 25-vertical template portfolio · competitor-informed buckets) and **pick the vendor tier** (Plus recommended, one production month). Vendor MCP added by founder, appears next session. Earlier same session: two-homes environment state below (laptop ACTIVE this weekend; box idle on syd4; ops rules in `agent_handoff/FROM-SWORDFISH-2026-07-11.md`).

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

## Resume prompt (LAPTOP session 25 — paste verbatim)

> Stamped 2026-07-11, session-24 wrap.

**Resume · Thalon** — session 25, laptop (active home) — **Sprint-6 exit checkpoint + Sprint-7 kickoff.**

▎ ▸ **Read first:** `CLAUDE.md` → this file → `COORDINATION.md` session-24 entry (the exit-review record) → `docs/proposals/2026-07-11-visual-uplift-and-template-portfolio.md` → memories `higgsfield-kompozy-assignment` · `machine-migration-2026-07-10`.

▎ ▸ **State:** main = origin @ `6408afc` · suite **1050/3/0 green** · guard clean · B6.7 exit tail DONE (temp-jobDir fix + three-family exit reviews recorded) · Sprint-6 exit criteria MET, ratification pending.

▎ ▸ **Three founder decisions open this session:** (1) ratify Sprint-6 exit; (2) approve/amend the Sprint-7 proposal; (3) Higgsfield tier — **Plus one month recommended** (free tier = watermarked + promo/training license: wiring smoke-test ONLY, never shipped assets).

▎ ▸ **Then:** verify the Higgsfield MCP loaded (founder connected it session 24; if absent, re-check the connector config with the founder). On approval → **Sprint 7 Phase 1**: asset-pinning module + provenance manifest first (the independence ratchet), then landing-page uplift (images before video), ≥3 iteration passes + browser-verify per surface.

▎ ▸ **Standing constraints:** re-check network posture at start (hotspot = relaxed, otherwise websites+GitHub only) · **AWS untouchable** · no Docker on the laptop · git is the bus (wrap = guard+commit+push) · stealth: neutral hosting names, real domain stays unwired.

## Resume prompt (box-side first session — paste after the secrets folder lands)

> Stamped 2026-07-10, still current for the box. On the LAPTOP, use the session-25 prompt above instead.

**Resume · Thalon** — Sprint 6, **B6.7 deploy + exit gate**.

▎ ▸ **Bring-up audit FIRST — no sprint work until green.** Follow `.context/migration/PLAN.md` (gitignored; travels outside git) and the restore manifests it names. Verify in order: repo clone + `git config user.email steveneam@hotmail.com` + `npm ci` · `.context/` present at the clone root and still gitignored (`git status` shows none of it) · `apps/web/.env.local` present · **memories loaded** (the memory index lists ~20 entries — if empty, the project-dir slug rename step was missed) · vault restored and the pointer in `.context/READ-ME-FIRST.md` updated · gh auth live · pwsh installed → `pwsh scripts/ci-grep-guard.ps1` returns PASS · full suite green. Report gaps to the founder and fix together. **If `.context/` or memories are missing entirely — STOP and ask the founder for the migration materials.**

▎ ▸ Then read: `CLAUDE.md` → this file → `agent_handoff/FROM-SWORDFISH-2026-07-11.md` → `COORDINATION.md` session-22 message + its two addenda → `.context/notes/thalon-wiring-brief-2026-07-08.md` + `thalon-wiring-replies-2026-07-08.md` → memories `vps-deploy-swordfish` · `net-positive-speedups` · `machine-migration-2026-07-10`.

▎ ▸ **Queue (session 24):** (1) **Founder checkpoint FIRST:** ratify Sprint-6 exit (exit-review record = `COORDINATION.md` session-24 entry) · approve/amend the Sprint-7 proposal (`docs/proposals/2026-07-11-visual-uplift-and-template-portfolio.md`) · vendor-tier decision (Plus recommended; free tier = watermarked + promo/training license, never ship its assets). (2) On approval, Sprint 7 Phase 1: asset-pinning module + provenance manifest, then landing → blog → workspace uplift via the vendor MCP (founder connected it; verify it loaded at session start), ≥3 iteration passes + browser-verify per surface. (3) Deploy thread unchanged: if the infra handoff pack lands ([founder] relays: scoped deploy credential + GHCR pull slot + staging hostname + volume) — deploy the container behind the staging hostname (domains BEFORE first deploy; runtime env day-one list: WORKSPACE_BASIC_AUTH + DB_DUMP_TOKEN required, gateway key, TREND_SOURCE=bluesky + creds) → verify health/gate/dump-hook → pre-backup.d integration; Swordfish's six ask-backs still outstanding. (4) Carried: GSC verification at domain-live (`docs/DATA-SPINE.md` §4). Docker available on the box only (never the laptop).

▎ ▸ **Stealth mode unchanged (founder call, on the record):** the real domain stays UNWIRED until the launch call (CT-log permanence); staging = neutral hostname + edge BasicAuth + noindex; the image bakes the launch origin so launch = add domains + DNS flip + drop edge auth, zero rebuild.

▎ ▸ **[founder] queue:** scp `thalon-migration/secrets/` from the drive to the box · relay the wiring-replies note + handoff pack back · production transcript key · LinkedIn Page paperwork · X dev app · optional Trends alpha · carried `0b11d48` scrub decision · landing-template family = charter candidate at the next checkpoint · **post-move key rotation, founder-timed (locations listed in `.context/migration/PLAN.md` + drive manifests)**.

▎ ▸ **✅ SAFE TO CLEAR.** As of the stamp: session-24 code change (render cleanup contract: `target.ts` · `hyperframes-target.ts` · `render.ts` + tests) committed with the suite green at 1050/3/0; guard passing; local = remote on main after push; no open PRs; no worktrees; no mid-edit state.

## Pointer

Read in order: `CLAUDE.md` → this file → `agent_handoff/FROM-SWORDFISH-2026-07-11.md` → (box only: `.context/migration/PLAN.md`) → `COORDINATION.md` session-22 message → `docs/adr/0007-vps-deploy-recharter.md` → the two wiring notes in `.context/notes/` → memory (`vps-deploy-swordfish`, `machine-migration-2026-07-10`). Founder runbook: `.context/runbooks/keys.md`.

## Delta (session 24)

- Swordfish ops handoff received and committed (`FROM-SWORDFISH-2026-07-11.md`): two copies of the agent now exist; laptop active this weekend; sync rules recorded above.
- Repo gitignored payload staged copy-only to the drive (`thalon-migration/secrets/`, 3,360 files / 88.3 MB, counts verified against source) with restore map (`RESTORE.md`) + refresh block; drive MANIFEST updated — its "nothing to stage" claim superseded.
- New founder assignment researched inline (asset-vendor MCP + competitor teardown) → Sprint-7 proposal committed (`docs/proposals/`); founder connected the vendor MCP (loads next session); tier decision pending.
- **B6.7 exit tail COMPLETE**: temp-jobDir cleanup (contract-level `cleanup` handle; failure-path release in the target; caller releases after persist; 4 new tests) · three-family exit reviews recorded in `COORDINATION.md` (single-status-writer + body-hash judge invariant, gateway-guard coverage, approved-only web doors, all carried items verified landed) · **suite 1050/3/0 green** · typecheck + guard clean.

## Next action

Founder: ratify Sprint-6 exit + approve Sprint-7 proposal + vendor tier (three decisions, next session) · scp the drive's `thalon-migration/secrets/` folder to the box whenever it becomes active. Lead: on approval, Sprint 7 Phase 1 (asset-pinning ratchet → landing uplift first).
