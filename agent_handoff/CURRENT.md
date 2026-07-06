# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-06 (session 12) · **SPRINT 6 CHARTERED (A12 + A13, B6.1–B6.8) with lanes cut — planning/research session, docs-only. Next session: Sprint 6 build starts at the contract window.**

## Resume prompt (paste verbatim to resume next session)

> Stamped 2026-07-06 18:23 (UTC+10:00). Safe to `/clear` after reading — see the clear-safe line at the end.

**Resume · Thalon** — stamped **2026-07-06 18:23 (UTC+10:00)** · Sprint 6 chartered (A12+A13) → build starts now. E:\thalon, main.

▎ ▸ Read `CLAUDE.md` → `agent_handoff/CURRENT.md` → `CHARTER.md` (Sprint-6 table + amendments A12/A13) → `docs/adr/0005-pass3-recharter.md` + `docs/adr/0006-search-intel.md` → `docs/FRONTEND.md` (the B6.1/B6.2 build spec) → `COORDINATION.md` (Sprint-6 lane board + the 2026-07-06 wrap message).

▎ ▸ **First act: the Sprint-6 contract window, solo on the lead terminal** (`agent/contract/b6-window`): additive schema — `waitlist` · monitored-areas · `search_targets`/`search_snapshots` (mirror `watchlists`/`trend_snapshots`) · format-registry SEO-meta capability — plus the zod configs in contracts; freeze at merge. **Then propose the wave-1 Mode B launch (landing · intel-engine · search-engine) — each launch needs fresh founder go**; lead preps worktrees via `npm run worktree:setup -- .claude/worktrees/<lane>`, authors kickoffs; NEVER `npm install` in a lane. Web lanes read `node_modules/next/dist/docs/` first (breaking-changes Next.js).

▎ ▸ **Ratified, do not re-litigate:** Thalon-first dogfood (tenant #0 real profile; pillar #1 = a Thalon video) · frontend first, hand shell + dogfooded content · intel v2 = monitored areas + deterministic ranker (never neural) · transcript drivers elevated · **B6.8 search intel = Intel's second half** (GSC seam, horizon math, JSON-LD/llms.txt pack, Trends/Search tabs, honest-claims rule) · no Clerk yet · brand = dark command-center + falcon/talon mark (2–3 SVG concepts for founder pick in B6.1) · no publish path in Sprint 6.

▎ ▸ **Guard hygiene reminder for all frontend work:** founder reference imagery lives OUTSIDE the repo; the brand folder path contains guard token A — never echo it into tracked files ("founder-supplied brand references").

▎ ▸ **[you] — founder-supplied (none block the opener):** domain registration (blocks go-live, B6.7) · pricing tiers for landing §3 · gateway top-up (B6.5+) · transcript-vendor API key (B6.5) · optional Google Trends API alpha application · LinkedIn + X OAuth apps (parallel paperwork) · carried: guard-token scrub decision for historical commit `0b11d48`.

▎ ▸ **✅ SAFE TO CLEAR.** As of the stamp: working tree clean, local = remote, docs-only session (suite carries at 580 passed / 3 skipped from session 11), guard passing, no open PRs, no live worktrees, no mid-edit state.

---

## Pointer

Read in order: `CLAUDE.md` → this file → `CHARTER.md` (Sprint 6 + A12/A13) → ADRs 0005/0006 → `docs/FRONTEND.md` → `COORDINATION.md` (Sprint-6 lanes). Build surfaces: `packages/db/src/schema/` + `packages/contracts/` (contract window) · `apps/web/src/app/page.tsx` (landing greenfield — still the create-next-app placeholder) · `packages/engine/src/trend/*` (intel v2 base: outlier/longitudinal math + reason strings ready; watchlist "niches" slot un-built) · `packages/engine/src/search/` (B6.8, new) · `packages/engine/src/ingest/{whisper,hosted-transcript}-provider.ts` (B6.5 live drivers).

## Delta (this session — session 12, planning/research; commits `11553fa` + this wrap)

- **A12 (Sprint 6, B6.1–B6.7):** pass 3 chartered — Thalon-first dogfood · frontend first ("hand shell, dogfood content") · intel v2 monitored areas + EdgeRank-shaped deterministic ranker (founder's FB/YT frameworks doc adopted as math+embeddings; two-tower/federated/GenAI-feed machinery explicitly rejected) · transcript live drivers elevated · quota-shaped pollers (YouTube June-2026 granular quota: search ≈100/day own bucket, batchGetStats cheap; Bluesky keyless). `docs/adr/0005` + `docs/FRONTEND.md` (10-second rule, waitlist-referral, keyboard triage, first-run on fake drivers, north-star = time-to-first-approved-draft).
- **A13 (B6.8 search intel):** SEO/AEO/GEO integrated as Intel's second half + judge lens, not a fourth family (`docs/adr/0006`): profile-seeded keyword compilation (works day 1, no GSC data before deploy+indexing), on-page pack (JSON-LD `Organization`/`FAQPage`/`Product`/`VideoObject`, `llms.txt`, deterministic checks in core), `SearchIntelSource` seam (GSC free ≈50k rows/day; paid tools = swap path), horizon opportunity math (position 8–20 × rising impressions × low CTR). Sprint-6 schema consolidated to ONE opening contract window.
- **Lane board cut** (COORDINATION.md Sprint 6): contract → wave 1 (landing · intel-engine · search-engine, Mode B) → wave 2 (workspace · self-tenant) → wave 3 re-planned at that checkpoint. One web writer per wave.
- Frontend direction locked from founder references (23 workspace screenshots + brand mockups; dark command-center, falcon/talon mark). Memory updated (6 files + index).

## Next action

Paste the resume prompt above. Open the contract window on the lead terminal, then bring the wave-1 launch proposal to the founder (fresh go required per the standing rule).

## [you] — founder-supplied (Sprint 6)

- Domain registration (blocks go-live only, B6.7).
- Pricing-tier names/prices for landing §3 (placeholder until supplied).
- Gateway credit top-up (B6.5 judge-tier dogfood onward).
- Transcript-vendor API key (B6.5).
- Optional: Google Trends API alpha application (B6.8 nice-to-have, never a dependency).
- LinkedIn + X OAuth developer apps (parallel paperwork; publisher stays pulled).
- Carried: decision on scrubbing the guard token from historical commit `0b11d48`.
