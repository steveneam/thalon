# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-13 (session 25, first on syd4) · **BRING-UP AUDIT GREEN + SWORDFISH ASK-BACKS DELIVERED.** The box is now the ACTIVE home (laptop era over; drive-letter paths in older notes are dead). Restored payload verified: env.local (12 vars) · `.context/` incl. vault pointer → `/home/deploy/vault` · `.data` trees · memory (20 entries) · gh auth · guard PASS · **suite 1012/3/0 = exact CI parity on the same commit** (session-24's "1050" included ~38 laptop-local registrations — not a regression; CI shards 371+328+313 confirm). Founder's first task done: **`agent_handoff/ASK-BACKS-FOR-SWORDFISH.md`** answers all six wiring ask-backs, with the image pin moved to the current main build (`6408afc…@sha256:319b3442…`).

## Resume prompt (session 26, syd4 — paste verbatim; "gogogo" boots this too)

> Stamped 2026-07-13, session-25 wrap.

**Resume · Thalon** — session 26, syd4 (active home) — **Sprint-6 exit checkpoint + Sprint-7 kickoff + deploy-at-handoff-pack.**

▎ ▸ **Read first:** `CLAUDE.md` → this file → `agent_handoff/ASK-BACKS-FOR-SWORDFISH.md` → `COORDINATION.md` session-24 entry (exit-review record) → `docs/proposals/2026-07-11-visual-uplift-and-template-portfolio.md` → memories `machine-migration-2026-07-10` · `vps-deploy-swordfish` · `higgsfield-kompozy-assignment`.

▎ ▸ **State:** main = origin (session-25 wrap commit) · suite **1012/3/0 green = CI parity** · guard PASS · bring-up audit GREEN · ask-backs delivered · Sprint-6 exit criteria MET, ratification pending.

▎ ▸ **Founder decisions open (carried):** (1) ratify Sprint-6 exit; (2) approve/amend the Sprint-7 proposal; (3) Higgsfield tier — **Plus one month recommended** (free tier = watermarked + promo/training license: wiring smoke-test ONLY, never shipped assets). **New (4): the Higgsfield MCP is NOT loaded on this box** (verified absent session 25) — re-check the claude.ai connector config together before Sprint-7 Phase 1 needs it.

▎ ▸ **Deploy thread:** blocked only on the swordfish handoff pack (scoped Dokploy credential · GHCR pull slot · neutral staging hostname · `/data` volume in restic excl `pg/**` · pre-backup.d wiring). When it lands: deploy per the ASK-BACKS file — domains BEFORE first deploy, image by sha tag + digest (never `latest`), day-one env list as written → verify health/gate/dump-hook from the box → their pre-backup.d integration. Swordfish is on this same box (`~/work/swordfish`); coordination via the founder as before.

▎ ▸ **Stealth mode unchanged (founder gate, on the record):** thalon.org stays UNWIRED until the launch call (CT-log permanence); staging = neutral hostname + edge BasicAuth + noindex; the image bakes the launch origin so launch = add domains + DNS flip + drop edge auth, zero rebuild.

▎ ▸ **[founder] queue:** the three decisions above · Higgsfield connector re-auth on this box · **post-move key rotation (founder-timed; we set rotated values at deploy time)** · production transcript key · LinkedIn Page paperwork · X dev app · carried `0b11d48` scrub decision · landing-template family = charter candidate at next checkpoint · optional: have swordfish re-supply `thalon-wiring-brief-2026-07-08.md` (lost in restore; answers preserved).

▎ ▸ **✅ SAFE TO CLEAR.** As of the stamp: session-25 changes committed (ask-backs file + FROM-SWORDFISH-2026-07-13 filed + dead `obsidian-vault` MCP removed from `.mcp.json` + this wrap); guard passing; local = remote on main; no open PRs; no worktrees; no mid-edit state.

## Pointer

Read in order: `CLAUDE.md` → this file → `agent_handoff/ASK-BACKS-FOR-SWORDFISH.md` → `COORDINATION.md` session-24 entry → `docs/adr/0007-vps-deploy-recharter.md` → `.context/notes/thalon-wiring-replies-2026-07-08.md` → memory (`vps-deploy-swordfish`, `machine-migration-2026-07-10`). Founder runbook: `.context/runbooks/keys.md`.

## Delta (session 25)

- **First boot on syd4; bring-up audit GREEN end-to-end** (payload, vault, memory, gh, guard, full suite at exact CI parity). Suite-count note: 1012/3/0 here and in CI shards; the laptop's 1050 was laptop-local extra registrations.
- **`agent_handoff/ASK-BACKS-FOR-SWORDFISH.md` written (founder's task):** all six ask-backs answered; image pin superseded to `ghcr.io/steveneam/thalon-web:6408afc…@sha256:319b3442…` (carries the B6.7 render temp-dir cleanup fix); what we still need from swordfish restated.
- First-boot chores: dead `obsidian-vault` MCP entry removed from tracked `.mcp.json` (machine-bound server gone; vault is plain files now) · `.claude/settings.local.json` recreated Linux-native (vault write-deny replaces the dead MCP's deny-list) · consumed boot prompts archived to `.context/migration/`.
- **"Website Design General" claimed:** placed at `.context/design/website-design-general/` (gitignored; 14 files verified against the census, token-scan clean). Its design rules are a candidate to fold into our docs at the next checkpoint.
- Restore gap found + routed: the swordfish wiring-brief note didn't survive into `.context/notes/`; no functional loss (replies + ASK-BACKS carry everything); original recoverable from swordfish.
- Higgsfield MCP verified ABSENT on this box → founder queue.

## Next action

Founder: the three carried decisions + Higgsfield connector on this box · relay/point swordfish at `agent_handoff/ASK-BACKS-FOR-SWORDFISH.md` so the syd2 wiring proceeds. Lead: on handoff-pack landing → deploy per the ASK-BACKS file; on charter approval → Sprint 7 Phase 1 (asset-pinning module + provenance manifest first).
