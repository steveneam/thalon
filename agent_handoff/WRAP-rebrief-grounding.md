# WRAP — lane `rebrief-grounding` (the 491089d0 ratchet, executed)

Branch `agent/rebrief-grounding`. Engine + tests only — contracts, db, judge
internals, prompt files all untouched, as chartered.

## The located seam(s)

The re-brief append had **no single owner and no guard** — three brief-fed
entry points each inlined the same grounding block (dedupe+sort request ids →
validate existence → stamp `meta.groundingSourceIds = [promptSource.id,
...groundingIds]`), and **none of them stripped a prompt-kind source (a prior
brief) from the requested set**:

- `packages/engine/src/origination/origination.ts` (pillar script)
- `packages/engine/src/pipeline/staged-video.ts` `startVideoStages` (staged
  chain stage 0 — later stages carry the stage-0 set forward verbatim, so the
  whole chain inherits whatever stage 0 admits)
- `packages/engine/src/webpage/webpage.ts` (web page; `page-loop.ts` passes
  through to it)

The incident's mechanism: the natural re-brief flow carries the prior draft's
`meta.groundingSourceIds` forward as the new request's grounding — and that
set has the OLD brief at its head. The new run then stamps
`[newBrief, oldBrief, ...]`: two near-identical instruction texts in the
judged context (the judge's `collectGroundingChunks` dedupes exact ids only).
Non-seams, checked and clear: `advanceVideoStage` (verbatim carry-forward,
single owner already), fanout (no `groundingSourceIds` at creation),
`outreach/compose` (fixed single brief), the web edit/rejudge paths
(body-only), `drafts.updateMeta` (no tracked caller touches grounding).

## The shape of the fix: owner-of-merge (structural), not per-caller

**New module `packages/engine/src/pipeline/grounding-set.ts`** — the one
owner of the request→grounding merge, called by all three entry points:

- `resolveGroundingSet(ctx, repos, requestedIds)`: dedupe + sort + existence
  validation (error message byte-identical to before), then **REPLACE
  semantics — every prompt-kind id in the requested set is a prior brief and
  is dropped; the current brief is the only brief a draft ever grounds
  against.** The duplicate-brief state is now unrepresentable from every
  caller at once. (Also covers the echo edge: the current brief's own id in
  the request no longer duplicates it in meta.)
- `groundingRunParams(resolved)`: the run-params provenance fragment —
  replacement is never silent; the run records `replacedBriefSourceIds`
  beside `groundingSourceIds`.

## Behavior deltas (all pinned as correct)

- **Generation keys**: the RESOLVED set feeds the key material, so a
  stale-carry re-brief request (`[oldBrief, docs...]`) and a clean request
  (`[docs...]`) resolve to the SAME run — idempotency by effective inputs.
  Vs the old buggy shape, a request carrying a prior brief now produces a
  DIFFERENT (correct) key; key-material shape/bytes are otherwise unchanged
  (`key-stability.test.ts` untouched and green).
- **Run params**: gain `replacedBriefSourceIds` only when a replacement
  happened; absent otherwise (params shape byte-identical for clean runs).
- **Meta**: `groundingSourceIds` = exactly `[currentBrief, ...nonBriefIds]`.
  No caller-visible API change; the three request interfaces document the
  replace contract.

## Tests

`packages/engine/src/__tests__/rebrief-grounding.test.ts` — written failing
first against the real append behavior (4/4 red), green after the fix:

1. `origination: a re-brief carrying the prior draft's grounding set forward
   REPLACES the old brief — meta, judge context, run key, and replay all see
   exactly one brief` (drives the incident's exact brief→re-brief cycle;
   asserts one brief chunk in `collectGroundingChunks` output, the pinned
   run-key bytes over the replaced set, the `replacedBriefSourceIds`
   provenance, and zero-shell-call replay)
2. `startVideoStages: the staged chain's stage-0 grounding set gets the same
   replacement`
3. `runWebPageGeneration: the same replacement at the web-page brief door`
4. `the current brief's own id echoed back in the requested grounding set
   never duplicates it`

Engine suite: 883 passed / 7 skipped (nothing pre-existing broke). Full
`npm run verify` (unfiltered) in-worktree: **exit 0 — 278 test files / 1873
tests passed (9 skipped), typecheck clean, lint 0 errors** (16 pre-existing
apps/web warnings, untouched surfaces), guard green.

## Ratchet grade

Executable (regression test over the real code path) + structural (one owner
of the merge, prompt-kind stripped by type of source, unrepresentable from
any caller). Tag: **invariant** (grounding/judge-context safety — never
loosened). The s69 ROADMAP "ratchet candidate" line can be closed as
EXECUTED on merge; belt-and-braces judge-time near-dup chunk dedup (also
named there) remains open and is judge-internal — out of this lane's scope.

## For the LEAD

- Merge on green post-merge verify (verify-on-main IS the gate).
- `agent_handoff/ROADMAP.md` line ~288 (ratchet candidate) → mark executed,
  pointing at `pipeline/grounding-set.ts` + the test above (lead edit at
  merge, kept out of the lane to avoid handoff-file collisions).
