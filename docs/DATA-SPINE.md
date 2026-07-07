# DATA-SPINE — the optimization half's data map (B6.7 readiness audit, 2026-07-08)

> What flows in once the site is live, where it lands, why it stays fast, what feeds
> learning, and the pre-committed triggers for the next scale steps. Audited against the
> shipped schema at the B6.7 deploy-prep session. Companion to `docs/SPINE.md`
> (architecture) and ADR 0007 (deploy). Each safeguard is graded per AGENTS.md rule 8:
> **[executable]** runs in CI/schema · **[config]** tracked settings · **[doc]** this file.

## 1. Inflows and where they land

| Inflow | Cadence / volume | Table(s) | Hot-path safeguards |
|---|---|---|---|
| Trend sweeps (Bluesky live; YouTube = env flip) | 4h cadence, config-capped per driver (`maxSearchesPerSweep` etc.) | `trend_snapshots` (+ `sweeps/<tenant>.json` pointer bundle) | unique `(tenant,item,capturedAt)` — replay appends nothing **[executable]**; per-driver quota budgets **[config]** |
| GSC search analytics (arms at domain-live) | daily; API cap 25k rows/request, ≈50k/day quota | `search_snapshots` | unique `(tenant,source,query,page,capturedAt)` idempotent append **[executable]**; `rowLimit`/`dailyRowQuota` as config, over-quota poll REFUSES **[executable]**; windowed scan read (below) **[executable]** |
| Engagement metrics on ingested sources | per-sweep | `source_metrics` | `(tenant,source)` index **[executable]** |
| Operator edits | human-rate | `edit_diffs` + `eval_cases` (same transaction) | the override→eval-row MECHANISM **[executable]** |
| Intel triage dismissals | human-rate | `eval_cases` origin `intel_dismiss` (landed this session; live cards only — demo dismissals never enter the corpus) | origin check-constraint + audited write **[executable]** |
| Judge verdicts | per-draft | `judge_results` bound to `bodyHash` | I1: queued requires a passing final verdict for the CURRENT body **[executable]** |
| Every state transition | per-action | `events` (append-only, `seq` total order) | I4 audit spine; `(tenant,createdAt)` + `(entityType,entityId)` indexes **[executable]** |
| Gateway spend | per-call | `usage_ledger` — ALREADY an aggregate (tenant×day×model), never raw rows | budget hard-stop at the one gateway choke point **[executable]** |

Object-store side: artifacts are content-addressed (immutable once written), read models are
small mutable-pointer JSON bundles (`sweeps/`, `posts/`) — snapshot-safe by construction;
the live PGlite dir is excluded from box snapshots in favour of the dump hook (ADR 0007).

## 2. Why reads stay flat as history grows

- Every operator-facing read is composite-indexed on its access path (audited: content,
  intel, judging, search, ops, web schemas — no unindexed hot path found).
- The grounding index is HNSW pgvector, materialized at ingest, never re-embedded per
  judge call (SPINE §2.7).
- **Horizon scans are windowed** (this session): `runHorizonScan` takes `nowMs` and reads
  only `windowDays` (default 90, per-tenant config) of history through the
  `(tenant,source,capturedAt)` index — bounding both the read AND the rising-impressions
  baseline (a years-stale "earliest snapshot" would make the math meaningless).
  **[executable]** — test-pinned.
- Trend velocity math reads per-item history via the unique-index prefix — bounded by
  item, not by table size.
- Content-addressed caches (`llm_cache`, `retrieval_cache`) make identical work free;
  dossier regeneration caching via `llm_cache` is a recorded follow-up.

## 3. Deliberately NOT built yet — with the triggers that change the answer

These are decisions, not omissions. Building them now would be waste; the trigger says
when that flips:

1. **Rollup / intermediate tables.** All analysis today is deterministic core math over
   indexed, windowed raw snapshots — correct at dogfood volume and transparent (reason
   strings trace to raw rows). **Trigger:** any operator-facing scan/sweep read exceeding
   ~1s at p50, or a source whose windowed history exceeds ~100k rows — then add per-day
   rollups (`(tenant, source, query, day)` aggregates) fed at intake, never at read.
2. **Retention / pruning.** Append-only tables grow unbounded; at dogfood rates
   (config-capped pollers, human-rate eval inflows) that is months of headroom inside a
   4.4MB-dump database. `events` is the I4 audit spine — never casually pruned.
   **Trigger:** dump size crossing ~200MB or the pre-backup hook crossing ~30s — then
   charter a compaction pass (snapshot thinning beyond the horizon window; events
   archived to the object store, never deleted silently).
3. **The real-Postgres swap.** PGlite is single-process embedded — the right shape for
   one long-lived VPS container (ADR 0007), with `DATABASE_URL` as the recorded seam.
   **Trigger:** multi-process workers needing the same DB (render worker writing
   directly), sustained multi-tenant load, or trigger 2 arriving early — the schema/SQL
   is one dialect throughout, so the swap is a driver, not a migration rewrite. Note:
   the seam exists; the postgres driver itself is deliberately unbuilt (B0.5 note).
4. **Scheduled polling.** Sweeps and (at domain-live) GSC intake are operator-triggered
   today. On the box, scheduling = host cron calling the existing token/basic-auth-gated
   endpoints (the dump-hook pattern) — config at deploy, no new code path. **[doc → becomes
   config at staging deploy]**

## 4. GSC arming checklist (at domain-live — nothing before, by design)

The pipeline below the driver is BUILT and test-proven (poll → idempotent append →
windowed deterministic horizon math with reason strings → `search_targets` feed
generation). What remains is exactly the deploy-gated credential surface:

1. Domain live + Search Console property verified (B6.7 launch; [you] one-time).
2. Google OAuth client (`webmasters.readonly`, offline refresh) — console steps land in
   the founder runbook (`.context/runbooks/keys.md`) when wiring starts; the driver takes
   injected `{siteUrl, accessToken}` config and REFUSES to poll unconfigured
   **[executable]**.
3. Cross-poll daily budgeting + the token-refresh loop — the one genuinely new code
   surface; small, and quota-shaped config already caps every poll.
4. Swap `SEARCH_INTEL_SOURCE=gsc` **[config]**; the Search tab's demo feed swaps to the
   stored-scan read at the same moment.
5. First weeks: expect sparse data (GSC lags indexing); the horizon rules already refuse
   to fire below `minImpressions`/`minSnapshots` — no false opportunities on thin data
   **[executable]**.

## 5. The learning loop, end to end (all mechanisms, no habits)

```
publish → GSC/platform signals → snapshots (append-only, idempotent)
       → deterministic scoring with reason strings (ranker / horizon)
       → operator triage: promote (context handoff) | dismiss (→ eval row, intel_dismiss)
       → generation grounded in intel context → judge (two-tier, I3)
       → operator edit (→ edit_diff + eval row, same transaction) | approve
       → publish … and every failure class becomes a golden row + versioned prompt/config
         change (proven this session: the screen-tier rhetoric block → g3-004/g3-005 +
         judge-g3-screen.v2 → the same draft passing) — the ratchet is the mechanism.
```
