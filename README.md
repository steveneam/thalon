# Thalon

> **Charter approved (2026-07-02) — build in progress.** The dependency-ordered bucket list lives in [`CHARTER.md`](CHARTER.md); the build proceeds one bucket at a time with a founder checkpoint between each.

Thalon is a **standalone, generic, multi-tenant content and social-automation engine**:

> **one source in → grounded, compliance-gated content pipeline → Approve-gated publish.**

You give it one input (a URL, a prompt, or a dropped document) plus a tenant profile, and it fans that source out into many platform-native drafts, runs every draft through a configurable grounding-and-compliance gate, and holds the results in an Approve queue. Nothing publishes until a human presses Approve.

## What makes it a product, not a script

- **Multi-tenant from day one.** Brand/voice, grounding sources, and the compliance denylist are **runtime configuration and data supplied by the operator per tenant** — never hard-coded. Adding a tenant is config, not a rewrite. The repo ships with a generic self/demo tenant only.
- **Grounded and compliance-gated by construction.** A shared judge harness checks every draft against a denylist and against the tenant's provided grounding sources before it can enter the Approve queue. An ungated draft never reaches a human.
- **Owned economics.** Own database, own AI-gateway config, own publisher adapters — token-cost only, no per-seat or per-channel tax.
- **Agent-native, Approve-gated.** Built to run end-to-end under one human approval step, designed to scale so the operator's per-item effort falls as it matures.

## Hard constraint (enforced)

The engine is **genuinely generic**: it needs no upstream product to run, and nothing about a sibling project may become a dependency, import, config default or code path here. Any downstream brand is fed in at runtime as generic **tenant data** — external to the repo, never committed, never hard-coded. (The brand-token grep guard that used to enforce a naming ban was retired on 2026-07-26 by founder call; the genericness invariant above is the part that always mattered and it stands.)

## Quickstart (dev — zero cloud services needed)

```
npm install          # workspace root; installs apps/web
npm run dev          # Next.js dev server (port 3111 — this box's dev lane)
# GET http://localhost:3111/api/health  → status + resolved seams
npm test             # vitest smoke tests
```

Dev runs on local seams: Postgres via `DATABASE_URL` (dev box runs real Postgres; the embedded-PGlite era is over) + a local filesystem object store + inline queue + a dev auth stub. Deploys run the same shapes on VPS-local drivers (tenant Postgres + per-box object volumes); managed-cloud drivers (S3-class stores etc.) are a parked swap path behind the same env seams — see `apps/web/.env.example`.

## Layout

```
CHARTER.md            # the approved build charter (buckets B0.1 → B3.6)
README.md             # this file
AGENTS.md             # agent operating protocol for this repo (canonical)
CLAUDE.md             # hardlink/copy of AGENTS.md (Claude Code auto-load convention)
apps/
  web/                # Next.js (App Router, TS) + shadcn/ui — thin routes + UI only
packages/
  contracts/          # types, Zod schemas, status enums — THE frozen contract
  db/                 # drizzle schema, migrations, tenant-scoped repositories
  platform/           # dev→prod seams: env, embedded-Postgres db client, store, queue, gateway, auth
  engine/             # src/: ingest · fanout · render · leads · outreach · search · trend · direction · edl and friends (core orchestration + quarantined shell/)
tests/                # repo-wide ratchet tests (import boundaries)
scripts/
proprietary/
  judge/              # the moat: shared judge harness (B1.3)
  prompts/            # versioned prompt files (data, never inline strings)
  profiles/           # demo-tenant niche/brand profile data
.github/workflows/    # CI: brand guard (required check) + tests
.context/             # GITIGNORED — vault pointer + paste-ready build prompts for the founder
```

## Build method

The build follows the portfolio's standard build-bootstrap ritual: orient against the research vault, run a founder interview to lock the charter, then build one dependency-ordered bucket at a time with an approval checkpoint between each. See `.context/PROMPTS.md` (gitignored) for the paste-ready prompts.
