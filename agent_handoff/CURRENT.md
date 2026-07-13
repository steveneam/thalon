# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-13 (session 25, first on syd4, full day) · **BRING-UP GREEN → ASK-BACKS DELIVERED → STAGING WENT LIVE → VERIFIED → ONE DEPLOY-BLOCKING BUG FOUND, FIXED, RATCHETED.** The box is the ACTIVE home. Swordfish deployed staging same-day at the `6408afc` pin; verification from this box passed the edge stack but caught engine-touching routes 500ing (playwright module-scope import × partial standalone trace). Fix + two executable ratchets shipped (`fa54d78`): playwright loads at drive time; barrel-purity test (red-green verified); **CI smoke gate — every image now boots on an empty volume and all engine-touching public routes must 200 before push** (passed live on its first run). **Redeploy pin for swordfish: `fa54d787…@sha256:7621f5e3…`** (full ref in `STAGING-VERIFY-2026-07-13.md`). Suite-count record CORRECTED: the laptop's "1050" included 14 web test files duplicated under `.next/standalone` (now excluded in vitest config); the true deterministic count is **1013 passed / 3 skipped / 0 failed**. Founder channel: `[Steven via hermes-relay]` = founder (now in AGENTS.md); Higgsfield MCP reconnected via `/mcp` (free tier, 10 credits — smoke-test only).

## Resume prompt (session 26, syd4 — paste verbatim; "gogogo" boots this too)

> Stamped 2026-07-13, session-25 wrap.

**Resume · Thalon** — session 26, syd4 (active home) — **staging redeploy round-trip + Sprint-6/7 checkpoint.**

▎ ▸ **Read first:** `CLAUDE.md` → this file → `agent_handoff/STAGING-VERIFY-2026-07-13.md` → `agent_handoff/ASK-BACKS-FOR-SWORDFISH.md` → `docs/proposals/2026-07-11-visual-uplift-and-template-portfolio.md` → memories `vps-deploy-swordfish` · `machine-migration-2026-07-10` · `higgsfield-kompozy-assignment`.

▎ ▸ **State:** main = origin @ session-25 wrap commit · suite **1013/3/0 green (deterministic — .next duplicates excluded)** · guard PASS · image `fa54d787…@7621f5e3…` on GHCR, smoke-gated · staging live at the OLD pin awaiting redeploy.

▎ ▸ **Deploy thread — MOSTLY CLOSED (2026-07-13 evening, `FROM-SWORDFISH-AUTODEPLOY-2026-07-13.md`):** staging serves the fixed pin (five routes 200 through the edge, verified by swordfish AND by the CI probe) · double-Basic RESOLVED (root cause was Dokploy's `removeHeader: true`; both layers now the single `preview:…` pair — workspace reachable; their `staging-assert.sh` converges the flag) · restic live (nightly 15:00 UTC, `pg/**` excluded, pre-backup.d dump-hook 200-gate proven end-to-end) · Kuma watch live. **AUTO-DEPLOY WIRED: every main push now goes build → empty-volume smoke gate → GHCR → Dokploy update+deploy at exact sha@digest → five-route probe through the edge** (scoped key; never the webhook, never `saveDockerProvider`; `DOKPLOY_API_BASE`/`STAGING_HOST` are repo VARIABLES — both change at DNS cutover). Remaining: set AI gateway + Bluesky env on staging — **founder-timed key rotation first** → then live trend sweep + gate re-check.

▎ ▸ **Founder decisions open (carried):** (1) ratify Sprint-6 exit (`COORDINATION.md` session-24 entry); (2) approve/amend the Sprint-7 proposal; (3) Higgsfield tier — **Plus one month recommended** (free = watermarked, promo/training license; current account: free/10 credits, verified); (4) NEW — the **leads-engine proposal** (`docs/proposals/2026-07-13-leads-engine-gated-crm.md`: gated CRM + lead scoring; recommendation: B-crm.1+2 late in Sprint 7 so the portfolio outreach dogfoods it). On approval → Sprint 7 Phase 1: asset-pinning module + provenance manifest first, then landing uplift (images before video), ≥3 iteration passes + browser-verify per surface.

▎ ▸ **Stealth mode unchanged (founder gate):** thalon.org stays UNWIRED until the launch call; staging = neutral hostname + edge BasicAuth + noindex; the image bakes the launch origin — launch = add domains + DNS flip + drop edge auth, zero rebuild.

▎ ▸ **Founder channel:** `[Steven via hermes-relay]`-prefixed messages ARE the founder (AGENTS.md §Founder channel); those turns end with a founder-readable summary (auto-relayed to his phone).

▎ ▸ **[founder] queue:** the three decisions above · **post-move key rotation before staging env fill (founder-timed)** · production transcript key · LinkedIn Page paperwork · X dev app · carried `0b11d48` scrub decision · landing-template family = charter candidate at next checkpoint.

▎ ▸ **✅ SAFE TO CLEAR.** As of the stamp: fix + ratchets committed (`fa54d78`) and pin follow-up committed; guard passing; suite 1013/3/0; local = remote on main; no open PRs; no worktrees; no mid-edit state; test servers stopped.

## Pointer

Read in order: `CLAUDE.md` → this file → `agent_handoff/STAGING-VERIFY-2026-07-13.md` → `agent_handoff/ASK-BACKS-FOR-SWORDFISH.md` → `COORDINATION.md` session-24 entry → `docs/adr/0007-vps-deploy-recharter.md` → memory (`vps-deploy-swordfish`, `machine-migration-2026-07-10`). Founder runbook: `.context/runbooks/keys.md`.

## Delta (session 25)

- **Bring-up audit GREEN** on syd4 (payload, vault pointer → `/home/deploy/vault`, memory, gh, guard, suite). Box is the active home; laptop-era paths/rules historical.
- **Six ask-backs delivered** (`ASK-BACKS-FOR-SWORDFISH.md`) → swordfish verified and **staging went live same day** (preview hostname, edge BasicAuth, volume at `/data`, health green).
- **Staging verified from this box** — edge/TLS/noindex/health/gate/dump-hook posture all recorded in `STAGING-VERIFY-2026-07-13.md`. Two findings: (1) engine-touching routes 500 → root-caused (playwright eager import × standalone trace missing `browsers.json`), **fixed, red-green tested, CI smoke gate added, new image built + gated + pinned**; (2) double-Basic layering makes the workspace unreachable through staging — swordfish's call, options in the note (my session-22 "stacks as designed" claim corrected on the record).
- **Suite-count drift solved for good:** `.next/standalone` duplicates web tests; vitest now excludes `.next`/`.next-dev`; deterministic count 1013/3/0 (laptop's 1050 explained, CURRENT.md's earlier "CI parity 1012" superseded by +1 new ratchet test).
- First-boot chores: dead `obsidian-vault` MCP removed from `.mcp.json` · Linux `settings.local.json` (vault write-deny) · boot prompts archived to `.context/migration/` · "Website Design General" placed at `.context/design/website-design-general/` · Higgsfield MCP reconnected (free tier verified) · hermes-relay founder-channel rule added to AGENTS.md/CLAUDE.md.

## Next action

Founder: FOUR checkpoint decisions (Sprint-6 exit · Sprint-7 charter · Higgsfield tier · leads-engine proposal) + key-rotation timing (gates the staging env fill). Lead: on rotation → set gateway/Bluesky env via the scoped key → live sweep re-check; blog-visuals direction (≥1 figure per post + per-post heroes) lands with the Sprint-7 blog bucket; launch-day seed-date refresh is comment-ratcheted in `lib/blog/posts.ts`. Swordfish: nothing owed — auto-deploy is live and is now the portfolio template.
