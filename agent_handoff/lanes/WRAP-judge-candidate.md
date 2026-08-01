# WRAP — lane `judge-candidate` (the R8 deviation CLOSED: a candidate body is judged before it lands)

Branch `agent/judge-candidate`, worktree `.claude/worktrees/judge-candidate`.
Charter: `docs/create-engine/spec.md` (APPROVED) §Error Behavior, closing the
s88 deviation recorded there; derivation inherited from
`WRAP-create-shells.md` §1b/§5. The spec's clause — *"AI-edit judge rejection:
the variant keeps its prior body; the refusal shows at the control"* — is now
met exactly, and **the deviation block is deleted from the spec** (§4 below).

Ships behaviour-preserving for every existing caller of `runJudgePipeline`
(dispatch, staged-video, approve-queue runner, eval dogfood — signature and
behaviour untouched, every pre-existing judge test green without edits). No
publish-path change, no UI, no routes. New spend on the default path: exactly
one candidate judge (screen + final) per AI edit, metered under its own label.

---

## 1. How the ladder ended up SHARED — and what had to move to share it

The kickoff named the risk precisely: a copied gate ladder drifts, and a
drifted judge is a safety divergence no test announces. So the extraction went
further than the minimum, because grounding and metering drift the same way
gate order does. **`proprietary/judge/src/gate-ladder.ts` (new)** now holds
three shared pieces; `pipeline.ts` shrank from 280 lines to a ~100-line
persist-and-transition wrapper:

1. **`runGateLadder`** — the pure core, the kickoff's shape: `{body,
   platform, format, meta, denylist, chunks, cadence?, drivers, onGate}` →
   `{verdict, reason?}`. It **never touches `repos`**. Everything decision-
   bearing moved VERBATIM: g1 → cadence (armed-by-data) → advisory seo lens →
   advisory discoverability lens → both g3 tiers always → the exact reason
   strings (`"g1 denylist fail"`, `` `cadence limit for "<platform>"` ``,
   `"both g3 tiers failed"`, `` `g3 tier disagreement (screen=…, final=…)` ``).
   Each rung emits through an **`onGate` callback at exactly the moment the
   old pipeline appended** — so the pipeline's partial-record behaviour on a
   mid-ladder budget halt is byte-identical (g1 row present, draft left at
   `judging`), and a candidate judge merely collects.
2. **`assembleLadderEvidence`** — the ONE evidence assembly (reads only):
   active-profile denylist, `collectGroundingChunks` (with the pipeline's
   `chunks` override semantics), the B3.8 identity append, and the cadence
   arming check. **Grounding parity is decided here, structurally** — the
   candidate path cannot be judged against different evidence than the
   landing judge because there is no second assembly to drift. Cadence
   admissions are fetched through a lazy closure so a g1 refusal still costs
   zero reads, exactly the old order of operations.
3. **`meteredTierDriver`** — the ONE metering shim: every tier attempt from
   either entry point routes through `withGatewayGuard` (budget asserted
   before, usage recorded after; SPINE §1, A2). Shared deliberately: a copied
   meter is how candidate spend would drift from pipeline spend.

**`judgeCandidate(repos, {ctx, draft, candidateBody, drivers…})`**
(`proprietary/judge/src/candidate.ts`, new) runs the same assembly + the same
ladder over the candidate body and the draft's own platform/format/meta. It
**appends no `judge_results` row, transitions nothing, and never writes the
draft** — a verdict about text not on the draft has no honest `body_hash` to
bind to. Its return type is `CandidateOutcome` with a **literal
`ofRecord: false`** and no `draft`/`status` fields, so it is structurally
impossible to confuse with `PipelineOutcome` at a call site; `gates` carries
each rung's evidence for operator-facing refusal detail, in the return value
and nowhere else.

### 1a. One interpretation call, said rather than substituted

The kickoff's "writes nothing" I read as *nothing about the draft or the
verdict record*. The candidate's two tier calls ARE still metered through the
usage ledger (a write), under their own labels `judge.candidate.g3_screen` /
`judge.candidate.g3_final`. An unmetered model call would be a tenant-budget
bypass — its own safety hole, and the kickoff's own "no new spend beyond one
candidate judge per AI edit" only means anything if that spend is counted.
Pinned by test: a `capTokens: 0` tenant gets `BudgetExceededError` before any
candidate model call. If the lead wants the metering out, it is one argument
at two call sites — but I would argue against it.

## 2. Proof the existing pipeline tests are untouched

`git diff --stat` for `proprietary/judge/src/__tests__/`: **only
`candidate.test.ts` (new) appears.** `pipeline.test.ts`,
`identity-grounding.test.ts`, `cadence.test.ts`, `grounding.test.ts` and the
rest are byte-identical to `main` and green — 70 pre-existing judge tests
passed before the candidate entry was even written (run recorded mid-lane),
79 after. No existing expectation was edited anywhere in the lane; the only
pre-existing test FILES touched are `edit.test.ts` (whose propose-half deps
had to grow the judge drivers — §3) and the shell-inventory ratchet (§5).

## 3. The candidate path as TEST-PINNED

**Grounding parity** (`candidate.test.ts`): capturing drivers run
`judgeCandidate` and `runJudgePipeline` over the SAME draft (identity-carrying
profile) and assert the tier requests carry **byte-equal chunk lists**
(`["c1", "profile:v1:identity"]`) — same sources, same identity append, same
order — while the bodies differ: the candidate path's requests carry the
candidate body, the pipeline's the persisted one. Also pinned: the candidate
judge writes no row / makes no transition on every outcome; g1 fires on the
CANDIDATE body in both directions (dirty draft + clean candidate ⇒ pass,
clean draft + dirty candidate ⇒ `"g1 denylist fail"` with zero model calls);
the cadence gate applies with the same rule and admissions as a landing
judge; advisory lenses ride in `gates` and decide nothing; reasons are
VERBATIM the pipeline's; both tier calls metered; budget hard-stop before any
call.

**Refusal semantics** (`edit.test.ts`): the unconditional `bodyHashUnchanged`
tripwire **stays unconditional and runs on every `aiEditDraft` path,
including the new judge-refusal path (d)**. New pins: a judge-refused rewrite
returns `refused` with the judge's reason verbatim inside the operator-facing
sentence; it lands NOTHING (no new `judge_results` id, no `eval_cases`, no
status change); a rewrite that trips the tenant denylist refuses on g1 before
any judge model call; the candidate is judged with the CALLER's drivers, one
call per tier.

**The double judge as deliberate** (`edit.test.ts`): between propose and
apply, zero rows exist for the candidate's hash (a passing candidate verdict
confers nothing); after apply, the new hash's verdicts are exactly the
landing ladder's `g1`/`g3_screen`/`g3_final` — the I1 record comes from the
post-land judge, never the candidate. Not optimised away, per the kickoff.

**Red-checked, not assumed.** Two probes, both reverted: (i) making
`aiEditDraft` ignore the candidate verdict turned 3 tests red; (ii) making
`judgeCandidate` grade the draft's PERSISTED body instead of the candidate
turned 3 tests red. The new pins bite.

## 4. The spec deviation block is DELETED

`docs/create-engine/spec.md` §Error Behavior: the dated s88 deviation block
under the AI-edit clause is gone in this change; the clause itself is
untouched and is now literally what the engine does. No other reference to
the deviation remains in the spec (grepped).

## 5. Files touched OUTSIDE the declared set — each reported, with cause

1. **`packages/engine/src/__tests__/shell-inventory.test.ts`** — the
   executable shell-inventory ratchet went red on the new
   `judge.candidate.*` operation labels, correctly doing its job; adding the
   entry is the deliberate, review-visible act it exists to force (the exact
   s88 precedent on this same list). One structural note recorded in the
   test: the two judge entry points label the ONE shared metering shim, so
   guard call sites now run exactly one behind the label count — both counts
   stay pinned, so a new site OR label still fails the scan.
2. **`docs/SPINE.md` §1** — the ratchet's own instruction: a new operation
   label must refresh the shell-inventory sentence in the same change. Added
   the `judge.candidate.*` bullet and corrected the `create.ai_edit` bullet,
   which described the pre-s89 propose semantics.

## 6. Answers to the kickoff's open conditionals, and one observation

- **`deriveCreatePlan` cost preview:** it does NOT count judge calls —
  `deriveCostPreview` (`create/plan.ts:404`) counts generation + describe
  calls and names judge spend in `unestimated`. The AI edit is a post-run
  operator action, not part of any run's plan, so there is nothing to count
  and no change was made.
- **Observation for the lead (outside my file set, not fixed):** that
  `unestimated` sentence (`plan.ts:423`) says *"a screen-tier refusal skips
  the final tier, so the gate costs one or two calls per draft"* — stale:
  since the I3 both-tiers-always rule, the ladder costs zero (g1/cadence
  fail) or two calls, never one. One string, operator-facing.
- **`aiEditDraft`'s deps grew** (`screenDriver`/`finalDriver`, required —
  same no-self-configured-gate discipline as `ApplyAiEditDeps`). Its only
  callers were this repo's tests; B-create.4 will wire real drivers.

## 7. What I deliberately did NOT build

- Any surface, route, or Composer wiring (B-create.4, lead-gated).
- A staged-body column (the heavier alternative, deliberately not taken).
- New gates or lenses, or any change to what a gate decides.
- Anything in `packages/db/**` or `packages/engine/src/social/**`.
- A status guard inside `judgeCandidate` — it grades any draft's context;
  the edit engine keeps the propose-door guard, and a future caller with a
  different door should not inherit the edit door's opinion.
- Any reuse path for a candidate verdict (pass-through/back-dating/append) —
  the kickoff's stop-and-report clause; nothing safe was found, nothing
  attempted.

## 8. Gates — recorded on exit code, in this worktree

| gate | result |
|---|---|
| `npx vitest run --maxWorkers=2` (root) | **exit 0 — 3087 passed / 0 failed / 9 skipped** (s88's inherited NUL red is fixed on main and stays fixed here) |
| `npm run typecheck` | **exit 0** (it caught one real error vitest could not: `Draft.format` is `string \| null`, and the ladder's input type had narrowed it) |
| `npm run lint` | **exit 0** (8 pre-existing warnings, 0 errors — unchanged from s88) |

`npm run verify` is `npm test && npm run typecheck && npm run lint`; its
`npm test` is an unbounded vitest pool, barred while a second lane may be
live — the bounded run above is its exact equivalent. **Every gate was
re-run against the tree of the FINAL commit** (the s87 lesson: commits after
the last verify are how main sits red), and neither `pkill -f vitest` nor
`npm install` was run in this worktree.

**The lead rebases/merges — this lane does not.**
