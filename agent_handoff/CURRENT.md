# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-05 (session 7) · **B3.8 (profile spine) + B3.9 (pillar origination) BOTH code-complete on main; next: B3.10 Remotion render seam.** Amendments A6/A7/A8 chartered; pulled buckets B3.12–B3.15 recorded. Pillar-#1 tenant = founder's first company — **its name IS grep-guard token A: never in tracked files or commit messages; profile JSON lives ONLY at gitignored `.context/tenants/<company>.v1.json` (drafted this session, ready)**. Gateway budget ~$4.90 free until top-up.

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

## Pulled buckets added this session (each chartered at its own checkpoint)

B3.12 trend-intel intake (A7) · B3.13 transcription engine (A8, Whisper + hosted-vendor drivers) · B3.14 per-tenant model-provider choice (gateway/BYOK/local-CLI) · **B3.15 web/landing-page generation** — the third output family (social · video · web), same spine, Vercel deploy seam. All in CHARTER.md "Pulled" table + `product-feature-framing` memory.

## Next action

**B3.10 — Remotion render seam** (approved `pillar_script` → MP4 + deterministic SRT; growth-gate licence): hold it brutally small — one template, one ratio, local render, text+music first cut (TTS behind a seam after). BLOCKING: gateway credit (~$4.90 free left — enough for a first frugal B3.9 live run, top-up needed before real volume). Pillar #1 tenant profile is DRAFTED and ready at gitignored `.context/tenants/<company>.v1.json` (identity from the live public site + vault; only the `prompt` field is a placeholder — founder supplies the topic/angle at session start). **B2.5 dogfood opener** still runnable any time (chromium installed; needs founder's docs-search flow confirmation).

## [you] — founder-supplied, needed as work starts (not before)

- Profile content for your two real companies (runtime data as dogfood JSON, never committed — fernwood.v1.json is the template, now with an `identity` block).
- Pillar #1: which company + rough topic direction (shapes B3.9's first real run).
- B2.5 dogfood: confirm the exact docs-search flow when we run the opener.
- File LinkedIn + X OAuth developer apps (B3.1's long pole — paperwork only, start anytime).
- Gateway credit top-up — **blocking B3.9 start** (origination leans on the sonnet final judge gate).
