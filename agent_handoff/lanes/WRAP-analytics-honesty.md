# WRAP — lane `analytics-honesty` (IN PROGRESS)

Branch `agent/analytics-honesty`. Ships disarmed, zero live calls — every platform
response in tests is an injected fake.

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

*(to be completed at wrap)*
