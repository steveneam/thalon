# WRAP — lane `analytics-honesty`

Branch `agent/analytics-honesty`. Ships disarmed, zero live calls — every platform
response in tests is an injected fake. The lead rebases/merges — this lane
committed and pushed only.

## Deliverable 1 — the seam decisions, reported before building

**The deferral seat sits in the registry's resolve path**
(`resolveSocialMetricsReader`, `packages/engine/src/social/metrics/registry.ts`),
reading a standing-deferral constant in a new dedicated module
`packages/engine/src/social/metrics/deferral.ts`. The resolve path is the metrics
ratchet — the one choke point every production resolution already walks
(`run-metrics-tick.ts` → `vaultSocialMetricsResolver` →
`productionSocialMetricsResolver` → `resolveSocialMetricsReader`), and the place
refusal policy already lives: the gated check refuses there BEFORE the credential
is consulted, and the deferral check sits before even that, because a standing
founder ruling on cost beats every other fact and its refusal must name the
ruling, not a missing credential. The alternatives both leak: a seat in the tick
covers only the collection path (a future direct resolution — a backfill, a
one-post probe — would silently bypass the ruling), and a seat in
`drivers/index.ts` is assembly rather than policy and misses direct ratchet use.
The constant is its own module rather than a `capability.ts` row because the
matrix holds doc-verified platform facts and `errors.ts` already states the
doctrine — deferral is "not a capability fact about the platform at all"; a
dedicated file also makes the launch lift maximally visible: **lifting = deleting
the `x` entry from `STANDING_METRICS_DEFERRALS` in `deferral.ts`**, a small
founder-visible diff in a file that exists for exactly that, and never config.
The three constraints then fall out: (a) an armed tick resolves X to a refusing
reader carrying `SocialMetricsDeferredError`, which the tick throws WITHOUT a
network call and records per X publication in `result.refused` with permanence
`deferred` — every other platform reads normally, nothing is spent on X, nothing
is skipped silently; (b) `tick.ts` gains a `deferred` array beside `metered`
(platform + the ruling verbatim), computed from the same in-window platform
sweep armed or not, and a platform under standing deferral moves OUT of
`metered` — "this pass will bill" would be false, the founder already decided —
so `run-metrics-tick.ts` prints X as deferred-with-the-ruling, zero cost, in
both modes; (c) the read-model's cells check the standing deferral before
emitting `not_collected`, so an X publication with no rows reads
`absence: "deferred"` with the ruling sentence ("we won't yet", never "the tick
has not measured it yet", which invites the accidental armed pass), and the
permanence flows untouched through `platformsNotReporting` and the per-channel
roll-up; historical rows, if any exist, still render as numbers with their
as-of — deferral explains new absence, it does not erase measurements.

**The batch verb shape is series-across-ids only**:
`seriesForPublications(ctx, publicationIds)` on
`packages/db/src/repos/publication-metrics.ts`, returning
`Record<publicationId, PublicationMetric[]>` — additive method, contracts and
schema untouched. Not latest-per-label-across-ids, and not both: the
read-model's one consumer uses `series()` precisely because an ascending series
answers both questions at once (last write per label IS the newest; the whole
series IS the sparkline), so a batch latest verb would ship with zero consumers
on a frozen-window repo. Determinism: the SQL orders
`(publication_id, captured_at, metric_label, id)` — the leading `publication_id`
only does the grouping, and within each publication the `7bcd5b9` order
`(captured_at, metric_label, id)` is preserved byte-identically to what
`series()` returns for that id. Empty ids returns `{}` without touching the db
(the drizzle `inArray([])` trap). The read-model swaps onto one batch call
covering both windows' publications at once: query count goes from
`1 listRecent + N series` (N ≤ 100, current + previous rows) to
`1 listRecent + 1 batch`.

## As built

### 1 · The X deferral, structural

Built exactly as reported. The seat:

- **`packages/engine/src/social/metrics/deferral.ts` (new)** —
  `STANDING_METRICS_DEFERRALS`, one `x` entry carrying the s87 ruling verbatim.
- **`metrics/registry.ts`** — `resolveSocialMetricsReader` consults the map
  FIRST (before the capability row, before the credential) and returns a
  refusing reader carrying `SocialMetricsDeferredError`; the refusal names the
  ruling, never a credential.
- **`metrics/tick.ts`** — the result gains `deferred: [{platform, ruling}]`,
  computed armed or not; a deferred platform reports there INSTEAD of
  `metered` (the founder already made the metered call). The armed loop needed
  no change: the refusing reader throws before any call, so each X publication
  lands in `refused` with `refusal: "deferred_on_cost"`,
  `permanence: "deferred"` — typed, per-publication, never a silent skip, and
  every other platform reads normally.
- **`scripts/run-metrics-tick.ts`** — prints
  `⏸ x: $0 this pass — <ruling>` in both modes (`💸` is reserved for
  platforms that will actually bill).
- **`metrics/read-model.ts`** — both cells check the deferral before emitting
  `not_collected`: an X publication with no rows reads `absence: "deferred"`
  with the ruling sentence, and the permanence flows untouched into
  `platformsNotReporting` and the per-channel roll-up. A historical row still
  renders as a number with its as-of — deferral explains new absence, erases
  nothing.
- Stale `ABSENCE_DEFERRED` pointer in `capability.ts` (a s87 forward reference
  that was never built) now points at the real seat.
  `SocialMetricsDeferredError` + the deferral module are exported from the
  metrics barrel (they weren't exported at all before).

**The exact diff that lifts it at launch:** delete the `x` entry —
`packages/engine/src/social/metrics/deferral.ts` lines 26–35 (the doc comment
plus the `x:` value; the map goes empty, the file and its shape stay). The
tests that pin the ruling then fail BY NAME and are part of the lift diff:
`metrics/__tests__/deferral.test.ts` (whole file pins the entry and the
ratchet refusal), `tick.test.ts` "prices the pass BEFORE it runs…" and "an
ARMED pass through the REAL ratchet…", `read-model.test.ts` the three
"deferred" tests. Lifting also puts X back in `metered` automatically — that
branch is dormant, not dead.

### 2 · Facebook comment/share counts

`drivers/facebook.ts`: a second GET on the post OBJECT beside the insights
call — `GET /{post-id}?fields=comments.summary(true),shares` — because the
counts are object fields, not Page Insights metrics. Verified against Meta's
live Graph docs 2026-08-01 and cited in the reader's docblock and the matrix
row: developers.facebook.com/docs/graph-api/reference/pagepost/ (`shares`,
"Number of times the post has been shared", struct with `count`) and
…/graph-api/reference/object/comments (`summary` → `total_count`; counts
top-level under the default filter, replies join only under `filter=stream`,
not asked for).

Capability rows, before → after:

| label | before | after |
|---|---|---|
| comments | refused `no_driver` ("a second call this lane did not build") | reported, `comments.summary.total_count` |
| shares | refused `no_driver` (same sentence) | reported, `shares.count` |

`verifiedOn` on the facebook row: `2026-07-29` → `2026-08-01` (only the row
re-verified moves). Degradation is PER-METRIC: the object read failing (500,
shape change, scope oddity) costs exactly the two object metrics, the
insights samples still land, nothing is zeroed. Graph omits `shares` on an
unshared post — the absent struct yields no row (a stated
`total_count: 0` IS a row worth 0). Idempotency untouched: samples flow
through the same `append` with the same
`(tenant, publication, label, captured_at)` key; the existing same-bucket
replay test covers the new labels label-generically.

### 3 · The batch read

`packages/db/src/repos/publication-metrics.ts` gains
`seriesForPublications(ctx, publicationIds)` →
`Record<publicationId, PublicationMetric[]>` — additive method, contracts and
schema untouched (no schema change was needed; nothing tempted one). Verb
shape as reported: **series-across-ids only**, no batch latest-per-label
(zero consumers — ascending series answers both questions). Ordering:
`(publication_id, captured_at, metric_label, id)` — the leading key only
groups; per publication the `7bcd5b9` order is preserved, pinned by a test
asserting each batch group `toEqual` its `series()` answer. Empty ids → `{}`
without touching the db; a publication with no rows has NO key (absence stays
absence). Tenant-walled, pinned.

`metrics/read-model.ts` swapped onto one batch call covering BOTH windows;
`postRow` became pure over pre-fetched rows. **Query count per page: was
`1 listRecent + N series` (N = current + previous publications, ≤100);
now `1 listRecent + 1 batch` — 2 total.** Pinned by a counting-proxy test
(`series: 0, batch: 1`).

### Deliberately not built

- **No X read path lift, no arming, no timer.** The tick's arm stays a CLI
  flag; nothing was wired to systemd; no env key was added
  (`packages/platform` untouched).
- **No tick-level second enforcement of the deferral.** The seat is the
  ratchet, once — a tick-side duplicate would let tests never exercise the
  real path and would be a second home for one lesson.
- **No `deferred` rows in the capability matrix.** Deferral is a founder
  decision, not a doc-verified platform fact; the matrix's X row still states
  the full built capability (which is exactly what makes `deferred` honest).
- **No batch latest-per-label verb** (no consumer), and no repo-side
  window filtering on the batch read (the read-model already holds the page
  and filters by window; a second filter would be a second truth).
- **X organic/non-public metrics** stay unread (the 30-day-vanishing series,
  the spine's own v1 exclusion — unchanged).

## Gates

`npx vitest run --maxWorkers=2`: 346 files passed, 4 skipped · 3091 tests
passed, 9 skipped. `npm run typecheck` clean. `npm run verify` green on exit
code (run with `VITEST_MAX_FORKS=2 VITEST_MAX_THREADS=2` so the merge gate's
own vitest stays inside the box's two-lane budget).
