# Thalon spine — architecture & operating blueprint

> **Status: APPROVED — founder, 2026-07-03.** Amendments A1–A4 adopted (recorded in `docs/adr/0001-spine-adoption.md` and `CHARTER.md` § Amendments). Drafted 2026-07-03 at the pre-B0.3 design checkpoint. Inputs: the approved charter (`CHARTER.md`), the B0.1–B0.2 build state, the research vault (pointer in `.context/READ-ME-FIRST.md`), and three founder-supplied engineering references: a deterministic-core/probabilistic-shell (DCPS) blueprint, an AI-codebase-optimisation guide, and a multi-agent coordination primer (already distilled into the vault's parallel-agent playbook). Sections marked **[AMENDMENT]** change or extend the charter and need founder approval; everything else elaborates it without changing scope.

---

## 1. Doctrine — deterministic core, probabilistic shell

Thalon's single most important structural rule. Every module below is classified as **core** (typed, deterministic, testable: given X always Y) or **shell** (LLM-powered, probabilistic, quarantined). The judge harness and Approve gate the charter already mandates are instances of this doctrine; this section makes it universal.

| Rule | Meaning in Thalon |
|---|---|
| **Shell is read-only** | No LLM call path ever mutates the database or calls an external side-effecting API. Shell functions return candidate values; only core code persists them. |
| **Validation guard at every boundary** | Every shell output crosses into the core through a Zod schema in `packages/contracts` (AI SDK `generateObject`/`streamObject` with schema, bounded repair-retries, then dead-letter to the operator). No unvalidated LLM output is ever written to a table. |
| **State lives in the core** | Draft lifecycle, tenancy, budgets, queues, caches are deterministic code + DB constraints. LLMs never hold session state; context is passed explicitly per call. |
| **Idempotency everywhere the shell triggers work** | Content-addressed keys make every generation, retrieval, and (later) publish operation safe to retry: run it twice, get one result. |
| **Hard budgets and timeouts on the shell** | Every gateway call carries a token limit + timeout; a per-tenant daily budget ledger hard-stops generation when exceeded (fail loud, emit event, never silently degrade). |
| **Deterministic fallbacks** | Formatting, linting, char-limit truncation, denylist matching (G1), scheduling, rendering are pure functions — never delegated to a model. |

**Shell inventory (the only places LLMs are allowed):** ingest extraction, fan-out generation, judge G3 screen + final (and later G2 claims-match, G4 policy classifier), highlight-select (clipping, Sprint 3+). Each lives in a module whose imports are restricted (lint-enforced, §3.4) so the boundary is structural, not conventional.

### 1.1 The draft lifecycle — an explicit state machine

The core's centerpiece. One transition function is the **only writer** of `drafts.status`; every transition is validated, evented, and covered by a property test. This turns the charter invariant *"no ungated draft can reach the queue"* from a discipline into a mechanism.

```
generated ──► judging ──► queued ──► approved ──► scheduled ──► published
                 │           │           ▲                        (Sprint 3+)
                 ▼           ▼           │
              blocked     rejected   (approve-with-edit ⇒ re-judge:
             (operator                edited body = new content →
              triage)                 back to `judging` first)
```

Invariants (each enforced in the transition fn **and** asserted by tests):

- **I1** — `→ queued` requires a passing final-tier `judge_results` row **for the current body hash**. Editing a draft invalidates its verdicts.
- **I2** — `→ published` (Sprint 3+) additionally requires an `approvals` row and a passing G5 disclosure verdict. No publish path exists at all in Sprints 0–2.
- **I3** — Judge-tier disagreement ⇒ `blocked` + operator queue, never a silent pass (ratified decision 2).
- **I4** — every transition appends one `events` row (audit; analytics substrate later).

---

## 2. Product architecture

### 2.1 Purpose

One sentence or source in → fan-out into platform-native drafts per tenant runtime config → every draft passes the shared judge harness → human Approve → (Sprint 3+ only) publish via official APIs. Multi-tenant from table one; brand/voice, grounding sources, and compliance rules are data, never code. The operator's per-post minutes must **fall** as the system matures — every feature removes operator work or it doesn't ship.

### 2.2 Modules and their homes

| Module | Home | Core/Shell | Sprint |
|---|---|---|---|
| Contracts (types, Zod schemas, status enums, tenant-config shape) | `packages/contracts` | core — **the frozen contract** | B0.3 |
| Data layer (schema, migrations, tenant-scoped repositories) | `packages/db` | core | B0.3 |
| Platform seams (db/object-store/queue/gateway drivers) | `packages/platform` | core | B0.2→B0.3 (moved) |
| Ingest (source → chunks → embeddings → grounding index) | `packages/engine/ingest` | shell (extract) + core (store) | B1.1 |
| Fan-out (source × profile × platform → drafts) | `packages/engine/fanout` | shell (generate) + core (orchestrate) | B1.2 |
| Judge harness (G1 lint · G3 two-tier grounding; G2/G4/G5 later) | `proprietary/judge` | G1 core · G2–G5 shell verdicts, core enforcement | B1.3 |
| Prompts + niche/brand profile templates (versioned data files) | `proprietary/prompts` · `proprietary/profiles` | data | B1.2+ |
| Approve queue / operator inbox (+ `edit_diff` capture) | `apps/web` | core UI | B1.4 |
| Eval loop (tracing, CI eval gate, golden sets) | `eval/` | core | B0.4 |
| Publisher (OAuth token store, per-platform adapters, mocked) | `packages/publisher` | core | Sprint 3+ |
| Renderer (video/stills — deterministic, content-addressed) | `packages/render` | core | Sprint 3+ |
| Analytics (generation-metadata ↔ performance join) | `packages/analytics` | core | Sprint 3+ |
| Infra (CDK-Python stacks) | `infra/` | core | B0.5 |

Interfaces between modules are **only** through `packages/contracts` types and the `events` table. `apps/web` API routes stay thin: parse/authorize → call an engine/judge service → return. No business logic in routes; no DB access outside `packages/db` repositories.

### 2.3 Key workflows

1. **Generate:** operator prompt/URL/doc → `sources` → chunk+embed (`source_chunks`) → fan-out run (one per source × profile, idempotent by generation key) → N `drafts` (status `generated`).
2. **Gate:** per draft: G1 denylist (pure fn, runs first, cheapest) → G3 screen (cheap model) → G3 final (strong model) → agree-pass ⇒ `queued`; any fail/disagree ⇒ `blocked` with per-claim evidence rows.
3. **Approve:** operator reviews queue (badges show gate evidence) → approve / reject / edit. Any edit ⇒ `edit_diffs` row + `eval_cases` row **in the same transaction** ⇒ re-judge.
4. **Publish (Sprint 3+):** approved → `publish_queue` (schema exists from B0.3) → worker with idempotency key → official API → platform AI-disclosure flag (G5 hard precondition).
5. **Learn:** eval suite (golden set + accumulated overrides) runs in CI; green suite = ship gate from Sprint-1 exit.

### 2.4 Stack (confirmed + refinements)

- **App:** Next.js 16 App Router + TypeScript + shadcn/ui, on Vercel. API routes for light work; queue seam for anything slow.
- **AI:** own gateway (`ai` v5 `createGateway`), per-call model routing (`draft` / `judgeScreen` / `judgeFinal` tiers, env-overridable). All calls through one wrapper that enforces budget, timeout, cache, tracing.
- **Data:** Drizzle ORM. **[AMENDMENT A1]** dev seam driver becomes **PGlite** (embedded Postgres, Apache-2.0, in-process, pgvector-capable) instead of better-sqlite3 — one SQL dialect and one migration set dev→prod, and the grounding index (pgvector) works identically in dev. Prod stays Aurora Serverless v2 Postgres + pgvector HNSW. Each worktree/test run still gets its own throwaway DB file (the property that made SQLite attractive is preserved).
- **Storage/queue/auth:** local→S3, inline→SQS, dev→Clerk seams as built in B0.2.
- **Eval:** Langfuse (self-host) + promptfoo + DeepEval — $0/MIT-Apache only.
- **Infra:** CDK-Python, GitHub OIDC, own sub-account, ap-southeast-2.
- Deferred deliberately: Redis/ElastiCache (Aurora tables cache fine at this scale), Turborepo (npm workspaces suffice), any agent-framework runtime (LangGraph/AutoGen — patterns only, never the dep), microservices (modular monolith until a module proves it needs a process boundary).

### 2.5 Schema (B0.3, elaborated)

Charter table list, plus three additions **[AMENDMENT A2]**: `fanout_runs`, `events`, `usage_ledger`. Every table carries `tenant_id` (on caches it is for accounting; keys are content-addressed). Hot-path composite indexes per charter: `(tenant_id,status)`, `(tenant_id,platform,scheduled_at)`, `(tenant_id,created_at)`.

| Table | Purpose / notable columns |
|---|---|
| `tenants` | `id, slug, name, status`. Tenant #0 = self/dogfood; #2 (Sprint 2) proves config-not-code. |
| `brand_profiles` | **Versioned** per-tenant config-as-data: `voice` JSONB, `denylist` JSONB, `platform_profiles` JSONB (niche profiles: tone, char limits, hashtag/CTA policy, disclosure string), `version`, `active`. Drafts record the profile version they were generated under (provenance for evals). |
| `sources` | `kind (url\|prompt\|doc\|feature)`, `uri`, `raw_ref` (object store), `content_hash`, `meta`. |
| `source_chunks` | `source_id, seq, text, embedding (pgvector), token_count, content_hash`. The grounding index — HNSW in prod. |
| `fanout_runs` | One row per fan-out invocation: `source_id, brand_profile_id+version, platforms[], prompt_version, model, params, generation_key UNIQUE, status`. The idempotency + provenance anchor; groups the N drafts of one run (the Approve batch unit). |
| `drafts` | `fanout_run_id, source_id, platform, format, body, body_hash, meta` (hook_type, template ids — the future analytics join keys), `status` (state machine §1.1), `generation_key UNIQUE`. |
| `judge_results` | Append-only: `draft_id, gate (g1\|g3_screen\|g3_final\|…)`, `verdict (pass\|fail)`, `body_hash` (verdicts bind to content, not just draft id — invariant I1), `evidence` JSONB (per-claim structured verdicts), `model, prompt_version, latency_ms`. Gate column is open-ended text: G2/G4/G5 need **zero migrations** later. |
| `approvals` | Append-only: `draft_id, actor, action (approve\|reject\|edit), edited_body`. |
| `edit_diffs` | `draft_id, approval_id, before_hash, after_hash, diff`. Captured on **every** operator touch. |
| `eval_cases` | `kind, input JSONB, expected JSONB, origin (edit_diff\|golden\|manual), source_ref`. An `edit_diffs` insert creates its eval row in the same transaction — the "every override becomes an eval row" rule as a mechanism, not a habit. |
| `publish_queue` | Schema now, worker Sprint 3+: `draft_id, platform, scheduled_at, status, idempotency_key UNIQUE`. |
| `events` | Append-only audit spine: `entity_type, entity_id, event, payload JSONB, actor`. Written by every state transition (I4). Later: the analytics substrate and debugging timeline. |
| `usage_ledger` | Per `tenant × day × model`: tokens in/out, estimated cost. The gateway wrapper checks it **before** each shell call against a per-tenant daily cap (env-configured); over-budget ⇒ hard stop + event. |
| `llm_cache` | `key = hash(prompt_version + model + params + input_hash)` → value ref, hit count. Identical generations skip the gateway. |
| `retrieval_cache` | `key = hash(source_set_hash + query_hash)` → top-k result. |

### 2.6 Tenancy, security, permissions

- **App-enforced scoping now, RLS at Aurora.** Every repository function in `packages/db` takes a `TenantCtx` as its first argument; raw DB handles are not exported outside the package (lint-enforced). A schema test asserts every table carries `tenant_id`. When B0.5 lands Aurora, add Postgres RLS policies (`tenant_id = current_setting('app.tenant_id')`) as defense-in-depth — the repo API doesn't change.
- **Auth:** Clerk (dev-seamed); Clerk org ↔ tenant mapping. Roles: `operator` (approve/publish rights) now; `tenant-admin` / `reviewer` seats are a column, not a redesign, later.
- **Secrets:** env locally, Secrets Manager in prod; OAuth token store (Sprint 3) encrypted at rest, never logged. `.env.example` placeholders only.
- **Content compliance is a product feature, not this section:** the judge harness (G1/G3 now; G2 claims registry, G4 platform policy, G5 AI-disclosure later) — see charter Sprint 3 for the G5 hard deadline (EU AI Act Art. 50, 2026-08-02, before any public post).
- **Eval hygiene:** no PII enters eval datasets; demo/synthetic data only.

### 2.7 Performance doctrine

Precompute and content-address (portfolio rule, already in the build ledger): the grounding index is materialized at ingest (never re-embed per judge call); fan-out itself is a materialization; the Approve queue renders off a covered index (a projection table only if profiling ever demands it); generation/retrieval/render caches make re-runs ~free — which is what makes dogfooding and evals cheap enough to run constantly. Slow work goes behind the queue seam from day one so "inline dev → SQS prod" is a flip, not a refactor.

---

## 3. Structural blueprint

### 3.1 Target repo layout **[AMENDMENT A3 — package extraction at B0.3]**

```
E:\thalon/
├── AGENTS.md ≡ CLAUDE.md        # operating protocol (canonical: AGENTS.md)
├── CHARTER.md                   # approved buckets; amendments need founder approval
├── COORDINATION.md              # parallel-lane board
├── agent_handoff/CURRENT.md     # session handoff: pointer + delta + next action (overwritten each wrap)
├── .worktreeinclude             # .env*, .context/** → copied into every worktree
├── docs/
│   ├── SPINE.md                 # this file
│   ├── adr/                     # NNNN-slug.md — repo build decisions (research stays in the vault)
│   └── runbooks/                # operate/maintain procedures as they accrete
├── packages/
│   ├── contracts/               # Zod schemas + types + status enums — THE FROZEN CONTRACT
│   ├── db/                      # drizzle schema, migrations, tenant-scoped repositories
│   ├── platform/                # seams: db-driver/object-store/queue/gateway wrapper (from apps/web/src/lib)
│   └── engine/                  # ingest/ · fanout/ (each: core orchestration + shell/ subfolder)
├── proprietary/                 # the moat, separated from boilerplate
│   ├── judge/                   # gate implementations + the transition-fn enforcement
│   ├── prompts/                 # versioned prompt files (data, never inline strings)
│   └── profiles/                # demo-tenant brand/niche profile data + profile JSON schema
├── apps/web/                    # Next.js: thin routes + UI only
├── eval/                        # promptfoo/DeepEval config, golden sets, Langfuse wiring
├── infra/                       # CDK-Python (B0.5)
└── scripts/                     # ci-grep-guard.ps1 + repo tooling
```

Why now: B0.3 is the last cheap moment — the schema must land in `packages/db`, not `apps/web/src/lib/db`, or the parallel-lane partition (§5) has no package boundaries to cut along, and the moat (judge) would grow tangled into the web app.

### 3.2 Conventions

- **Files:** kebab-case; one concern per file; soft cap ~200 lines (split, don't scroll); tests colocated in `__tests__/` mirroring source; `@thalon/*` package scope.
- **SQL:** snake_case; every table `tenant_id`; enums as CHECK-constrained text; append-only tables never UPDATE.
- **Prompts:** files under `proprietary/prompts/<name>.v<N>.md` — bump the version on any change; `prompt_version` flows into generation keys, judge rows, and eval rows. Prompt edits are diffs in PRs, not string changes buried in code.
- **Env/config:** one Zod-validated config module (`packages/platform/env`) — the only place `process.env` is read.
- **Branches:** `agent/<lane>/<task>`; conventional commits; guard before every commit.

### 3.3 Knowledge & documentation boundaries

| Store | Holds | Never holds |
|---|---|---|
| Research vault (via `.context/`, read-only) | Product research, syntheses, roadmap rationale | Build state; anything the repo needs to compile |
| `docs/` in-repo | SPINE, ADRs (one decision each), runbooks | Research dumps; vault paths or upstream brand tokens |
| `CHARTER.md` | The approved build sequence + standing discipline | Design detail (lives here in SPINE) |
| `agent_handoff/CURRENT.md` | The stamped session handoff — pointer + delta + next action, **one file, overwritten** at each session wrap | State dumps; task databases; anything CHARTER/COORDINATION already holds (link instead) |
| Operational mirror (external) | Session-state mirror for the founder | — (maintained outside this repo, per charter) |
| Agent memory | Cross-session agent context | Anything the repo already records |

Rule of one home: every lesson lands as exactly one artifact (test, CI check, ADR, seam, or AGENTS.md rule) and links elsewhere — never copies.

### 3.4 Standardised vs unique

**Portfolio-standard (share the pattern with sibling repos):** dev→prod seams; grep-guard-in-CI pattern; session-wrap ritual; parallel-worktree protocol (`COORDINATION.md` + `.worktreeinclude` + serialized merge gate); $0 eval stack; content-addressed caching; conventional commits; ADR format. **Thalon-unique (the moat, keep in `proprietary/`):** judge harness + gate evidence format; niche-profile object shape; fan-out prompt chains; draft state machine tuning; (later) render templates and the generation↔performance analytics join.

**Boundary enforcement (cheap ratchets, added with A3):** an ESLint boundary rule — `apps/web` may not import `packages/db` internals or any `shell/` module; `shell/` modules may not import repositories (write paths). Plus the schema-has-tenant_id test and the state-machine property test. These three checks make the DCPS doctrine and tenancy discipline structural.

---

## 4. Build / operate / maintain plan

### 4.1 Build sequence

- **Foundation (B0.1–B0.5):** B0.1–B0.2 ✅. B0.3 (with amendments A1–A3) = contracts + schema + state machine + grounding index + caches + budget ledger + package extraction. B0.4 eval scaffold **before any draft exists**. B0.5 AWS bootstrap (parallel-safe lane).
- **MVP (Sprint 1):** the safe vertical slice exactly as chartered (B1.1–B1.5), built as parallel lanes after B0.3 freezes the contract (§5). Smallest useful version: dogfood tenant #0, one source → gated drafts → Approve, eval suite arming at exit.
- **V1 (Sprint 2 + hardening):** tenant #2 as pure config (zero code — the proof), RLS live on Aurora, batch-approve UX, budget caps proven under dogfood load, runbooks for the first three failure modes seen.
- **Expansion (Sprint 3+, pulled not pushed):** publisher → G5 disclosure gate (hard precondition, EU AI Act date) → preview/edit → video pipeline → analytics. Architecture preserves these paths now via: `publish_queue` schema, open-ended `judge_results.gate`, `drafts.meta` join keys, the queue seam, and the events spine — no speculative code beyond that.

**Decide before B0.3 (blocking):** A1 PGlite; A2 three schema additions; A3 package extraction; draft status vocabulary (§1.1); contracts ownership (one owner, frozen per sprint).
**Safely deferred:** RLS timing (B0.5+), G2 claims-registry shape, analytics schema detail (only rule now: generic `metric_name`/`metric_value`, never hard-coded platform metrics), projection tables, Redis, studio shell, Turborepo.

### 4.2 Lifecycle table

| Layer | Build deliverables | Operating deliverables | Maintenance requirements | Exit criteria |
|---|---|---|---|---|
| Foundation | B0.3 schema+contracts+caches+ledger; B0.4 eval scaffold; B0.5 sub-account+OIDC+CDK skeleton | CI green (guard+tests required); session-wrap ritual running | Dep updates monthly; guard passes every commit | Charter B0 exit boxes ✅; contracts frozen; lanes cuttable |
| MVP (S1) | Ingest→fan-out→judge→queue slice; edit_diff→eval capture proven by test | Daily dogfood on tenant #0; overrides→eval rows automatically; weekly judge-quality triage | Golden set grows monotonically; budget ledger watched | No ungated draft can reach queue (test-proven); green suite armed; charter S0–S1 boxes ✅ |
| V1 (S2) | Tenant #2 config-only; RLS; batch approve | Queue review ≤ minutes/day; cost/post tracked | Restore drill done once; runbooks for seen failures | Second tenant added with **zero code changes**; suite green |
| Expansion (S3+) | Publisher+G5, preview, video, analytics — each re-chartered | Scheduled publishing under Approve; analytics loop live | Token refresh worker monitored; render cache hygiene | G5 verified before first public post; per-post operator minutes demonstrably falling |

### 4.3 Operating model (solo founder + build agents)

**Hats:** Founder = product, charter, approvals, named accountable editor (the human-review path for AI-disclosure). Build-lead agent = main lane, partition planning, merge order. Reviewer = CI + review pass at each merge. Operator = dogfood content through the real Approve queue. Each hat is one person today; the seams (approvals table, COORDINATION.md, CI gate) are where a second person plugs in later without redesign.

**Rhythms:** per session — orient (CLAUDE.md/charter), end clear-safe (guard→commit→push→stamped resume). Per bucket — founder checkpoint. Daily (once dogfooding) — one Approve-queue pass; overrides become evals automatically. Weekly — eval-suite review; judge false-pass/false-block triage (each miscall → an eval row + possibly a denylist/prompt fix); gateway-spend glance via `usage_ledger`. Monthly — dependency + licence pass (MIT/Apache-only on the hot path), backup check. Quarterly — re-charter the next sprint; prune stale docs (rule of one home).

**Feedback loops, ranked by signal quality:** (1) Approve-gate edit_diffs — the dominant training signal pre-audience, captured structurally; (2) eval suite in CI — the regression floor and ship gate; (3) build-lesson ratchets (rule 8); (4) analytics join — Sprint 3+, thin by design until an audience exists (never fake significance on zero traffic).

**KPIs:** operator minutes per approved post (north star: falls); % drafts approved unedited (fan-out quality); judge precision/recall vs operator overrides (safety quality); eval pass rate (ship gate); cache hit rate (economics); cost per approved draft; source→queued latency.

### 4.4 Maintenance model

- **Regular upkeep:** deps (monthly), prompt/profile versions (on change, via PR), golden set (grows via overrides), denylist per tenant (data change, no deploy), model-tier choices (env, revisit when gateway pricing/models shift), CDK drift (B0.5+).
- **Likely failure points → containment:** judge false-pass (two-tier disagreement blocks; weekly triage; eval rows) · gateway cost spike (usage_ledger hard cap) · schema drift dev/prod (killed by A1 single dialect) · seam rot (each seam's prod driver gets a smoke test when first wired, then stays in CI) · platform API/audit churn (Sprint 3 long pole — file OAuth apps early; adapters isolated in `packages/publisher`) · solo bus-factor (runbooks + operational mirror + this file).
- **Monitoring:** Langfuse traces on every shell call (cost, latency, verdicts); `events` table is the debugging timeline; CI is the drift alarm. Uptime/alerting stays trivial until publishing exists — a failed cron on a draft pipeline loses no user data.
- **Debt control:** file-size cap; boundary lints; "every lesson leaves a ratchet in the same change"; append-only tables never rewritten; migrations forward-only.
- **Versioning/change management:** conventional commits; prompt/profile/schema versions recorded on every generated row (full provenance: any draft can be traced to prompt vN + profile vM + model + source hash); charter amendments founder-approved only.
- **Backup/continuity:** Aurora automated snapshots + S3 versioning (B0.5+); dev data disposable by design; the repo + vault + mirror are the recovery set; one restore drill at V1.

---

## 5. Parallel-build operating system (within-repo)

Adopted from the portfolio parallel-agent playbook (vault) — the coordination primer's patterns, minus its machinery (no file locks, no vector-DB state, no framework runtime):

- **Isolation:** git worktrees, one lane = one branch = one disjoint package glob. Dev DB/store/queue isolation is free via the local seams (each worktree its own data dir); offset dev ports.
- **Contract:** `packages/contracts` + the drizzle schema, committed at B0.3, **frozen per sprint, one owner**. A lane needing to edit the contract = the partition was wrong ⇒ re-plan, not ad-hoc edit.
- **Ledger:** `COORDINATION.md` — lane table (owner, glob, branch, status, depends-on, merge-order) + append-only messages; one writer per row.
- **Merge gate:** serialized through `main` in merge-order; rebase → CI (guard+lint+tests) green → review → merge; next lane rebases. Never merge on red. Conflicts (partition leak) get a deliberate reconcile — never a silent overwrite — then fix the partition.
- **Caps:** 3–5 lanes max; kill an agent stuck ~3 iterations on the same error; delegate tasks, not judgment — the founder keeps architecture and the seams.
- **Sprint-1 lane map (after B0.3):** engine lane (`packages/engine/**`, B1.1→B1.2) · judge lane (`proprietary/judge/**`, B1.3) · UI lane (`apps/web/**`, B1.4 against an MSW mock of the contract) · eval lane (`eval/**`, B0.4→arms at B1.5). Merge order: engine → judge → ui → eval. B0.5 (AWS) is a founder-dependent side lane, never blocking.

---

## 6. Risks and weaknesses (called out)

1. **Everything currently lives in `apps/web`** — without A3 the moat grows into the UI app and lanes have nothing to own. Highest-leverage structural fix; do at B0.3.
2. **SQLite-dev vs Postgres-prod dialect drift** — two schemas or lowest-common-denominator SQL, and no dev pgvector. A1 (PGlite) removes the entire class. Trade-off: newer dependency than better-sqlite3; mitigated by the seam (worst case, swap back is one driver file).
3. **Charter had no cost guardrail** — an agentic fan-out×judge pipeline can loop expensively. `usage_ledger` + hard caps (A2) is the DCPS answer; cheap now, painful after a bill.
4. **"Override → eval row" was a habit, not a mechanism** — now a same-transaction trigger path (§2.5). Habits decay; transactions don't.
5. **Judge verdicts must bind to content** — verdict keyed on `body_hash`, not just draft id, or an edit silently launders a blocked claim (I1). Easy to get wrong later; locked in the schema now.
6. **Provenance gaps would hollow out the eval stack** — without prompt/profile versioning on every row, next month's suite can't reproduce this month's generation. Versioned-prompts-as-files is therefore B1.2-blocking, not a nicety.
7. **Vault roadmap gravity** — the research catalog is far larger than the charter; the pulled-not-pushed rule is the defense. This SPINE deliberately adds **no** new feature scope.
8. **EU AI Act clock (2026-08-02)** — irrelevant while nothing publishes (Sprints 0–2 publish nothing), binding the moment Sprint 3 is chartered. G5 stays the hard precondition it already is in the charter.

---

## 7. Amendment bundle — **ADOPTED (founder approval, 2026-07-03)**

| # | Amendment | Charter touch | Cost | Recommendation |
|---|---|---|---|---|
| A1 | Dev DB driver: better-sqlite3 → **PGlite** (one dialect, dev pgvector, per-worktree isolation preserved) | B0.2/B0.3 wording ("SQLite" → "embedded Postgres") | ~½ day incl. migrating the B0.2 seam + tests | **Adopt** |
| A2 | Add `fanout_runs`, `events`, `usage_ledger` (+ per-tenant budget caps in the gateway wrapper) to B0.3 | B0.3 table list | ~½ day inside the schema bucket | **Adopt** |
| A3 | Extract `packages/{contracts,db,platform,engine}` + `proprietary/{judge,prompts,profiles}` skeleton at B0.3; add boundary lints, tenant-id test, state-machine test | none (layout, not scope) | ~½ day | **Adopt** |
| A4 | Parallel-ready plumbing: `COORDINATION.md`, `.worktreeinclude`, worktree settings, `agent_handoff/CURRENT.md` | none (AGENTS.md rule 9 already mandates proposing lanes) | ~15 min | **Adopted — landed with the spine commit** |

---

*Proposed 2026-07-03. On approval: fold A1–A3 into the B0.3 execution plan, record the decision as `docs/adr/0001-spine-adoption.md`, and update CHARTER.md wording (founder-approved amendment). This file is the architecture home; the charter stays the sequence home; research stays in the vault.*
