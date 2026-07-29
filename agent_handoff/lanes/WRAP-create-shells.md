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

---

*(§§2–5 — what shipped, the shell-inventory entries as merged, the
judge-refusal semantics as test-pinned, gates — are written at lane close.)*
