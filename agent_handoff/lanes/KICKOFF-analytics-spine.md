# KICKOFF — lane `analytics-spine` (D2: own-post analytics, the spine)

**Charter: `docs/research/distribution-charter.md` §D2 — "the founder's named ask".**
Launch is Mode B in the `thalon` tmux session. You own `agent/analytics-spine`,
worktree `.claude/worktrees/analytics-spine`.

**Ships disarmed, zero live calls.** Every platform response in tests is an injected
fake. The tick you build is NOT scheduled onto the sweeper unit — wiring the real
schedule is a lead/founder act after merge.

---

## What you build

The engine spine that turns `social_publications` rows into `publication_metrics`
time series, honestly per platform. The **contract window lands FIRST at the boot,
by the lead** (`publication_metrics`: publication id + platform + metric label +
value + captured_at, append-only) — build on the frozen window.

1. **The per-platform metrics verb.** Ground truth: there is NO analytics verb today.
   The publisher seam is `packages/engine/src/social/registry.ts`
   (`SocialPublisher`, per-platform drivers in `social/drivers/`); the credential/
   connect seam is `packages/engine/src/integrations/` (vault, validate). **Your
   first deliverable is a REPORTED seam decision, before building**: where
   `fetchPostMetrics` lives (optional verb on the publisher, like
   `needsPublicMediaUrl`'s opt-in pattern, vs a parallel connector verb) — one
   paragraph in your wrap-in-progress, then build it. The ig-post lane's checkpoint
   discipline is the precedent.
2. **Per-platform honesty, from the platform docs** (verify against live docs, cite
   in code comments): Bluesky AppView returns likes/reposts/replies (no impressions);
   Meta insights need their metrics permissions — if the current token lacks them,
   the driver REFUSES with the platform's words, never fabricates; LinkedIn is
   partner-gated — say so in the typed refusal. **A platform that cannot report a
   metric yields NO row for it** — absence, never 0 (the Analytics sheet's honesty
   rules are built on this).
3. **The tick.** `collectPublicationMetrics(deps)`: for each social_publication of
   the tenant, call the verb, append rows. Idempotent per (publication, label,
   captured-at window); failures recorded per publication, never aborting the batch.
   Callable as a script (`scripts/` runner pattern like `run-publish-queue.ts
   --once`) — NOT added to any systemd unit.
4. **Repos** for `publication_metrics` (append + read series + latest-per-label),
   tenancy on every query, tests.
5. **Read-model for the surface** (engine-side only): the per-post + per-channel
   aggregation the Analytics sheet's tiles/table need, with as-of stamps. No UI.

## File set — DISJOINT, hard boundary

Yours: `packages/engine/src/social/**` (the verb + tick; do NOT touch `publish.ts`'s
admission seam beyond adding your optional verb where you reported),
`packages/engine/src/integrations/**` (only if your reported seam decision lands
there), `packages/db/src/repos/publication-metrics*` + schema-adjacent test files,
`scripts/run-metrics-tick.ts`. The `create-engine` lane owns
`packages/engine/src/create/**` — touch nothing there. Contracts frozen — consume,
never edit. Outside the set = STOP and report.

## Gates, and the box

- `npx vitest run --maxWorkers=2` · never `pkill -f vitest` · `npm run typecheck` ·
  done = `npm run verify` green on EXIT CODE in your worktree · never `npm install`
  in a worktree.

## Wrap

`agent_handoff/lanes/WRAP-analytics-spine.md`: the seam decision + why, the
per-platform capability table AS BUILT (metric × platform × available/refused-with-
reason), what the Analytics surface can now show honestly vs what stays "not
measured", what you deliberately did not build. Commit, push, stop. **The lead
merges — you do not.**

---

## THE WINDOW AS FROZEN (s87 lead, merge `ff55f0f`) — read before you plan

`publication_metrics` is **on main and frozen**. Consume it; never edit it.

**`repos.publicationMetrics`** (`packages/db/src/repos/publication-metrics.ts`):
- `append(ctx, {publicationId, metricLabel, metricValue, capturedAt})` →
  `{row, created}`. **There is deliberately NO `platform` parameter**: the
  repo reads it off the referenced publication under your tenant. That is
  what keeps the denormalization honest (a metric can never claim a platform
  its publication did not post to) and what walls the tenancy — a foreign or
  unknown publication id throws `NotFoundError` rather than writing. Do not
  try to pass one; do not add one.
- **Idempotent on `(tenant, publication, metric_label, captured_at)`.** A tick
  re-run inside the same window appends nothing and reports `created: false`.
  Bucket your `capturedAt` deterministically — pass the clock in, never read
  it in core — or you will write a new point on every tick.
- Reads: `series(ctx, pubId, {metricLabel?})` (oldest first),
  `latestPerLabel(ctx, pubId)`, `listForPlatform(ctx, platform, since)`.
- **Metric appends emit NO events, by design** (the `source_metrics`
  precedent — a measurement is not a state change the operator
  reconstructs). Pinned by a test; do not add emissions.

**The honesty rule is structural, and your drivers must hold it up:** there
is no nullable `metric_value` and no "unavailable" flag. **A platform that
cannot report a metric yields NO ROW for it** — absence is the entire way the
Analytics surface says "not measured". Never append a 0 to mean "we could not
ask"; that is the one lie this table could tell, and the schema is shaped so
it stays unrepresentable. Your per-platform capability table in the wrap is
what tells the surface which absences are permanent vs. permissioned.

`platform` values are constrained to `SOCIAL_PLATFORMS` by a check
constraint — there is no `youtube` key (no capability row, no driver).

**Not yours in this window:** `create_runs` and everything in
`packages/contracts/src/create-run.ts` belong to the `create-engine` lane.
