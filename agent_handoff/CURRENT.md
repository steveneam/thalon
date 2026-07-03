# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-03 · B0.3 + B0.5 merged to main — Sprint 0 remaining: B0.4

## Pointer

Read in order: `CLAUDE.md` → `CHARTER.md` (§ Amendments) → `docs/SPINE.md` → `COORDINATION.md` (lane board + wrap messages).

## Delta (this session)

- **B0.3 merged** (PR #2): packages/{contracts,db,platform,engine} + proprietary skeleton, PGlite seam, 15-table schema, state machine (I1/I2/I4 enforced + tested), budget ledger, caches, all three A3 ratchets. Contract now **frozen for the sprint**.
- **B0.5 merged** (PR #3, Lane B): CDK-Python skeleton, `ThalonGithubOidc` stack live, SSO-only human access (static-key IAM user deleted), deploy workflow activated, infra pytest in CI, **first OIDC deploy run from main green — bucket closed**.
- GitHub authorship scrubbed to founder-only (history rewritten; `attribution` disabled in settings.local.json — never re-add).
- Standing founder directives (also in agent memory): lead drives lane mechanics end-to-end (merges included); no AI attribution anywhere.

## Next action

**B0.4 — eval scaffold** (last Sprint-0 bucket, `eval/**` + `apps/web` glue only; contract is frozen): $0/self-hostable stack (Langfuse self-host + promptfoo + DeepEval, MIT/Apache), `edit_diff`→eval capture wired end-to-end **and proven by test** (the db mechanism from B0.3 already writes `eval_cases` — B0.4 consumes them), golden-set seed file. Then the Sprint-0 exit review.

## [you] — founder-supplied, outstanding

Langfuse keys/host (B0.4; scaffold proceeds without them) · `AI_GATEWAY_API_KEY` (first needed B1.1).
