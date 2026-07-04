# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-05 (session 7) · **B3.8 + B3.9 code-complete. Build strategy pivoted to BREADTH-FIRST / two-pass (A9): materialize all 3 output families in pass 1 with fake drivers, defer all live dogfood/verify/real-tenant to pass 2. Next: pass-1 breadth — B3.10 (thin render seam) → B3.15 (web family) → B3.12 (intel skeleton).** Amendments A6/A7/A8/A9 chartered; pulled B3.12–B3.15 recorded. Pillar-#1 tenant name IS grep-guard token A — never in tracked files; profile drafted+PARKED at gitignored `.context/tenants/<company>.v1.json` for pass 2. Pass 1 = zero gateway spend.

## Resume prompt (paste verbatim to resume next session)

> Stamped 2026-07-05 02:41 (UTC+10:00). Safe to `/clear` after reading — see the clear-safe line at the end.

**Resume · Thalon** — stamped **2026-07-05 02:41 (UTC+10:00)** · Sprint 3 in progress, now **BREADTH-FIRST (two-pass, amendment A9).** B3.8 (profile spine) + B3.9 (pillar origination) code-complete. E:\thalon, main @ `cb151e4`.

▎ ▸ Read `CLAUDE.md` → `CHARTER.md` (Sprint-3 table + amendments **A6–A9**; pulled B3.12–B3.15) → `agent_handoff/CURRENT.md`. Skim `docs/adr/0003-sprint3-origination.md` for the origination rationale.

▎ ▸ **STRATEGY (A9, locked):** materialize all **three output families** — social (done), video (B3.9 done), **web (B3.15, not started)** — plus supporting skeletons (trend-intel B3.12, profiles B3.8 done) end-to-end in **pass 1** using **fake/keyless drivers → zero gateway spend**. Render/deploy seams may be **thin stubs**. Keep cheap inline unit tests (green-suite ratchet); **defer ALL live dogfood, real-tenant setup, chromium drives, exit reviews, eval refinement, UI polish, TTS, full Remotion, and full trend pollers to pass 2.** Don't stop for a live-verify gate between buckets.

▎ ▸ **FIRST ACTION (pass-1 breadth, recommended order):** (1) **B3.10 thin render seam** — approved `pillar_script` → deterministic SRT from the authored beats + a preview/manifest artifact behind a `RenderTarget` seam (real Remotion MP4 = pass 2); (2) **B3.15 web/landing-page** — new `web_page` draft format, profile+prompt → self-contained landing page → same judge spine → approve queue → thin `DeployTarget`/Vercel seam; (3) **B3.12 trend-intel skeleton** — `TrendSource` seam + watchlist config + deterministic outlier math over `source_metrics` → auto-exemplar ingest, against a fake source. Guard-gate every commit (`if ($LASTEXITCODE -eq 0)` — never `;`).

▎ ▸ **[you] — pass-2 inputs only (not needed for pass 1):** pillar-#1 topic/angle + confirm the parked tenant profile draft at gitignored `.context/tenants/<company>.v1.json`; gateway credit top-up; LinkedIn/X OAuth apps; whether to scrub the guard token from historical commit `0b11d48` (needs a one-time branch-protection relax; HEAD already clean).

▎ ▸ **✅ SAFE TO CLEAR.** As of the stamp: working tree clean, local = remote (`cb151e4`), grep guard passing, no mid-edit state.

---

## Pointer

Read in order: `CLAUDE.md` → `CHARTER.md` (new Sprint-3 table + amendment A6) → `docs/adr/0003-sprint3-origination.md` (why origination, dogfood flywheel, Remotion growth-gate downgrade) → `COORDINATION.md` (Sprint-2 board; Sprint-3 lanes not yet cut).

## Delta (this session)

- **Founder correction that re-framed the exit review:** no pillar video/caption/SRT exists or will ever be founder-supplied — generating it is the product. Product frame: (1) content creation + posting from prompt + saved profile, (2) viral/trend intel for format re-use, (3) pre-saved switchable operator profiles. All in agent memory (`content-origination-goal`, `product-feature-framing`, `publisher-test-accounts`).
- **A6 chartered** (founder approved, shape delegated to lead): B3.8 profile spine (data first, UI deferred) → B3.9 pillar origination (`pillar_script` format; reuses B2.5 crawl + B1.2/1.3/1.4 machinery; adds GitHub ingest) → B3.10 Remotion render seam (MP4 + deterministic SRT from the authored script; licence corrected to **growth gate** — free ≤3-person co. incl. for-profit) → B3.11 loop closure + profile editor UX. ADR 0003.
- Repo fixes: dropped deprecated `baseUrl` from `packages/engine` + `proprietary/judge` tsconfigs (TS7 removal); `npm install` on main picked up playwright from PR #15; full typecheck green (`716881d`).
- Harness: `Grep`/`Glob` added to global `~/.claude/settings.json` permissions allow.

## B3.8 delta (code-complete, at checkpoint)

- Contract: `brandIdentitySchema` (company/oneLiner/philosophy/audience/offers/links/facts/topics + catchall) + `renderBrandIdentity` — the ONE canonical rendering used by both the prompt and the judge; `BrandProfileConfigInput` for pre-parse boundaries.
- DB: `brand_profiles.identity` jsonb (migration `0002_open_scarlet_witch.sql`, additive); repo writes it.
- Fan-out: identity block threads automatically from the active profile (B2.4 exemplar pattern — separate `fanout-identity-context.v1.md` system block only when non-empty; identity-less prompts byte-identical to before; `identityPromptVersion` in draft meta; no generation-key change — `brandProfileVersion` already covers it). Waterfall untouched by design (clip plans ground to the transcript; its meta contract is pinned for the UI).
- Judge: identity grounding appended INSIDE `runJudgePipeline` (current ACTIVE identity, ref `profile:v<N>:identity`) — structural, no caller can skip it; stale facts fail on re-judge by design.
- Seeds: `TENANT_ZERO` (eval/src/dogfood.ts) + `proprietary/profiles/tenants/fernwood.v1.json` both carry identity.
- Suite 310 passed / 2 skipped; lint 0 errors (1 pre-existing `_dataDir` warning); typecheck green.

## B3.9 delta (code-complete)

`packages/engine/src/origination/` — `runOrigination`: operator prompt source + active-profile identity (B3.8) + optional grounding sources → ONE judged `pillar_script` draft (pinned `pillarScriptDraftMetaSchema`: title/hook/beats/cta/groundingSourceIds); reuses B2.5 storyboard's idempotency/backfill (N=1). `ingest-github.ts` — public README via official API behind the fetcher seam → doc source. Structural: multi-source grounding assembly moved INTO the judge pipeline (`@thalon/judge` `collectGroundingChunks`, run by default when no explicit chunks passed) — apps/web judge-runner + eval dogfood simplified to not pass chunks; a caller can no longer under-ground a multi-source draft. New draft format `pillar_script`. Suite 321 passed / 2 skipped; typecheck + guard green (`fd1d2e2`).

## Pulled buckets added this session

B3.12 trend-intel intake (A7) · B3.13 transcription engine (A8, Whisper + hosted-vendor drivers) · B3.14 per-tenant model-provider choice (gateway/BYOK/local-CLI) · **B3.15 web/landing-page generation** — the third output family (social · video · web), same spine, Vercel deploy seam. All in CHARTER.md "Pulled" table + `product-feature-framing` memory.

## BUILD STRATEGY — breadth-first, two-pass (A9, founder direction 2026-07-05)

Materialize all three output families end-to-end in **pass 1** using fake/keyless drivers (**zero gateway spend** — the ~$4.90 credit is NOT blocking pass 1). Keep cheap inline unit tests (green-suite ratchet); **defer ALL live dogfood / real-tenant (the founder's #1 company) / chromium drives / exit reviews / eval refinement / UI polish / TTS / full Remotion / full trend pollers to pass 2.** Render/deploy seams may be thin stubs in pass 1. The pillar-#1 tenant profile draft at gitignored `.context/tenants/<company>.v1.json` is PARKED for pass 2, not used now. Don't stop for a live-verify gate between buckets. Full rationale: CHARTER.md amendment A9 + `build-strategy-breadth-first` memory.

## Next action (pass 1, breadth)

Continue materializing the three families. Recommended order:
1. **B3.10 render seam (THIN):** approved `pillar_script` → deterministic SRT (from the authored beats) + a preview/manifest artifact behind a `RenderTarget` seam. Real Remotion MP4 render = pass 2. Fake driver, keyless test.
2. **B3.15 web/landing-page generation:** new `web_page` draft format; brand profile + prompt → self-contained landing page → same judge spine → approve queue → thin Vercel `DeployTarget` seam (stub in pass 1). This stands up the missing third family.
3. **B3.12 trend-intel skeleton:** `TrendSource` seam + watchlist config + deterministic outlier math over `source_metrics` → auto-exemplar ingest, all against a fake source. Live pollers = pass 2.

No live gateway runs, no chromium, no real-tenant setup this pass.

## [you] — founder-supplied, needed for PASS 2 (not pass 1)

Pass 1 is self-contained (fake drivers). Everything below is a pass-2 input:
- Pillar #1 topic/angle + confirm the pillar-#1 tenant profile draft (`.context/tenants/<company>.v1.json`).
- Gateway credit top-up (pass-2 live dogfood + judge tier).
- LinkedIn + X OAuth developer apps (B3.1 long pole — paperwork, start anytime).
- B2.5 dogfood docs-search flow confirmation.
- Decision: scrub the guard token from historical commit `0b11d48`? Needs a one-time branch-protection relax (private repo; HEAD is already clean).
