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
