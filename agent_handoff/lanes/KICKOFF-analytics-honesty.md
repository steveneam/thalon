# KICKOFF — lane `analytics-honesty` (D2 follow-through: the founder's X ruling + the cheapest real gaps)

**Charter:** the founder's s87 ruling (verbatim below) + the `analytics-spine`
WRAP's own named follow-ups (COORDINATION §s87 lead items 2 and 6, and its
"cheapest real follow-up"). Launch is Mode B in the `thalon` tmux session. You own
`agent/analytics-honesty`, worktree `.claude/worktrees/analytics-honesty`.

**Ships disarmed, zero live calls.** Every platform response in tests is an
injected fake. Nothing you build spends anything, arms anything, or posts anything.

---

## The ruling you are actioning

> **Founder, 2026-07-29 (s87):** *"X analytics and posting bill will only be paid
> once thalon is ready to launch, so towards the end."*

The vocabulary already exists — s87 added `deferred` to `MetricAbsence` and
`SocialMetricsDeferredError` to `metrics/errors.ts`, with the ruling quoted at the
arming point in `capability.ts`. **What does NOT exist yet is the wiring**: nothing
currently *refuses* an X read. Your job is to make the ruling structural.

## What you build

1. **X = deferred, structurally.** A standing-deferral seat in
   `packages/engine/src/social/metrics/` — a code-level constant naming `x` with
   the ruling quoted (lifting it at launch = deleting the entry, a deliberate
   founder-visible diff; it is NOT config, because a tenant toggle would make a
   product-wide cost ruling accidentally liftable). **Deliverable 1, REPORTED
   before building** (one paragraph in your wrap-in-progress, the s87
   seam-decision discipline): where the seat sits — the resolver
   (`drivers/index.ts` / `vaultSocialMetricsResolver`) vs the registry's resolve
   path vs the tick. Constraints your report must satisfy:
   - an **armed** tick over a tenant WITH X publications reads every other
     platform, spends nothing on X, and records the deferral per X publication as
     a typed refusal (`SocialMetricsDeferredError`) — never a silent skip, never a
     fabricated absence;
   - the bill print (`run-metrics-tick.ts`) shows X as deferred-with-the-ruling,
     zero cost, whether `--armed` or not;
   - the read-model surfaces `deferred` as its own absence word with its own
     sentence (it is "we won't yet", not "we can't") — `platformsNotReporting`
     and the per-channel roll-up both carry it.
2. **Facebook comment/share counts** — the spine's named "cheapest real
   follow-up". They are fields on the post OBJECT (`comments.summary(true)` /
   `shares`), not Page Insights metrics — a second GET beside the insights call in
   `drivers/facebook.ts`'s metrics reader. Requirements:
   - new samples under the matrix's existing labels (comments / reposts — check
     `capability.ts`'s `MetricLabel` vocabulary; platform field names ride
     verbatim as provenance);
   - the capability matrix's facebook rows flip from refused to reported, with a
     refreshed `verifiedOn` and the platform's own field names — **verify against
     Meta's live Graph docs and cite the doc in a code comment** (the spine's own
     discipline);
   - the second call failing degrades PER-METRIC (the insights read still lands);
     a partial answer is recorded partially, never zeroed;
   - idempotency unchanged: same tick window, re-run, appends nothing.
3. **The batch read + the single-query read-model** — the spine's flag 3.
   `analyticsReadModel` runs one query per publication (bounded ≤100). Add a batch
   read to `packages/db/src/repos/publication-metrics.ts` (additive method on the
   existing table — contracts and schema stay FROZEN; if you find yourself
   wanting a schema change, STOP and report) and swap the read-model onto it.
   **Report the verb shape in deliverable 1** (latest-per-label across ids ·
   series across ids · both?). Determinism note: `series()` orders
   `(captured_at, metric_label, id)` since `7bcd5b9` — your batch read keeps that
   or states why not.

## File set — DISJOINT, hard boundary

Yours: `packages/engine/src/social/metrics/**` ·
`packages/engine/src/social/drivers/facebook.ts` ·
`packages/engine/src/social/drivers/index.ts` (only if your reported seat lands
there) · `scripts/run-metrics-tick.ts` ·
`packages/db/src/repos/publication-metrics.ts` + its test file
(`packages/db/src/__tests__/s87-window-repos.test.ts` — extend, don't fork) +
your own engine test files. **NOT yours:** contracts, schema, `publish.ts`,
`packages/engine/src/create/**` (a second lane may be live there),
`packages/platform/**` (no env keys — the tick's arm stays a CLI flag until it
earns a timer, per the spine's own wrap). Outside the set = STOP and report.

## Gates, and the box

- `npx vitest run --maxWorkers=2` (assume a second lane is live; unbounded pool
  OOMs the box — measured s82) · **never `pkill -f vitest`** · vitest does NOT
  typecheck — run `npm run typecheck` · done = `npm run verify` green on EXIT
  CODE in your worktree · never `npm install` in a worktree.

## Wrap

`agent_handoff/lanes/WRAP-analytics-honesty.md` (new — you write it): the deferral seat AS BUILT (and
the exact diff that lifts it at launch — name the file and the lines), the
facebook capability rows before/after with doc citations, the batch verb shape +
the read-model's query count before/after, what you deliberately did not build.
Commit on your branch, push, stop. **The lead rebases/merges — you do not.**
