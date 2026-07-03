# eval/ — the eval loop (B0.4 scaffold)

$0, self-hostable, MIT/Apache-only (charter standing discipline). Stood up
**before any draft exists** so every operator override is captured from the
first dogfood day. The green suite becomes the ship gate at Sprint-1 exit
(B1.5); until then it accumulates.

| Piece | Licence | Role | Status at B0.4 |
|---|---|---|---|
| capture → dataset (`src/`) | ours | `eval_cases` rows (written transactionally by `@thalon/db` on every operator edit) → JSONL datasets | **live + test-proven** |
| golden seed (`golden/seed.jsonl`) | ours | curated, synthetic, only-grows baseline cases | seeded |
| promptfoo (`promptfoo/`) | MIT | prompt-level evals (fan-out, judge prompts) | keyless smoke config; real evals B1.2/B1.3 |
| DeepEval (`deepeval/`) | Apache-2.0 | pytest-style metrics incl. deterministic custom metrics | keyless denylist metric vs golden seed |
| Langfuse | MIT (self-host core) | tracing every shell call: cost, latency, verdicts | env seam wired (`tracing` in /api/health); traces attach at the gateway wrapper from B1.1 |

## Commands

```powershell
npm test                                   # includes the capture→dataset proof (vitest, embedded Postgres)
npm run -w @thalon/eval export -- self     # eval_cases → eval/datasets/eval-cases.self.jsonl (gitignored, derived)
npm run -w @thalon/eval promptfoo          # keyless harness smoke
cd eval/deepeval; python -m venv .venv; .venv\Scripts\pip install -r requirements.txt; .venv\Scripts\python -m pytest
```

Langfuse self-host: follow the official docker-compose quickstart
(https://langfuse.com/self-hosting), then set `LANGFUSE_PUBLIC_KEY`,
`LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST` per `apps/web/.env.example` — the
health endpoint's `tracing` seam flips to `configured`.

## Rules (from the charter/SPINE — enforced, not aspirational)

- **Every override becomes an eval row in the same change** — this is a
  database transaction (`approvals.record`), not a habit; the end-to-end test
  in `src/__tests__/capture-to-dataset.test.ts` is its regression floor.
- **The golden set only grows.** Curating down is a reviewed, deliberate act.
- **No PII in datasets** — synthetic/demo data only.
- **Datasets are derived, never committed** (`eval/datasets/` is gitignored);
  the golden seed is the committed part.
