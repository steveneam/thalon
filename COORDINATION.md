# COORDINATION — lane board

> Parallel-lane ledger (protocol: `docs/SPINE.md` §5). **One writer per row** — the lead owns assignments + merge-order; each owner writes only its own `status`. Messages append-only. Status vocab: `pending · in_progress · blocked:<what> · review · merged`. **Contract** = `packages/contracts` + the drizzle schema — frozen per sprint once committed; a lane needing to edit it mid-flight = re-plan, not an ad-hoc edit. Merges serialize through `main` in merge-order: rebase → CI green (guard + lint + tests) → review → merge; never on red.

## Sprint 0 — proposed lanes (activate on founder go)

| lane | owner | owns (glob) | branch | status | depends-on | merge-order |
|------|-------|-------------|--------|--------|------------|-------------|
| a-core | lead terminal | `packages/**`, `proprietary/**`, `apps/web/**`, `eval/**` (B0.3 → B0.4) | `agent/a/b03-schema` | review | — | 1 |
| b-aws | second terminal (`claude --worktree b05-aws`) | `infra/**` (B0.5) | `worktree-b05-aws` | review | AWS sub-account ([you]) | 2 |

## Messages (append-only)

- 2026-07-03 lead: board created. B0.3→B0.4 vs B0.5 are file-disjoint per the charter; Lane B is inert until the founder opens the second terminal (or we fall back to sequential). Worktree prereqs landed: `.worktreeinclude`, `.claude/settings.json` symlinks `node_modules`, dev DB/store/queue isolate per worktree via the local seams.
- 2026-07-03 lead: B0.3 complete on `agent/a/b03-schema` → at the founder checkpoint (status `review`). Contract (`packages/contracts` + drizzle schema) is now committed — **frozen for the sprint**. Lane B unaffected (`infra/**` untouched).
- 2026-07-03 b-aws: B0.5 credential-free scaffold at review — CDK-Python skeleton (`infra/`), `ThalonGithubOidc` stack (OIDC provider + `thalon-github-deploy` role, assume-cdk-roles-only, main-branch-scoped trust), 7 synth-time tests green, `cdk synth` verified. Blocked on founder one-time steps (sub-account → bootstrap → hand-deploy OIDC stack → set `AWS_DEPLOY_ROLE_ARN`): runbook in `infra/README.md`. For the lead at merge: move `infra/github-workflow/deploy-infra.yml.example` → `.github/workflows/` and add an infra pytest job to CI (both outside this lane's glob). Handoff note: `agent_handoff/CURRENT.md` left untouched — lead-owned during parallel lanes; this message is Lane B's wrap record.
- 2026-07-03 b-aws: AWS side of B0.5 is live — founder supplied the sub-account; `cdk bootstrap` done (ap-southeast-2), `ThalonGithubOidc` deployed by hand (the one-time chicken-and-egg deploy), deployed trust policy read back and verified against the tests, repo variable `AWS_DEPLOY_ROLE_ARN` set. Account id + local access path recorded outside the repo (agent memory / founder), per the never-commit rule. Only remaining B0.5 item: lead activates `deploy-infra.yml.example` at merge — the first green OIDC-assumed run from `main` is the final proof.
