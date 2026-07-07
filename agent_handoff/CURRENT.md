# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-07 (session 19 — research & planning, founder-directed: no agents, no code) · **Founder's four asks served docs-only: credential runbook (`.context/runbooks/keys.md`), Library UX feedback adopted as wave-3.5 lane riders, music/sound swap ladder recorded (`engaging-clips.md` §6), LinkedIn/X posture clarified.** Wave 3.5 stays the next act, unchanged in shape — three Mode B lanes + lead inline work; this prompt re-carries the go for exactly those runs (now including the two Library riders).

## Resume prompt (paste verbatim to resume next session)

> Stamped 2026-07-07 (UTC+10:00). Safe to `/clear` after reading — see the clear-safe line at the end.

**Resume · Thalon** — Sprint 6 **wave 3.5 (parallel)**. E:\thalon, main @ the session-19 wrap commit.

▎ ▸ Read `CLAUDE.md` → `agent_handoff/CURRENT.md` → `COORDINATION.md` (Sprint-6 board + the 2026-07-07 session-18 AND session-19 messages) → `docs/research/workspace-ux-v2.md` §7–§9 → `docs/research/engaging-clips.md` (§6 is new) → the B6.6/B6.7 charter rows.

▎ ▸ **First act: CUT WAVE 3.5 AS PARALLEL MODE B LANES** (founder-directed 2026-07-07; **this prompt carries the go for exactly the three named lanes + the lead inline work** — anything beyond them needs a fresh founder go). **Step 0, lead terminal, before cutting:** assess whether the blog needs a small contract window (durable blog-post storage/publish door; the carried dismiss→eval-row write door rides the same window). If yes: open, merge, FREEZE it solo-lead FIRST; lanes consume the frozen contract. (The Library riders need NO window — they ride the additive `sources.meta` JSON column.)
  **The three lanes (disjoint globs; ONE web writer):**
  **1. origination** — B6.6 live loop, ENGINE-ONLY: intel context → →Page drafts → judge → approve → own-site publish door (no social publish path); Crawl4AI web-ingest as a subprocess driver behind a B4.8-style seam (license-verify + user-scope install at lane start). **+ session-19 rider (ingest metadata):** oEmbed title fetch in `ingestVideoUrl` (`meta.title`, keyless/quota-free, degrade to URL) + `meta.areaRelevance` computation ({areaId, areaName, score, reason}[] — transcript embeddings already exist; score vs monitored-area descriptions via the B6.4 ranker's embedding path) + `meta.tags` passthrough. Zero `apps/web` edits.
  **2. landing-v2 + blog v1** — `apps/web/**` (THE web writer): §8 landing uplift + §9 blog v1 surface (landing keeps its 4 sections). **+ session-19 rider (Library polish, founder feedback):** transcript panel collapsed-by-default after ingest, title-first shelf rows (URL demoted), tag chips + relevance badge in the thermal-heat grammar — all reading the `sources.meta` keys, degrading honestly on rows that lack them. **FeatureLoop swap is NOT in-lane** (lead commits it at the train with lane-3 clips).
  **3. composition-v2** — `packages/engine/src/{render,demo}/**` + `proprietary/profiles/demo-clips/**` + `eval/**`: the `engaging-clips.md` plan — catalog transitions, kinetic captions, depth/parallax, pacing-density in the deterministic generator; keyless TTS (Kokoro, Apache-2.0); **NO music bed (MusicGen CC-BY-NC gate; §6 ladder targets audio v2.5, NOT this lane)**; re-cut the three feature demos → MP4s to gitignored `.context/renders/` for the train.
  **Lead terminal throughout:** dossier half-step the moment the top-up lands (new `intel.dossier` shell site — inventory pin 11→12 + gateway-boundary allowlist travel together; prompt file; config-gated; fills the sweep bundle's optional `dossier` field) · lane monitoring/review · **merge train: origination → composition-v2 → landing-v2 last** (lead's train commits: FeatureLoop swap w/ lane-3 clips, any one-line env/inventory integrations).
  **Lane pre-reqs (Mode B, the standing founder preference):** lead preps worktrees (`git worktree add` + `npm run worktree:setup -- .claude/worktrees/<lane>`) + authors kickoffs in gitignored `.context/kickoffs/` (the riders' meta-key mini-contract is in the session-19 board message — name the keys once in both kickoffs) + adds board rows on `COORDINATION.md` BEFORE launch; founder opens the terminals; **never `npm install` inside a worktree**. Kickoff reading: `docs/FRONTEND.md` + ADRs 0005/0006 + workspace-ux-v2 §8/§9 (+ `engaging-clips.md` for lane 3; the web lane also reads `node_modules/next/dist/docs/` per `apps/web/AGENTS.md`).

▎ ▸ **Merged, don't rebuild (B6.5 core, PR #33):** `/app/library` transcript surface (URL → transcript → copy/.txt/.csv/.srt; dev shim = `py -3.12 .context/tools/transcript-shim.py`, env lines in `apps/web/.env.local`) · Bluesky/YouTube drivers behind `TREND_SOURCE` (**searchPosts is 403 keyless — queries need the free app password; account FEEDS stay keyless**; budgets as config, loud refusals) · `runTrendSweep` → `sweeps/<tenantId>.json` (mutable-pointer family) + live trends read + armed Sweep-now · SPINE §80 ratified (web calls engine SERVICES, math stays engine-side) · `proprietary-dir.ts` = the one bundle-safe resolver · live cards carry NO dossier until generation arms.

▎ ▸ **Standing (do not re-litigate):** after wave 3.5 → **B6.7 deploy** (.org primary / .com.au 301 rides it) · thermal heat grading system-wide · charts ride real time-series · pricing $29/$79/$199 live · honest UX-psych variants only · no social publish path · quality-gated blog cadence · MusicGen CC-BY-NC gate (music = audio-v2.5 seam per `engaging-clips.md` §6; local model inference OFF this box — Intel UHD 750/1 GB VRAM) · guard token A never in tracked files · user-scope installs only · purge `apps/web/.next-dev` on style lag · one web writer per wave.

▎ ▸ **[you] — the step-by-steps for the first three are in `.context/runbooks/keys.md` (written session 19 from your screenshots):** free Bluesky app password (`BLUESKY_IDENTIFIER`/`BLUESKY_APP_PASSWORD`, ~2 min — arms query sweeps; NEVER the real account password) · free YouTube Data API v3 key (`YOUTUBE_API_KEY`, ~5 min — the console's $300-trial banner and consent-screen warning are both ignorable) · LinkedIn cheap paperwork whenever convenient (Thalon Company Page → developer app → add the two INSTANT self-serve products; the review-gated org-posting API is deliberately deferred until the publisher exists to screencast) · gateway top-up (dossier generation + B6.6 judge dogfood) · production transcript key (Supadata leaned) · optional Trends alpha · X developer app (free tier suffices for future publisher tests) · pricing retune if needed · carried: `0b11d48` scrub decision.

▎ ▸ **✅ SAFE TO CLEAR.** As of the stamp: working tree clean, local = remote on main, guard passing, no open PRs, zero worktrees, no dev server, no mid-edit state. Session 19 was docs-only — suite untouched at 818/3.

---

## Pointer

Read in order: `CLAUDE.md` → this file → `COORDINATION.md` (Sprint-6 board + session-18/19 messages) → `docs/research/workspace-ux-v2.md` §7–§9 → `docs/research/engaging-clips.md` (incl. new §6). Build specs: ADRs 0005/0006 · `CHARTER.md` (B6.6/B6.7) · `docs/FRONTEND.md`. Founder runbook: `.context/runbooks/keys.md`.

## Delta (this session — session 19; docs + runbook + plan amendments, zero code)

- **Credential how-tos delivered** → `.context/runbooks/keys.md` (Bluesky app password · YouTube key from the founder's exact console state · LinkedIn self-serve-vs-review-gated posture + X note). LinkedIn finding: post-as-MEMBER (`w_member_social`) is instant self-serve once a Company Page + app exist; post-as-ORG is review-gated on a screencast of a working integration — deferred by design until the publisher bucket exists.
- **Library UX feedback (founder, w/ screenshot) adopted as wave-3.5 riders** — collapse-by-default, oEmbed titles, tags, profile/area relevance scoring; all additive via `sources.meta`, no contract window; engine side rides lane 1, surface side rides lane 2; meta-key mini-contract in the session-19 board message.
- **Music/sound swap ladder recorded** → `engaging-clips.md` §6: curated Pixabay/Mixkit pack as operator data w/ provenance manifest (rung 1, now) · ACE-Step/YuE/DiffRhythm all Apache-2.0 = license-clean generation, but **hardware-blocked locally (Intel UHD 750, 1 GB VRAM — load-bearing find)** → cloud-GPU spike later (rung 2) · deterministic procedural MIDI+FluidSynth+CC0-soundfont spike (rung 3, doctrine-native) · CC0 SFX pack. Wave-3.5 no-music-bed scope unchanged.
- Memory updated (future-tooling-candidates += music-gen survey + GPU constraint).

## Next action

Founder: work through `.context/runbooks/keys.md` when convenient (Bluesky ~2 min, YouTube ~5 min — both free; LinkedIn paperwork any time) + the gateway top-up; then paste the resume prompt into a fresh lead terminal and open the three lane terminals once the lead reports worktrees + kickoffs ready. Lead: step-0 contract assessment → prep lanes (riders included in kickoffs) → orchestrate per the prompt.

## [you] — founder-supplied (Sprint 6)

- **Runbook for the next three: `.context/runbooks/keys.md`** (session 19, written from your screenshots).
- Free Bluesky app password → `BLUESKY_IDENTIFIER`/`BLUESKY_APP_PASSWORD` in `apps/web/.env.local`.
- Free YouTube Data API v3 key → `YOUTUBE_API_KEY` in `apps/web/.env.local`.
- LinkedIn cheap paperwork (Company Page → app → two self-serve products; park Client ID/Secret). Review-gated org-posting deferred by design.
- Gateway credit top-up (dossier titles/angles + B6.6 judge-tier dogfood).
- Transcript-vendor key for PRODUCTION (dev shim works now; lead leans Supadata — session-18 board message has the shortlist).
- Optional: Google Trends API alpha application (never a dependency).
- X developer app (free tier ~500 writes/mo suffices for publisher testing; $200/mo Basic = bucket-time decision).
- Pricing retune if the recommended $29/$79/$199 should move (live on landing §3).
- Domain go-live decision rides B6.7 (lead recommendation: thalon.org canonical, thalon.com.au 301).
- Carried: decision on scrubbing the guard token from historical commit `0b11d48`.
