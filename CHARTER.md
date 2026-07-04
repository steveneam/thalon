# Thalon build charter

> **Approved by the founder 2026-07-02 23:59 +10:00.** This is the dependency-ordered bucket list the build follows. One bucket at a time; every bucket ends at a checkpoint requiring founder review before the next begins. Amendments to this charter require founder approval.

## Goal

A **standalone, generic, multi-tenant content/social-automation engine**: one sentence or source in → fan-out into platform-native drafts → every draft passes the shared judge harness (G1 denylist + G3 grounding-to-provided-sources) → human **Approve** gate → (Sprint 3+ only) publish via official platform APIs. Brand/voice, grounding sources, and compliance rules are **per-tenant runtime config, never code**. The repo ships a generic self/demo tenant only and contains zero forbidden upstream brand tokens in any tracked file (enforced by `scripts/ci-grep-guard.ps1` in CI).

## Ratified decisions (founder interview, 2026-07-02)

1. **AWS isolation:** Thalon gets its **own AWS sub-account** (AWS Organizations). Clean blast-radius, own billing line; OIDC deploy role + `cdk bootstrap` land inside it. Region `ap-southeast-2`.
2. **G3 grounding judge:** **two-tier** — a cheap model pre-screens every draft; a **stronger model (per-call gateway routing) is the final gate**; any disagreement → block + queue for the operator. Never uniform-cheap on the safety gate.
3. **Demo tenants:** tenant #0 = **Thalon-markets-Thalon** (dogfood from Sprint 1); one **fictional generic tenant #2** lands in Sprint 2 purely as runtime config to prove config-not-code.
4. **Operational mirror:** stood up at **Sprint 0** (external documentation agent's job; build agents in this repo never write outside it).
5. **Eval gate:** `edit_diff`/override capture wired **before the first draft ever generates**; the green-suite ship-gate **arms at Sprint-1 exit**.
6. **First platform targets:** **LinkedIn + X.** These shape the Sprint-1 fan-out profiles now and which OAuth apps/audits are filed first in Sprint 3.

## Standing discipline (every bucket)

- Checkpoint = founder review before the next bucket starts.
- `scripts/ci-grep-guard.ps1` passes before every commit; the same guard is a required CI check.
- Tests ship with the code they verify; small, verifiable steps.
- Every founder override/correction becomes one eval row in the same change.
- **No publish path is wired anywhere in Sprints 0–2.** A fan-out can never emit an ungated draft.
- Dev runs on local seams (embedded Postgres/PGlite · local object store · inline queue); cloud stacks land only when a bucket needs them.

## Buckets

### Sprint 0 — foundation

| Bucket | Deliverable | Depends on | Founder-supplied |
|---|---|---|---|
| **B0.1 — Remote + CI guard** (first action) | Private GitHub repo created from this directory; push; GitHub Actions workflow running the grep guard as a **required check**; branch protection on `main`. | — | `gh` auth |
| **B0.2 — App skeleton, dev-seamed** | Next.js (App Router, TypeScript) + shadcn/ui; health endpoint; smoke test; `.env.example` (placeholders only); dev = SQLite + local object store + inline queue behind `sqlite→aurora`, `local→s3`, `inline→sqs` seams; Clerk dev-seamed; own AI-gateway wiring (`ai` ≥5.0.36 + `@ai-sdk/gateway`, v5 `createGateway`, per-call routing). | B0.1 | `AI_GATEWAY_API_KEY` (Clerk keys may trail) |
| **B0.3 — Schema table 1 + grounding index** | Multi-tenant schema: `tenants` · `brand_profiles` · `sources` · `source_chunks` · `drafts` · `judge_results` · `approvals` · `publish_queue` · `eval_cases`/`edit_diffs` **+ `fanout_runs` · `events` · `usage_ledger` (amendment A2)**. `tenant_id` on every row; composite hot-path indexes (`(tenant_id,status)`, `(tenant_id,platform,scheduled_at)`, `(tenant_id,created_at)`); grounding index behind the seam (**dev = embedded Postgres/PGlite with pgvector — amendment A1**; prod = Aurora Postgres pgvector HNSW); content-addressed caches (LLM-generation keyed on prompt+model+params+input-hash; grounding-retrieval keyed on source-set-hash+query-hash); per-tenant daily budget caps enforced in the gateway wrapper; **package extraction + boundary/tenancy/state-machine ratchets (amendment A3)**; draft lifecycle state machine per `docs/SPINE.md` §1.1. | B0.2 | — |
| **B0.4 — Eval scaffold** (before any draft exists) | $0/self-hostable eval stack (Langfuse self-host + promptfoo + DeepEval — MIT/Apache only); `edit_diff`/override capture wired end-to-end and proven by test; golden-set seed file. | B0.3 | Langfuse keys/host |
| **B0.5 — AWS bootstrap (own sub-account)** | Organizations sub-account; GitHub-OIDC deploy role (no static keys); `cdk bootstrap` ap-southeast-2; CDK-Python skeleton with Thalon-named stacks. Aurora/S3 stacks land only when a bucket needs them. | B0.1 | AWS sub-account + one-time OIDC/bootstrap; `AWS_DEPLOY_ROLE_ARN` |

### Sprint 1 — the safe vertical slice (no publish)

| Bucket | Deliverable | Depends on |
|---|---|---|
| **B1.1 — source-ingest** | URL / prompt / dropped doc → `sources` + chunked/embedded `source_chunks`. | B0.3–B0.4 |
| **B1.2 — fan-out** | One source → N drafts from tenant #0's runtime config; LinkedIn + X niche profiles as **data, not code**. | B1.1 |
| **B1.3 — judge harness** (`proprietary/judge/`) | G1 denylist + G3 grounding-to-provided-sources; **two-tier** per ratified decision 2; structurally impossible for an ungated draft to reach the queue — **test-proven**. | B1.2 |
| **B1.4 — Approve queue** | 3-zone layout (feed → per-platform fan-out grid → approve panel with per-variant judge badge); `edit_diff` captured on every touch → eval rows; batch-approve **schema** now, UX later. | B1.3 |
| **B1.5 — Sprint-1 exit gate** | Dogfood on Thalon-markets-Thalon; green eval suite **arms as the ship gate**; exit criteria below verified. | B1.4 |

### Sprint 2 — seam proof + content intelligence (amendment A5)

| Bucket | Deliverable | Depends on |
|---|---|---|
| **B2.1 — Fictional tenant #2** | Added purely as runtime config/data. Exit criterion: **zero code changes**. | B1.5 |
| **B2.2 — Timed ingest + contract window** | `source_chunks.start_ms/end_ms`; `sources.kind` += `video_transcript\|exemplar\|voice_sample\|site_crawl`; `sources.modality` + `visual_ref` (visual-tier seam); generic per-source metrics; `drafts.format` += `clip_plan\|demo_plan`; unique `sources (tenant_id, content_hash)`. Caption-file ingest (SRT/VTT/plain) as deterministic core; transcript fetch behind one `TranscriptProvider` seam (**in-house**: self-hosted Whisper is the strategic driver; hosted APIs = optional adapters). **The sprint's only contract window** — contract re-freezes at merge. | B2.1 |
| **B2.3 — Waterfall clip plans** | Pillar transcript → deterministic candidate windows (core) → highlight-select (shell) → `clip_plan` drafts (start/end + hook + captions + platform copy), G3-grounded to the transcript, same Approve queue. No rendering (stays B3.3/B3.4). | B2.2 |
| **B2.4 — Exemplar library** | `exemplar`/`voice_sample` sources + generic metrics → grounding index → top-k retrieval into fan-out context; exemplar ids recorded per run (provenance). **Invariants:** exemplars are grounding-only — deterministic overlap gate blocks verbatim reuse; PII stripped at ingest. | B2.2 |
| **B2.5 — Demo-plan slice** | Front half of B3.4: site crawl (robots.txt + rate limits in core) → flow map → storyboard draft judged against the crawl → approved plan → deterministic Playwright drive → raw capture (video + synthetic cursor + event trace, content-addressed). Fails loudly at capture before any render spend. No composition/render. | B2.2 |
| **B2.6 — Queue UI for new formats** | Approve-queue rendering for clip plans / exemplars / demo plans (vs contract mocks); closes queued UI follow-ups (panel refresh after save-edit, aborted-run rows, operator re-judge action). | B2.2 |

### Sprint 3 — origination + profiles (amendment A6)

> The engine's missing first stage: the operator's content does not exist yet — Thalon generates it. Prompt + active profile (+ optional site/GitHub) in → pillar video **with caption/SRT** out; the waterfall then closes on Thalon's own output. Decision record: `docs/adr/0003-sprint3-origination.md`.

| Bucket | Deliverable | Depends on |
|---|---|---|
| **B3.8 — Profile spine (lean)** | Rich per-tenant profile data shape on the existing `tenants`/`brand_profiles` spine (company facts, brand voice, philosophy, audience, offers, links) — **data first; editor UI deferred to B3.11**. Seed demo tenant + fictional tenant #2 in-repo; founder's real companies enter as runtime data ([you]). Every generation resolves the active profile automatically — the operator never re-types company context. | Sprint 2 |
| **B3.9 — Pillar origination** | Prompt + active profile + optional site/GitHub crawl (reuses B2.5 crawl core; adds GitHub ingest) → new `pillar_script` draft format (beats, narration, on-screen text, timing) → G1+G3 judged against crawl + profile sources → same Approve queue. Topic/hook selection grounded by the trend/viral research doc + operator-dropped exemplars (B2.4). | B3.8 |
| **B3.10 — Remotion render seam** | Approved script → Remotion composition (brand styling from profile) → MP4 + **deterministic SRT from the authored script** (no ASR for own content); TTS behind a seam (first cut may be on-screen text + music); content-addressed render cache. Remotion licence = **growth gate** (free for ≤3-person companies incl. for-profit; swap path behind the seam) — downgrades A5's launch-gate note. | B3.9 |
| **B3.11 — Loop closure + profile UX** | B2.3 dogfood on the first **generated** pillar's SRT → clip plans (Sprint-2 exit review completes here; its B2.5 half — pinned docs-search demo plan — runs as sprint opener). Profile editor/switcher UI, shaped by B3.9/B3.10 usage. Overrides → eval rows; green suite gates sprint exit. | B3.10 |
| **B3.12 — Trend-intel intake (amendment A7: promoted from pull-trigger — founder direction: the operator never curates trends manually; finding them IS the product's feature 2)** | Per-tenant watchlists (accounts/queries/niches, runtime config) → official-API pollers behind one `TrendSource` driver seam (YouTube Data API first — free quota; AT Protocol/Bluesky next — open; X API v2 when its paid tier is funded) → timestamped engagement snapshots into the existing generic `source_metrics` → **deterministic outlier detection in core** (velocity vs account baseline · share-to-view · bookmark-efficiency — the operator blueprint's ratio formulas as tested math, never model vibes) → outliers auto-ingest as exemplars (PII-stripped, denylist-screened) feeding the existing B2.4 retrieval into every generation. Extraction tiers, honestly bounded: text platforms = full text via official APIs; video platforms = title/description/tags/stats + thumbnail (vision tier arrives with B3.7); spoken-hook transcripts only via permitted paths (owner-authorized captions, licensed sources, operator-supplied files) — **never audio ripping or proxy-cluster scraping** (A5/ADR-0002 rejection stands; the blueprint's §6–7 scraper architecture is explicitly not built). Disjoint from B3.8–B3.11 — parallel-lane candidate. | B2.4 |
| **B3.13 — Whisper transcript driver (pulled)** | Self-hosted Whisper (whisper.cpp / faster-whisper, MIT) behind the existing B2.2 `TranscriptProvider` seam: operator-owned/permitted media → word-timestamped transcripts (feeds B2.3 clip windows). NOT on the pillar critical path — generated pillars are born with SRT at B3.10; pulled when the first permitted-media transcription need lands. | B2.2 seam |

Standing dogfood flywheel: origination runs across all three tenants → eval rows; trend intel is B3.12's job (manual exemplar drops stay possible as an interim convenience, never the product). Parallel [you] track: LinkedIn + X OAuth developer apps (B3.1 long pole) · gateway credit top-up (judge tier needed this sprint) · profile content for the two real companies (runtime data — the first company's name is a guarded token, so its config lives only in gitignored/vault space).

### Pulled, not pushed — B3.1–B3.7 (each chartered at its own checkpoint)

| Bucket | Deliverable |
|---|---|
| B3.1 | Publisher (LinkedIn + X first): OAuth token store + refresh worker; MSW-mocked → live = one env flip. Platform OAuth apps + audits are founder-supplied and filed early — they are the long pole. |
| B3.2 | **G5 AI-disclosure gate — hard precondition for any public post** (EU AI Act Art. 50, in force 2026-08-02). |
| B3.3 | Multi-platform preview/edit (canonical item → per-platform variants; render N ratios from one composition). |
| B3.4 | Demo-video pipeline (drives any operator-pointed web app; Fargate render rig + content-addressed render cache). |
| B3.5 | Analytics MVP (generation-metadata ↔ performance join) **+ trend radar / outlier detection — official platform APIs only (A5)**. |
| B3.6 | Studio shell. |
| B3.7 | **Visual-ingest tier (A5):** Apache-2.0 visual-RAG sidecar behind the ingest seam (screenshot-tile rendering + visual retrieval for exemplars/site design); schema seam (`modality`/`visual_ref`) lands at B2.2; pulled once B2.4 proves exemplar value. |

## Exit criteria (Sprint 0–1 = the MVP gate)

- [ ] Charter approved before any feature code (this file).
- [ ] Off-machine remote exists; grep guard is a required CI check; zero forbidden-token hits in tracked files.
- [ ] Multi-tenant schema from table 1; own sub-account, own DB, own gateway key; no cross-project infra dependency.
- [ ] Sprint-1 vertical: one source → generic-profile fan-out → G1+G3 two-tier gate → Approve queue; no ungated draft can reach the queue (test-proven); no publish path wired.
- [ ] Eval harness live; `edit_diff`/override captured from the first draft; green suite armed as the ship gate at Sprint-1 exit.
- [ ] Operational mirror stood up (external to this repo).

## Amendments

- **2026-07-03 — Spine adoption (founder-approved).** Architecture home: `docs/SPINE.md`; decision record: `docs/adr/0001-spine-adoption.md`.
  - **A1** — dev DB seam driver = **embedded Postgres (PGlite)** replacing SQLite: one SQL dialect dev→prod, dev-side pgvector for the grounding index, per-worktree DB isolation preserved.
  - **A2** — B0.3 adds `fanout_runs` (idempotency + fan-out batch anchor) · `events` (append-only audit spine) · `usage_ledger` + per-tenant daily budget caps enforced in the gateway wrapper.
  - **A3** — package extraction at B0.3 (`packages/{contracts,db,platform,engine}`, `proprietary/{judge,prompts,profiles}` skeleton) + three enforcement ratchets: import-boundary lint, tenant-id schema test, draft-state-machine property test.
  - **A4** — parallel-ready plumbing: `COORDINATION.md` lane board, `.worktreeinclude`, tracked worktree settings, and `agent_handoff/CURRENT.md` (single-file session handoff, overwritten each wrap).
- **2026-07-04 — A5 Sprint-2 expansion (founder-approved).** Decision record: `docs/adr/0002-sprint2-expansion.md`. Adds B2.2–B2.6 (timed ingest + single contract window · waterfall clip plans · exemplar library · demo-plan slice · queue UI) and B3.7 (visual-ingest sidecar, pulled); folds trend radar into B3.5 (official APIs only); transcript capability built in-house (self-hosted Whisper as strategic driver; hosted APIs = optional adapters behind the seam); fine-tuning parked indefinitely (the eval corpus keeps the option open); rejected: ToS-evading scraper architectures. Rendering stays B3.3/B3.4 (Remotion licence = launch gate; superseded by A6 — growth gate).
- **2026-07-05 — A6 Sprint-3 re-charter: origination + profiles (founder-approved; shape delegated to lead recommendation).** Decision record: `docs/adr/0003-sprint3-origination.md`. Founder correction: no pillar video/caption/SRT exists or will be supplied — **generating it is the product**. Adds B3.8–B3.11 (profile spine → pillar origination → Remotion render seam → loop closure + profile UX) + pull-trigger B3.12 (lean official-API trend intake). Sprint-2 exit review completes inside Sprint 3 (B2.5 dogfood = opener; B2.3 dogfood = first generated pillar). Downgrades A5's Remotion note: free licence covers ≤3-person companies **including for-profit** → growth gate with swap path behind the render seam, not a launch gate. B3.1–B3.7 remain pulled; no publish path wired in Sprint 3.
- **2026-07-05 — A7 Trend-intel promotion (founder direction at the B3.8 checkpoint).** The operator must never have to find viral/trending content manually — automated acquisition is the product's second core feature, informed by the operator-supplied viral-content pipeline blueprint (runtime research input, never committed). B3.12 is promoted from pull-trigger to chartered bucket (watchlists → official-API pollers behind a `TrendSource` seam → `source_metrics` snapshots → deterministic outlier ratios → auto-exemplar ingest); B3.13 (Whisper driver behind the B2.2 `TranscriptProvider` seam) added as pulled. Blueprint mapping recorded honestly: its RAG-injection, HITL-correction, metric-snapshot, and brand-safety pieces already exist in Thalon (B2.4 · edit-diffs→eval · source_metrics · judge/denylist); its fine-tuning stays parked (A5) and its §6–7 proxy-cluster/DOM-evasion scraper architecture stays rejected (ADR 0002). Extraction is tiered: text via official APIs, video via metadata+thumbnail, transcripts only via permitted paths.
