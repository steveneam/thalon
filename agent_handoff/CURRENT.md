# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-04 (session 4) · **Sprint-1 exit signed off · amendment A5 landed · B2.1 merged (PR #11) — Sprint 2 underway**

## Pointer

Read in order: `CLAUDE.md` → `CHARTER.md` (Sprint-2 table + amendment A5) → `docs/adr/0002-sprint2-expansion.md` → `COORDINATION.md` (Sprint-2 planned lanes + the two 2026-07-04 messages).

## Delta (this session)

- **Sprint-1 exit review signed off by the founder** (operational-mirror criterion confirmed). Founder directive: stop flagging optional [you] items (gateway top-up, Langfuse) until a bucket blocks on one.
- **Amendment A5 approved + landed** (`d38a056`): Sprint 2 expands to B2.1–B2.6 (timed ingest + single contract window · waterfall clip plans · exemplar library · demo-plan slice · queue UI), B3.7 visual-ingest sidecar added, trend radar folded into B3.5, transcript capability built in-house (self-hosted Whisper strategic; hosted APIs optional adapters), ToS-evading scrapers rejected. Design rationale in the ADR.
- **B2.1 merged (PR #11, rebase-merge)**: prep commit made tenant-as-data possible (dogfood JSON input file + `DEMO_TENANT_SLUG` env + shipped-tenant validation ratchet); proof commit added fictional tenant #2 (`proprietary/profiles/tenants/fernwood.v1.json`) with **zero code changes** — exit criterion met literally. Live slice: x queued, linkedin blocked on a genuine g3 tier disagreement (I3 on a second tenant); replay idempotent.

## Next action

**Session start: B2.2 — timed ingest + the sprint's single contract window** (lead, solo; scope pinned in `CHARTER.md` B2.2 row + ADR 0002 §1). After B2.2 merges and the contract re-freezes, cut wave-1 lanes (waterfall + exemplar) per the Sprint-2 board — **lane launch needs fresh founder go**. Real triage items sit in two queues: tenant #0 (`npm run dev` → /approve) and tenant #2 (`DEMO_TENANT_SLUG=fernwood npm run dev` → /approve).

## [you] — founder-supplied, needed as buckets start (not before)

- B2.3 dogfood: your first pillar video (own long-form video + its caption/SRT file, or URL).
- B2.5 dogfood: your website URL + which flows to demo.
