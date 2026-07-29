# KICKOFF — lane `judge-candidate` (close the R8 deviation: judge a candidate body BEFORE it lands)

**Charter: `docs/create-engine/spec.md` (APPROVED)** — §Error Behavior,
*"AI-edit judge rejection: the variant keeps its prior body; the refusal shows
at the control (never a silent revert)"*, and the **dated deviation block**
directly under that clause, which names this lane's job as the closure path.
Read that block, then `agent_handoff/lanes/WRAP-create-shells.md` §1b in full —
it carries the whole derivation and the reason the obvious workarounds are
worse. The docblock at the top of `packages/engine/src/create/edit.ts` repeats
it at the code.

Launch is Mode B in the `thalon` tmux session. You own `agent/judge-candidate`,
worktree `.claude/worktrees/judge-candidate`.

**Why this lane exists.** s88 shipped the R8 AI edit as propose/apply and
deliberately left one gap: on a judge refusal *at apply*, the draft ends
`blocked` **carrying the applied body**. Safety is fine (I1 walls the Composer),
but the spec's real intent — machine-written text the judge refused must never
replace an operator's known-good text — is not met. The s88 lane could not close
it because `proprietary/` was outside its file set and the weekly budget was
spent. It is IN yours.

**Ships behaviour-preserving for every existing caller.** No publish-path
change, no UI, no routes, no new spend on the default path beyond one candidate
judge per AI edit (see "The double judge is deliberate" below).

---

## The ground truth that decides the design

1. **`runJudgePipeline` (`proprietary/judge/src/pipeline.ts:65`) is
   write-coupled from its first line.** It does `repos.drafts.get`, then
   **transitions the draft to `judging`** (`:70–73`), collects grounding chunks
   from that row, and every gate reads `judging.body` (`:100`, `:159`, `:192`;
   the tier runner reads `draft.body` at `:255`). Each gate result is
   **appended** via `repos.judgeResults.append` (`:101`) and failures transition
   the draft to `blocked`.
2. **Verdicts bind to `body_hash`.** `judgeResults.append` defaults `bodyHash`
   to the draft's CURRENT hash, and `transitionInTx`'s I1 check
   (`packages/db/src/repos/drafts.ts`, `hasPassingVerdict`) requires a passing
   `g3_final` **for the current hash** before `→ queued`.
3. Therefore a candidate judge must run the **same gates** against a body that
   is not on the draft, **write nothing**, and **transition nothing**.

## What you build

### 1. Share the ladder — do NOT copy it

**This is the whole risk of this lane, and it is why the s88 lane flagged it
by name: a COPIED gate ladder drifts, and a drifted judge is a safety
divergence that no test will announce.** Extract the gate sequence into ONE
internal core that both entry points call — something with the shape
`runGateLadder({body, denylist, chunks, ...deps})` returning the verdicts and
evidence **without touching `repos`** — then:

- **`runJudgePipeline` keeps its exact current signature and behaviour** and
  becomes the persist-and-transition wrapper around that core: it resolves the
  draft, transitions to `judging`, builds denylist + chunks, calls the core,
  appends each verdict, transitions on failure. **Every existing judge test must
  stay green untouched** — `proprietary/judge/src/__tests__/pipeline.test.ts`
  and its neighbours are the pin. If you find yourself editing an existing
  pipeline test's expectations, STOP and report: that means behaviour moved.
- **`judgeCandidate(...)` (new)** — evaluates `{ctx, draft, candidateBody}`
  through the same core with the **same denylist and the same grounding
  chunks the draft would get**, and returns the verdict. It **appends no
  `judge_results` rows, transitions nothing, and writes nothing.** Its return
  type must make "this verdict is not of record" unmistakable at the call site;
  do not reuse the persisted-outcome type if that would blur it.

**Grounding is the subtle part, and it decides correctness.** Chunks come from
`collectGroundingChunks(ctx, repos, judging)` and the ACTIVE profile identity is
appended inside the pipeline "so no caller can forget it" (`:79–99`). The
candidate path must get **the same treatment through the same code** — a
candidate judged against different grounding than the landing judge is a
false gate, and it would fail open on exactly the claims grounding exists to
catch. Reuse the collection, do not re-derive it.

### 2. Rewire `aiEditDraft` to judge before landing

`packages/engine/src/create/edit.ts`. The propose path becomes: guard status →
run the `create.ai_edit` shell → **judge the candidate** → refuse with the
verbatim reason on fail, propose on pass. `applyAiEdit` keeps its
`priorBodyHash` guard and keeps landing through
`approvals.record({action:"edit"})` and its re-judge.

- **The unconditional `bodyHashUnchanged` assertion in
  `packages/engine/src/create/__tests__/edit.test.ts` stays unconditional and
  must still pass on every `aiEditDraft` path** — including the new
  judge-refusal path. That test was red-checked in s88 (making the edit land
  turned 8 of 14 red); it is the lane's tripwire, not decoration.
- **The spec's Error Behavior is now met exactly**, so **delete the deviation
  block** from `docs/create-engine/spec.md` §Error Behavior in the same change
  and say so in your wrap — a deviation note that outlives its deviation is a
  lie in an approved spec. Leave the clause itself untouched.

### 3. The double judge is DELIBERATE — do not optimise it away

On a passing candidate + apply, the body is judged twice: once as a candidate
(advisory, unwritten) and once after landing (the I1 record). **That is
correct and must stay.** The post-land judge binds its verdict to the NEW
body_hash, which is the only hash I1 can honestly accept. Reusing the candidate
verdict for the landed body — by passing it through, back-dating it, or
appending it against the new hash — **re-opens exactly the hole this lane
closes.** If you think you have found a safe way to collapse the two, STOP and
report it rather than building it.

If `deriveCreatePlan`'s cost preview counts judge calls, make it count this one
too (the s88 lane established that "plan-visible" means the preview matches
what a run actually spends).

## What you do NOT build

Any surface, route, or Composer wiring (B-create.4, lead-gated) · a staged-body
column (the heavier alternative, deliberately not taken) · new gates, new
lenses, or any change to what a gate DECIDES · changes to
`packages/db/**` (repos are frozen for you — consume; missing verb = STOP and
report) · anything in `packages/engine/src/social/**` (a second lane may be
live there).

## File set — DISJOINT, hard boundary

Yours: `proprietary/judge/src/**` · `packages/engine/src/create/edit.ts` +
its tests · `docs/create-engine/spec.md` (the deviation-block deletion ONLY).
**NOT yours:** `packages/db/**`, `packages/contracts/**`,
`packages/engine/src/social/**`, sheets, routes. Outside the set = STOP and
report.

## Gates, and the box

- `npx vitest run --maxWorkers=2` (a second lane may be live) · **never
  `pkill -f vitest`** · `npm run typecheck` (vitest does not typecheck) ·
  done = `npm run verify` green on EXIT CODE in your worktree · never
  `npm install` in a worktree.
- **Re-run the full suite after your LAST commit, not before it** — s87 shipped
  two contradicting ratchets because its final commits went in after its last
  verify, and `main` sat red until s88 found it.

## Wrap

`agent_handoff/lanes/WRAP-judge-candidate.md` (new — you write it): how the
ladder ended up shared (and what you had to move to share it rather than copy
it), proof the existing pipeline tests are untouched, the candidate path's
grounding parity as test-pinned, the refusal semantics as test-pinned, the
deviation block's deletion, anything you disagreed with (say it, don't
substitute), and what you deliberately did not build. Commit on your branch,
push, stop. **The lead rebases/merges — you do not.**
