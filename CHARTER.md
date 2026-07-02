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
- Dev runs on local seams (SQLite · local object store · inline queue); cloud stacks land only when a bucket needs them.

## Buckets

### Sprint 0 — foundation

| Bucket | Deliverable | Depends on | Founder-supplied |
|---|---|---|---|
| **B0.1 — Remote + CI guard** (first action) | Private GitHub repo created from this directory; push; GitHub Actions workflow running the grep guard as a **required check**; branch protection on `main`. | — | `gh` auth |
| **B0.2 — App skeleton, dev-seamed** | Next.js (App Router, TypeScript) + shadcn/ui; health endpoint; smoke test; `.env.example` (placeholders only); dev = SQLite + local object store + inline queue behind `sqlite→aurora`, `local→s3`, `inline→sqs` seams; Clerk dev-seamed; own AI-gateway wiring (`ai` ≥5.0.36 + `@ai-sdk/gateway`, v5 `createGateway`, per-call routing). | B0.1 | `AI_GATEWAY_API_KEY` (Clerk keys may trail) |
| **B0.3 — Schema table 1 + grounding index** | Multi-tenant schema: `tenants` · `brand_profiles` · `sources` · `source_chunks` · `drafts` · `judge_results` · `approvals` · `publish_queue` · `eval_cases`/`edit_diffs`. `tenant_id` on every row; composite hot-path indexes (`(tenant_id,status)`, `(tenant_id,platform,scheduled_at)`, `(tenant_id,created_at)`); grounding index behind the seam (dev = local vector store; prod = Aurora Postgres pgvector HNSW); content-addressed caches (LLM-generation keyed on prompt+model+params+input-hash; grounding-retrieval keyed on source-set-hash+query-hash). | B0.2 | — |
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

### Sprint 2 — seam proof

| Bucket | Deliverable | Depends on |
|---|---|---|
| **B2.1 — Fictional tenant #2** | Added purely as runtime config/data. Exit criterion: **zero code changes**. | B1.5 |

### Sprint 3+ — pulled, not pushed (each re-chartered at its own checkpoint)

| Bucket | Deliverable |
|---|---|
| B3.1 | Publisher (LinkedIn + X first): OAuth token store + refresh worker; MSW-mocked → live = one env flip. Platform OAuth apps + audits are founder-supplied and filed early — they are the long pole. |
| B3.2 | **G5 AI-disclosure gate — hard precondition for any public post** (EU AI Act Art. 50, in force 2026-08-02). |
| B3.3 | Multi-platform preview/edit (canonical item → per-platform variants; render N ratios from one composition). |
| B3.4 | Demo-video pipeline (drives any operator-pointed web app; Fargate render rig + content-addressed render cache). |
| B3.5 | Analytics MVP (generation-metadata ↔ performance join). |
| B3.6 | Studio shell. |

## Exit criteria (Sprint 0–1 = the MVP gate)

- [ ] Charter approved before any feature code (this file).
- [ ] Off-machine remote exists; grep guard is a required CI check; zero forbidden-token hits in tracked files.
- [ ] Multi-tenant schema from table 1; own sub-account, own DB, own gateway key; no cross-project infra dependency.
- [ ] Sprint-1 vertical: one source → generic-profile fan-out → G1+G3 two-tier gate → Approve queue; no ungated draft can reach the queue (test-proven); no publish path wired.
- [ ] Eval harness live; `edit_diff`/override captured from the first draft; green suite armed as the ship gate at Sprint-1 exit.
- [ ] Operational mirror stood up (external to this repo).
