# Thalon

> **Pre-charter scaffolding.** This repository currently holds the bare foundation only — no feature or application code. Nothing is built until the founder charter is approved from inside this repo (see `.context/PROMPTS.md`, gitignored). Do not add feature code before then.

Thalon is a **standalone, generic, multi-tenant content and social-automation engine**:

> **one source in → grounded, compliance-gated content pipeline → Approve-gated publish.**

You give it one input (a URL, a prompt, or a dropped document) plus a tenant profile, and it fans that source out into many platform-native drafts, runs every draft through a configurable grounding-and-compliance gate, and holds the results in an Approve queue. Nothing publishes until a human presses Approve.

## What makes it a product, not a script

- **Multi-tenant from day one.** Brand/voice, grounding sources, and the compliance denylist are **runtime configuration and data supplied by the operator per tenant** — never hard-coded. Adding a tenant is config, not a rewrite. The repo ships with a generic self/demo tenant only.
- **Grounded and compliance-gated by construction.** A shared judge harness checks every draft against a denylist and against the tenant's provided grounding sources before it can enter the Approve queue. An ungated draft never reaches a human.
- **Owned economics.** Own database, own AI-gateway config, own publisher adapters — token-cost only, no per-seat or per-channel tax.
- **Agent-native, Approve-gated.** Built to run end-to-end under one human approval step, designed to scale so the operator's per-item effort falls as it matures.

## Hard constraint (enforced)

This repository must contain **zero references to the two forbidden upstream brand names** — no files, strings, config, dependencies, or wiring — in any git-tracked file. The engine is genuinely generic and needs none of them. The check is `scripts/ci-grep-guard.ps1` (see `CI-GUARD.md`); it must return zero hits over tracked files. Any downstream brand is fed in at runtime as generic tenant data, external to the repo.

## Layout (foundation)

```
.gitignore            # ignores build output, secrets, and the vault pointer (.context/)
README.md             # this file
AGENTS.md             # agent operating protocol for this repo (canonical)
CLAUDE.md             # hardlink/copy of AGENTS.md (Claude Code auto-load convention)
CI-GUARD.md           # documents the brand-cleanliness CI check
scripts/
  ci-grep-guard.ps1   # the brand-cleanliness guard (tracked-files grep; exits non-zero on any hit)
proprietary/
  README.md           # the moat/IP folder (judge harness, prompt chains, fan-out profiles)
.context/             # GITIGNORED — vault pointer + paste-ready build prompts for the founder
```

## Build method

The build follows the portfolio's standard build-bootstrap ritual: orient against the research vault, run a founder interview to lock the charter, then build one dependency-ordered bucket at a time with an approval checkpoint between each. See `.context/PROMPTS.md` (gitignored) for the paste-ready prompts.
