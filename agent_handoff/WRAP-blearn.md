# WRAP — lane `blearn` (B-learn wave 1: knobs as area data · durable cap · honest multi-platform trends)

Branch `agent/b-learn`, based on the L0 window freeze (`8da5df2`). Three
feature commits, one per kickoff slice; full `npm run verify` green at the
repo root before this wrap (unfiltered, never piped through tail). Zero
spend, zero live network — every new test runs on fixtures/fakes. No UI
files touched (plan §5 DOCTRINE 0 respected; the web ceiling stayed the
API response shape, additive only).

## Slice 1 — admission knobs are AREA DATA (`2e98dd6`)

- The engine imports `admissionKnobOverridesSchema` from
  `@thalon/contracts` (the L0 window's verbatim adoption) and re-exports
  it from `trend/admission.ts`; the local duplicate is deleted.
- `runAdmissions` resolves knobs per area as **tenant defaults ← the area
  ROW's `config.admission`**, field-by-field
  (`resolveAdmissionKnobs(defaults, override)` — explicit-optional
  semantics unchanged, never `.partial()`). `runTrendIntake` passes each
  active area's `config.admission` through; area rows flow from
  `repos.monitoredAreas.list` exactly as before, so persistence →
  sweep needs no new plumbing.
- **Deprecation executed:** `admissionConfigSchema` is now
  `{ defaults }` ONLY and **strict** — the transitional request-level
  `areas` override map is REMOVED, not stripped. `TREND_ADMISSION_CONFIG`
  stays, carrying tenant defaults only; `envAdmissionConfig` throws a
  targeted migration message on a leftover `"areas"` key ("moved to each
  monitored-area row's config.admission") — fail loud, never
  silently-dropped floors. The soak's current value
  (`{"defaults":{"floors":{"likes":500}}}`) parses unchanged.

## Slice 2 — the UTC-day cap is DURABLE (`bdefa53`)

- `countTodayAdmissions` (the meta-scan) and the in-memory
  `capRemaining--` are DELETED. New content claims a slot through
  `repos.trendAdmissions.claim` **before** the ingest door; the initial
  per-area count reads `countsForDay`. Shape of the flow per candidate:
  knobs gate → G1 → content-hash pre-check → **durable claim** (only when
  the content is new; re-encounters never claim) → the one ingest door.
- Race-proof by construction: claims serialize on the ledger's unique
  (tenant, area, day, slot) index; `capRemaining` derives from the
  claimed slot number (monotonic within the day — honest under races).
  A claim whose ingest fails (e.g. budget refusal) keeps its slot and
  REPLAYS into the same slot next sweep via the (area, day, content_hash)
  key — undershoot, never overshoot, never a double slot.
- **The pin today's code could not pass:** two `runAdmissions` passes
  racing one area (barrier at the content-hash pre-check so both finish
  their day-count read first, cap 1) — exactly one admits, one
  cap-rejects, exemplar pool and ledger agree at 1. The retired code
  admitted both.
- Deploy note (bounded, one-time): the ledger starts empty, so
  admissions already created earlier the SAME UTC day don't count against
  that day's cap once — at most one day's cap of extra admissions on
  cutover day, conservative thereafter.

## Slice 3 — the trends read stops lying by omission (`1acc89a`)

- Every sweep persists its bundle to a **per-source home**
  `sweeps/<tenantId>.<source>.json` (new `sweepSourceBundleKey`) AND the
  legacy per-tenant pointer `sweeps/<tenantId>.json` (kept fresh,
  last-swept-wins — rollback path + the workspace plan's cadence stamp).
  Both live inside the orphan sweep's protected `sweeps/` prefix.
- **Merged read contract (engine):** `readSweepBundles(tenantId)` — every
  per-source bundle, schema-validated, freshest first (sweptAtMs desc,
  then source asc); falls back to the legacy single pointer when no
  per-source home exists (a store last written pre-slice — staging's live
  bundle keeps rendering across the deploy); `[]` before any sweep.
  `mergeSweepCards(bundles)` — score-ordered union across sources
  (deterministic tiebreaks: source asc, id asc), card-id deduped.
- **`/api/intel/trends` (additive only):** `cards` = the merged union
  (each card already carried `source`); `sweep` stamp = the freshest
  sweep + schedule truth, exactly as before; NEW `sources` field =
  per-source sweep stamps `[{ source, lastSweptAt, cards }]` (empty array
  in the demo era). Dismiss/promote lookups (`findLiveTrendCard`) search
  every source's bundle so merged cards stay actionable. No other
  response field changed; zero component/UI edits.
- The s72 interim ("the LAST listed source owns the trends surface",
  `getTrendSources` header) is CLOSED — list order no longer decides what
  the read shows.

## Test deltas

- `admission.test.ts`: config parses to defaults-only; `resolveAdmissionKnobs`
  re-pinned on the new (defaults, override) signature; NEW strict-rejection
  pin for the removed `areas` map.
- `intake-admission.test.ts`: cap + enabled:false overrides migrated onto
  the area row; areas are now created through the repo door (the ledger's
  FK to monitored_areas demands real rows — the production shape); NEW
  racing-sweeps durable-cap pin (the slice-2 headline).
- `sweep-scheduler.test.ts`: NEW leftover-`areas` env loudness pin; NEW
  end-to-end row-knob pin (admission block persisted through
  `monitoredAreas.create` disarms the sweep over the env default);
  multi-source test now proves BOTH sources persist and merge (interim
  pin replaced with the honest contract).
- `sweep.test.ts`: mutable-pointer pin extended to both homes; NEW
  multi-source union test (per-source homes, freshest-first read,
  score-ordered cross-source merge, legacy pointer honest); NEW legacy
  fallback + empty-store pins.
- Net: engine suite 895 passed (was 884), everything else untouched.

## For the lead

- Merge behind a full post-merge `npm run verify` (the standing gate).
- The soak env needs NO change (`TREND_ADMISSION_CONFIG` already
  defaults-only). If any experiment ever set an `areas` map in env, the
  scheduler will fail loudly with the migration message — move the block
  onto the area row via the areas config door.
- Per-area tuning is now durable operator data: PATCH the monitored area
  with `config.admission` (e.g. `{ "floors": { "likes": 500 } }`) — the
  founder's Bluesky opt-in can finally persist per area instead of riding
  every request.
