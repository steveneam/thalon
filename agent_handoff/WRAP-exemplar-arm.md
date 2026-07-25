# WRAP — lane `exarm` (arm outlier→exemplar auto-admission, s71)

Branch `agent/exemplar-arm`, ready for lead review. `npm run verify` green
(full gate, unfiltered). Zero spend, zero live network in tests.

## What shipped

**The admission loop is ARMED.** `packages/engine/src/trend/admission.ts` —
per-area knobs as config-data, a pure decision gate, and a runner that
admits ranked, area-attributed sweep candidates through the one existing
ingest door (`ingestExemplar`), wired into `runTrendIntake` directly after
the legacy B3.12 door (whose pinned behavior is untouched).

- **Why the pool was empty (root cause, confirmed on live data):** both
  velocity baselines are per-account, and area-swept items arrive one item
  per account (217 accounts / 275 items in dev-pg's last 24 h) — the
  baseline almost never arms, so the old outlier-only gate admitted ~nothing.
  The new loop admits on absolute floors + body length when the baseline is
  unarmed, and binds the Δ-velocity multiple exactly when an account has
  history — which is precisely when it's a high-volume bot whose uniform
  pace should be rejected.
- **Flow per candidate (ranked order, best first — cap slots are scarce):**
  knobs gate (pure) → G1 denylist → content-hash pre-check (never admit the
  same text twice; re-encounters append fresh metrics, no cap slot, no
  embed spend) → UTC-day cap (counted from `meta.trend.capturedAtMs`, the
  argument clock — replayable, no DB-clock dependence) → the door.
  Provenance: `meta.origin = "auto-admission:<areaId>"`, full
  `meta.trend` payload with the human-readable admission reasons.
- **Budget honesty:** every new admission embeds through the metered
  `embedChunks` choke point; a `BudgetExceededError` is recorded VERBATIM in
  `admissions.budgetRefusals` and halts the pass — the sweep itself
  completes (proved by test). Marginal embed cost is usually ~0: ranking
  already embedded each item text, so ≤500-word bodies are cache hits at
  the door.
- **Surfaces:** `TrendIntakeResult.admissions` (admitted / reEncountered /
  per-area why-count summaries / budgetRefusals), scheduler `swept[]` rows
  gain `admitted`, Sweep-now route returns `admitted` +
  `admissionBudgetRefusals`.
- **Tests:** 20 new (8 pure + 12 intake-level assertions across 9 db tests):
  floors/velocity/body/cap thresholds with scripted sweep fixtures, dedup +
  re-encounter, cap persistence across sweeps + next-UTC-day reset,
  budget-refusal tolerance, denylist screen, disabled-area watch mode,
  no-areas empty shape. Plus the 4 scheduler pins extended for `admitted`.

## Knob defaults chosen (and why)

| Knob | Default | Why |
|---|---|---|
| `enabled` | `true` | Arming IS the mission; the thresholds below are the conservatism. |
| `floors` | `{ views: 10000 }` | Fails CLOSED on a platform that doesn't report the metric — so Bluesky's news-bot area feeds admit **nothing** by default (s68 coverage honesty); YouTube (views/likes/comments) qualifies at a real bar. |
| `velocityMultiple` | `4` | Stricter than the discovery lens's 3×: discovery shows a card, admission writes the generation pool. Binds only when the stored account baseline arms. |
| `minBodyLength` | `140` | Kills bare headlines and title-only entries (~60–90 chars); keeps YouTube title+description bodies. |
| `maxAdmissionsPerDay` | `20` per area | The kickoff's budget rail. Worst case with today's 1–2 areas ≈ 40 admissions ≈ ≤40 k embed tokens/day — 2 % of the 2 M budget, and mostly cache-hits anyway. |

Per-area overrides ride `admissionConfig.areas[<areaId>]` on the sweep
request (engine runtime config, the outlierConfig/rankerConfig channel),
resolved field-by-field over the tenant defaults — the explicit-overrides
schema, NOT `.partial()` (which back-fills schema defaults and clobbers;
caught by test, the exact trap contracts' rankerWeightOverridesSchema
documents).

## Contract-window ask (the stopped slice)

Persisting the knobs ON the monitored-area row is blocked exactly as the
kickoff anticipated: `monitoredAreaConfigSchema` (packages/contracts,
FROZEN) is parsed at the repo's single write door, and a plain zod object
**strips unknown keys** — an `admission` block cannot reach the jsonb
column through any operator path. **Window request:** add
`admission: admissionKnobOverridesSchema.optional()` to
`monitoredAreaConfigSchema` (adopt the engine schema verbatim — it was
shaped for this), then have the sweep read per-area overrides from the row
config and deprecate the request-level `areas` map. This is the same L0
window B-learn's charter already names ("exemplar-admission config: the
outlier knobs as area-config data"). Until then, production runs the
tenant defaults above; per-area tuning is possible today only via sweep
request config.

Also window-adjacent (flag, not blocker): the UTC-day cap is read-then-
write in memory — two sweeps racing one tenant could overshoot by one
sweep's worth. Scheduler is serial per tenant today; a durable constraint
belongs to the window's admission tables.

## The first real sweep's admission count

**0 under the shipped defaults — and that is the honest, designed result.**
The live soak is currently Bluesky-only (2,652 snapshots / 275 items in the
last 24 h, ZERO YouTube rows — the youtube driver isn't feeding the soak
env), and Bluesky reports likes/reposts/replies/quotes, no views → the
views floor fails closed on every item. Verified by read-only replay of the
real 24 h dev-pg data through the shipped gates (scratchpad script, zero
writes).

The same replay calibrates the founder's two unlock options:

1. **Arm YouTube in the soak env** (`YOUTUBE_API_KEY` / vault intel row) —
   admissions start with NO config change; views ≥ 10 k is a real bar there.
2. **Opt Bluesky in deliberately** with a likes-based override for the one
   active area ("Frontier AI models"): on the last 24 h of real data,
   `floors: { likes: 500 }` → ~16 candidates/day (inside the 20 cap);
   `{ likes: 300 }` → ~26 (cap binds); `{ likes: 1000 }` → ~5. Body-length
   140 then cuts headline-only posts further. Recommendation if wanted now:
   `{ likes: 500 }` via sweep-request config, revisit after the window
   lands per-area persistence.

Replay also confirmed: the Δ-baseline arms on almost nothing in this feed
(plateaued posts → account baseline 0), so floors + body length are the
working screens on Bluesky — the velocity gate's teeth are for genuinely
active accounts, as designed.

## Files touched

- `packages/engine/src/trend/admission.ts` (new) + exports in `trend/index.ts`
- `packages/engine/src/trend/intake.ts` — admission pass after the legacy
  door; `rankSweep` now also returns its longitudinal scores (same math,
  no second history read); `admissionConfig` on the request
- `packages/engine/src/trend/sweep.ts` — `admissionConfig` passthrough
- `packages/engine/src/trend/sweep-scheduler.ts` — `swept[].admitted`
- `apps/web/src/app/api/intel/sweep/route.ts` — `admitted`,
  `admissionBudgetRefusals` in the response
- `packages/engine/src/trend/__tests__/admission.test.ts` (new),
  `__tests__/intake-admission.test.ts` (new),
  `__tests__/sweep-scheduler.test.ts` (4 pins extended)

## Out of scope, untouched

B-learn L2–L5 (acquisition breadth, own-post pull-back, attribution/bandit,
golden anchoring) stay UNCHARTERED — nothing scaffolded. The operator drop
door (s68 item (c)) already exists via the ingest CLI pattern. No publish
paths, no contracts edits, no db schema changes.
