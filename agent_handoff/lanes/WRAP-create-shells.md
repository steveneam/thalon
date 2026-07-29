# WRAP — lane `create-shells` (B-create.2 follow-through: the two chartered LLM shells)

Branch `agent/create-shells`, worktree `.claude/worktrees/create-shells`.
Spec of record: `docs/create-engine/spec.md` (APPROVED) §Design/The engine +
R8 and its Error Behavior clause. Predecessor: `WRAP-create-engine.md` §6.

Ships disarmed: both live drivers are constructed only behind
`AI_GATEWAY_API_KEY`, never in a test. Every test injects the deterministic
fake. No publish-path change, no UI, no routes.

---

## 1. DELIVERABLE 1 — both decisions, REPORTED BEFORE BUILDING

*(Written and committed before a line of either shell existed — the
seam-decision-first discipline the kickoff asked for. §3 below says what
survived contact with the code.)*

### 1a. The model tier for `create.describe_reference`

**Ground truth.** `modelTiers()` (`packages/platform/src/gateway.ts`) returns
`{draft, judgeScreen, judgeFinal, embedding}` — no vision tier. The defaults
(`packages/platform/src/env.ts:39–42`) are `MODEL_DRAFT=meta/llama-3.3-70b`,
`MODEL_JUDGE_SCREEN=meta/llama-3.3-70b`,
`MODEL_JUDGE_FINAL=anthropic/claude-sonnet-4.5`,
`MODEL_EMBEDDING=openai/text-embedding-3-small`.

**The vision-capability check, recorded as the kickoff requires.** Llama 3.3
70B Instruct is a **text-only** model — Meta's multimodal line at that
generation is Llama 3.2 11B/90B Vision, a different model id. So the draft
tier's default **cannot** accept an image content part. The kickoff's first
branch ("the draft tier's model is vision-capable and you use it") is
therefore closed on the shipped defaults, and I take the second: an
**optional `MODEL_VISION`**, which brings `packages/platform/src/env.ts` and
`packages/platform/src/gateway.ts` into my file set for that one additive var
plus its `modelTiers()` entry — exactly the licensed exception, nothing more.

**Where I disagree with the kickoff, said rather than substituted.** It
specifies `MODEL_VISION` "defaulting to the draft tier". I am not doing that,
because on the shipped defaults it would ship a default that provably cannot
do the job: the describe call would fail inside the gateway and degrade to
"reference attached, not yet analysed — <opaque provider error>", which is
honest in form and useless in substance. A default nobody can act on is worse
than a default that costs a little more. **`MODEL_VISION` defaults to
`anthropic/claude-sonnet-4.5`** — vision-capable, *already this repo's
`MODEL_JUDGE_FINAL` default* (so no new vendor and no new model id enters the
repo), and a describe is one short call per reference image. An operator who
wants a cheaper vision tier sets the var explicitly; that is what the var is
for. If the lead prefers the kickoff's literal wording, the change is one
line and one test.

**AI SDK v5 image support — verified against the installed tree, not from
memory.** `ai@^5.0.209` (`packages/engine/package.json:22`) re-exports
`ImagePart` from `@ai-sdk/provider-utils`
(`node_modules/@ai-sdk/provider-utils/dist/index.d.ts:410`):
`{type:"image", image: DataContent | URL, mediaType?: string}`, and
`UserContent = string | Array<TextPart | ImagePart | FilePart>` (ibid. :601).
So the driver sends one user message whose content is `[image, text]` through
`generateObject` — the same call shape `edl/shell/generator.ts` uses, plus the
image part.

**Scope, as walls in code (kickoff §1).** STORED image refs only: bytes come
from the content-addressed store via `getContentAddressed(store,
pinnedAssetKey(ref.sha256, ref.ext))`, so the content-address verification is
on the read path and a rotted or tampered object refuses rather than getting
described. An **external** ref stays honestly "attached, not yet analysed"
through the existing degrade path — fetching a stranger's bytes at describe
time has licensing texture and is deliberately not this lane's. An
**audio-family** stored ref refuses with the reason in words.

**One wall the kickoff did not name and I am adding.** `MODEL_VISION` may be
set to a `claude-cli/*` alias (the dev transport, `platform/claude-cli.ts`),
which takes system+prompt **text only** — it has no image channel. Sending a
describe through it would silently describe a picture the model never saw,
which is the fabricated-default failure in a new costume. The driver refuses
that combination in words instead.

### 1b. The shape of the R8 AI-edit verb

**Ground truth, three facts that decide the design.**

1. **`approvalsRepo.record({action:"edit", editedBody})`
   (`packages/db/src/repos/approvals.ts`) is THE edit path** — one
   transaction: an `approvals` row, an `edit_diffs` row
   (`beforeHash`/`afterHash`/`diff`), an `eval_cases` row (`kind:
   "draft_edit"`, `origin: "edit_diff"`), the body/`bodyHash` swap, and the
   `→ judging` transition. It requires status **`queued` or `blocked`** —
   an explicit guard, because `generated → judging` is also legal and would
   otherwise let an edit touch a draft the judge has never seen.
2. **`runJudgePipeline` judges the draft's PERSISTED body.** It opens with
   `repos.drafts.get(...)` and every gate reads `judging.body`
   (`proprietary/judge/src/pipeline.ts:69`). There is no candidate-body
   entry point on the harness.
3. **Verdicts are bound to `body_hash`.** `judgeResults.append` defaults
   `bodyHash` to *the draft's current* hash, and `transitionInTx`'s I1 check
   requires a passing `g3_final` row **for the current hash** before
   `→ queued` (`repos/drafts.ts:87`, `hasPassingVerdict`).

**The conflict, stated plainly.** The kickoff's ordering — *shell rewrite →
judge re-run through the SAME harness → on pass the edit lands; on refusal
the draft keeps its prior body byte-for-byte* — requires judging a body that
is **not** the draft's body. Fact 2 says the harness cannot do that, and
fact 3 says it must not be faked: appending verdicts for candidate text while
the draft still carries the old hash would mint an I1-valid **passing verdict
for content the judge never read**. That is a safety hole, not a shortcut,
and it is exactly the hole I1 exists to close.

The obvious workaround is worse. **Land-then-judge-then-revert-on-refusal**
writes a second `edit_diffs`/`eval_cases` pair whose "expected body" asserts
the operator wanted the old text back — a lie in the eval corpus, which is
training data. It costs a third judge run. It strands the draft at `judging`
if the restore judge halts on budget. And a crash between land and restore
leaves machine-written text sitting on the draft, which is precisely what
"byte-for-byte" exists to prevent. A test asserting the hash is unchanged
would pass on the happy path and lie about the mechanism.

**So I am reporting the gap rather than faking it, and building the shape
this repo already uses for the same problem.** The house precedent for "an
LLM proposes an edit to an existing artifact" is `video.propose_edl_diff`,
whose own inventory note reads: *core zod-validates + dry-applies, operator
approves each op, apply rides the replay-verified save door.* Applied here:

- **`aiEditDraft(ctx, repos, {draftId, instruction}, deps)` — writes
  NOTHING.** It guards the status up front (`queued` | `blocked`, the same
  door the hand edit accepts, so a proposal is never un-appliable), runs the
  shell under `create.ai_edit`, and returns either
  `{status:"proposed", priorBody, priorBodyHash, proposedBody}` or
  `{status:"refused", reason}` (empty instruction · wrong status · shell
  refusal · candidate byte-identical to the prior body). **The draft's body
  hash is unchanged on every path** — a *stronger* guarantee than the spec
  asks for, and the kickoff's test pins it unconditionally rather than only
  on the refusal branch.
- **`applyAiEdit(ctx, repos, {draftId, proposal, actor}, deps)`** lands the
  proposal through `approvals.record({action:"edit"})` and re-judges through
  `runJudgePipeline` with **the caller's own drivers**. From the state
  machine's point of view this is byte-identical to a hand edit: same
  `edit_diffs` row, same eval row, same `→ judging`, same I1 gate. It is
  guarded by `priorBodyHash` — if the draft moved under the proposal, the
  apply refuses instead of clobbering.

**What this does NOT deliver, named so nobody discovers it later.** On a
judge refusal *at apply*, the draft is `blocked` carrying the applied body
and the verbatim reason returns. That is hand-edit semantics; it is **not**
the spec's Error Behavior ("the variant keeps its prior body"). Safety is
unaffected either way — I1 means a blocked draft cannot leave the Composer —
but the spec's sentence is about not destroying an operator's known-good text
with machine-written text the judge refused, and under this shape the
operator's own explicit apply is what does it. Closing that gap needs one of
two things, both outside this lane's file set:

- **(a)** a candidate-judge entry in `proprietary/judge` — evaluate
  `{draft, candidateBody}`, return the verdict, append **no** hash-bound
  rows. Then `aiEditDraft` collapses to one call: judge the candidate →
  land on pass → the landing's own re-judge is the I1-of-record one. **This
  is the smaller change and the one I would take.**
- **(b)** a staged-body column so the candidate has its own row and hash.

Reported, not substituted, per the kickoff's own instruction: *"If the state
machine lacks a transition you need, STOP and report."* The state machine is
not what is missing — the harness's candidate-judging entry is.

**Variant provenance (R13).** Divergence lives on the run's stored plan
(`createVariantPlanSchema.variants[].diverged`, `create/plan.ts`), and today
**nothing marks it** — `plan.ts:172` says "the Composer records divergence as
the operator edits", i.e. it is B-create.4's job. So "exactly as a hand edit
would" is, at this moment, *nothing*. What I ship is the groundwork: one
pure `markVariantDiverged(plan, platform)` exported from `create/`, so when
the Composer lands, the hand-edit path and the AI-edit path mark divergence
through **one** function rather than two hand-rolled ones. `applyAiEdit`
calls it when handed the run id (`createRunsRepo.recordPlan` is the existing
write verb); without a run id it marks nothing and says so. No UI.

**LEAD RULING (received mid-lane, both decisions APPROVED).** 1a: the
`MODEL_VISION` deviation is accepted over the kickoff's literal wording —
"the kickoff was wrong, since a default that provably cannot do the job is
not a default"; keep `anthropic/claude-sonnet-4.5` and keep the `claude-cli/*`
refusal wall. 1b: **ship the propose/apply subset as designed**, do NOT extend
into `proprietary/judge` (moat file, outside the file set, weekly budget at
90%). The lead is recording the Error-Behavior deviation in the APPROVED
create-engine spec directly, naming option (a) as the closure path, so the
spec and the code do not silently disagree. §3 and §5 below carry the two
things the ruling asked me to state.

---

## 2. What shipped

| file | what |
|---|---|
| `create/shell/describe-reference.ts` *(new)* | The gateway vision driver. Reads STORED bytes content-address-verified, sends one `[image, text]` user message, returns `{style, subject}` + tokens. Three refusals before the gateway: `claude-cli/*` tier · non-stored ref · missing bytes; content-address mismatch is deliberately not caught. |
| `create/shell/ai-edit.ts` *(new)* | The rewrite driver. Body + instruction + the platform's HARD ceiling → a new body, zod-validated at the boundary. Body is fenced from the instruction so a draft containing instruction-shaped text cannot read as the operator's ask. |
| `create/shell/prompt-file.ts`, `create/shell/index.ts` *(new)* | The family's prompt reader (the house copy) and the shell barrel. |
| `create/edit.ts` *(new)* | `aiEditDraft` (proposes, writes nothing) · `applyAiEdit` (lands through the existing edit door + re-judges) · `markVariantDiverged` (pure, R13). Second guard call site: `create.ai_edit`. |
| `create/reference-scope.ts` *(new)* | `referenceDescribability` — ONE rule, its own module because its two callers may not share an import graph (see §4.2). |
| `create/reference.ts` | The docblock its predecessor wrote for this lane, now true; the describability check before the driver; `meteredReferenceVisionDriver` — first guard call site, `create.describe_reference`. The injectable seam itself is UNCHANGED. |
| `create/plan.ts` | `meteredCalls` now counts describe calls (spec's "plan-visible"). |
| `platform/env.ts` + `gateway.ts` | The optional `MODEL_VISION` var and its `modelTiers()` entry — the one licensed exception, nothing more. |
| `proprietary/prompts/create-{describe-reference,ai-edit}.v1.md` *(new)* | See §4.1 — a file-set extension, reported. |

**Tests: 100 in `create/__tests__` (was 73), all keyless and networkless.**
`plan` 37 · `run` 27 · `reference` 15 · `edit` 14 · `describe-reference` 7.

## 3. The judge-refusal semantics AS TEST-PINNED *(lead ask i)*

The propose half's guarantee is **stronger than the spec's and pinned
unconditionally**, not only on the refusal branch. `edit.test.ts` carries a
helper, `bodyHashUnchanged(fx, before)`, asserting both `body` and `bodyHash`
against a re-read of the row, and it runs after EVERY `aiEditDraft` path:

| path | assertion |
|---|---|
| a successful proposal | `bodyHashUnchanged` — the proposal exists only in the return value |
| empty instruction | refused + `bodyHashUnchanged` |
| shell declined (returned the body unchanged — the prompt file's own refusal convention) | refused, reason quotes the instruction back, + `bodyHashUnchanged` |
| shell returned whitespace | refused + `bodyHashUnchanged` |
| non-editable status | refused, **driver never called** (call count asserted `0`) + `bodyHashUnchanged` |

**Red-checked, not assumed.** I made `aiEditDraft` land the edit through
`approvals.record` and re-ran: **8 of 14 tests went red**, including every
`bodyHashUnchanged` site. The probe was reverted. The shell-inventory ratchet
was red-checked the same way (renamed one label → the set-drift test failed).

The apply half is pinned as what it is: `applyAiEdit` swaps the body, writes
one `edit_diffs` + one `eval_cases` row (`kind: "draft_edit"`, `origin:
"edit_diff"` — an AI edit becomes an eval row by the same mechanism a hand
edit does), re-judges through the shared harness, and re-queues. On a judge
refusal it returns `blocked` with the reason verbatim (`"both g3 tiers
failed"`) and **the applied body is on the draft** — the documented
divergence from the spec's Error Behavior, carrying a comment at the
assertion saying so, so it cannot drift back into looking intentional. Also
pinned: the caller's judge drivers arrive intact (recording fakes, both tiers
called exactly once — this module makes no judge call of its own); a stale
proposal is refused rather than clobbering a newer hand edit; the edit is
attributed to a non-human actor on the I4 events spine.

## 4. Two file-set extensions, and one inherited red

### 4.1 Files I touched outside the declared set — reported, each with cause

1. **`proprietary/prompts/create-describe-reference.v1.md` + `create-ai-edit.v1.md` (NEW).** Every shell driver in this repo reads its prompt from `proprietary/prompts/` (SPINE §3.2: *prompts are data, never inline strings*) — there is no counter-example. Inlining two system prompts to stay inside the letter of the file set would break a documented invariant and skip the `prompt_version` convention. Both files are NEW and additive; the live lane is in `packages/engine/src/social/**`, so collision risk is nil.
2. **`packages/engine/src/__tests__/gateway-boundary.test.ts`.** The shell-inventory ratchet's *sibling*, which the kickoff did not name: it allowlists which files may reach the gateway accessor, and it went red on my two new shell drivers — correctly, doing exactly its job. Adding them is the same deliberate, review-visible act the kickoff sent me to perform on the inventory list.
3. **`packages/platform/src/__tests__/seams.test.ts`.** The direct test of `modelTiers()`, which I was licensed to change. Updated for the new `vision` key, plus one added assertion pinning that **the vision tier must not equal the draft tier** — so a future "collapse the duplicate default" tidy-up cannot quietly re-break 1a's whole point.

### 4.2 A design note worth the lead's eye

`referenceDescribability` lives in its own tiny module rather than in
`reference.ts`, because `plan.ts` needs the same rule to price a run and
`plan.ts` is pure by construction. Importing `reference.ts` would have pulled
the gateway driver and `@thalon/db` into pure derivation's import graph;
duplicating the predicate would let the cost preview drift from what the run
actually does. One rule, one home, two importers.

### 4.3 INHERITED RED — `npm run verify` cannot go green, and it is not this lane

`tests/no-nul-in-source.test.ts` fails on `tests/repo-hygiene.test.ts`. **This
is red on a clean tree** — I confirmed it by stashing every change in this
lane and re-running. Two ratchets landed in the SAME commit (`e7a46a8`,
s87 "the hygiene audit") contradict each other: `repo-hygiene.test.ts` uses a
**raw NUL byte** as a join separator (`new Set(["AGENTS.md\0CLAUDE.md"])`, two
sites), and `no-nul-in-source.test.ts` forbids NUL bytes in tracked source.

The fix is one keystroke per site and provably behaviour-preserving: write the
separator as the two-character **escape** `"\0"` instead of embedding the raw
byte. The runtime string is identical; the file no longer contains byte 0x00.
I did not apply it — `tests/` is outside my file set and this is the lead's
call, per the same discipline as §1b.

## 5. Queued follow-up — closing the Error-Behavior gap *(lead ask ii)*

**Give the judge harness a way to grade a body that is not yet the draft's.**
Today `runJudgePipeline` can only judge what is already persisted, and every
verdict it writes is stamped with the draft's current `body_hash` — which is
what makes I1 trustworthy and what makes "judge the candidate first"
impossible from outside. The follow-up is a second, narrower entry beside it:
hand it `{draft, candidateBody}`, get back the same pass/block verdict and
reason, and write **no** `judge_results` row, because a verdict about text
that is not on the draft has no honest hash to bind to.

With that in place, `aiEditDraft` collapses back into the single call the
spec describes: rewrite → grade the candidate → on a pass, land it through
the existing edit door, whose own re-judge remains the I1 verdict of record;
on a refusal, return the reason and touch nothing. The propose/apply split
shipped here stays valid underneath it — apply becomes an internal step
rather than a second call the Composer has to make — so this is an
additive change, not a rewrite of what merged.

Scope when it comes up: `proprietary/judge/src/pipeline.ts` (the new entry,
sharing the gate sequence rather than copying it — a second copy of the gate
ladder is the real risk here) and a handful of lines in `create/edit.ts`.

## 6. What I deliberately did NOT build

- **Any surface, route or Composer wiring** — B-create.3/.4, lead-gated.
- **Media upload doors.**
- **Persisting describe outcomes** beyond what `CreateRunResult` already
  returns — a durable home is a window decision (create-engine wrap §6).
- **Promoting `createVariantPlanSchema` into contracts** — window work.
- **Anything in `social/**`** — the second lane is live there.
- **Fetching external reference bytes.** Kickoff scope, and the licensing
  decision behind it is not a lane's to make.
- **The candidate-judge entry** — §5, on the lead's explicit ruling.

## 7. Gates — recorded on exit code, in this worktree

| gate | result |
|---|---|
| `npx vitest run --maxWorkers=2` (root, both lanes live) | **1 failed / 3073 passed / 9 skipped.** The single failure is §4.3's inherited NUL red, red on a clean tree. Every test in this lane's scope passes. |
| `npm run typecheck` | **exit 0** (it caught two `totalForDay` signature errors vitest could not — the kickoff's warning earned its place) |
| `npm run lint` | **exit 0** (8 pre-existing warnings, 0 errors) |

`npm run verify` is `npm test && npm run typecheck && npm run lint`; its
`npm test` is an unbounded vitest pool, which the kickoff bars while a second
lane is live. The bounded run above is its exact equivalent. **It exits
non-zero for one reason only: §4.3, which this lane did not cause and did not
fix.** Never `pkill -f vitest`; never `npm install` in a worktree — neither
was run.

**The lead rebases/merges — this lane does not.**
