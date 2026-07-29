# WRAP — lane `create-engine` (B-create.2: the Create run engine)

Branch `agent/create-engine`, worktree `.claude/worktrees/create-engine`.
Spec of record: `docs/create-engine/spec.md` (APPROVED). Built against the
s87 contract window exactly as frozen — **no file outside
`packages/engine/src/create/**` was edited**, including the two window gaps
found below, which are reported rather than patched.

Ships disarmed: this module constructs **no gateway driver of any kind**. The
judge's drivers are a REQUIRED dep (a caller must hand them over), every
family engine's generation driver is passed through, and the reference
describer's vision driver has no real implementation in this lane. The whole
suite is keyless and networkless.

---

## 1. REQUIRED AT MERGE — one line, deliberately not mine

`packages/engine/src/index.ts` needs:

```ts
export * from "./create";
```

`@thalon/engine`'s package exports are `{".": "./src/index.ts"}` only, so
until that line lands the module is invisible to `apps/web` (B-create.4).
The kickoff's file set is `packages/engine/src/create/**`, and a one-line
barrel edit is still an edit outside it — with a second lane live in the same
package, that is the lead's call at merge, not a lane's ad-hoc reach. Nothing
in this lane's gates depends on it: the tests import relatively.

## 2. TWO WINDOW GAPS — found while consuming the window, NOT fixed here

**(a) `platformRouting` is accepted by the config schema and never stored.**
`brandProfileConfigSchema.platformRouting` shipped in the s87 window, but
`brand_profiles` has no `platform_routing` column and
`brandProfilesRepo.create` does not persist it — so a tenant's family routing
is dropped between the schema and the row and every tenant silently falls
back to `DEFAULT_PLATFORM_ROUTING`. **This is the third occurrence of the same
gap**: the `outreach` column's own docblock records it happening for
`outreach` and then `social` before it ("the s54 window shipped the schema
field only, so the repo dropped the block on create and the door's structural
read could never find it for a real tenant").

Not a blocker for this lane — derivation takes routing as an input, so
everything is built and tested — but it disarms per-tenant routing the moment
a surface reads it. Fix = column + repo persist + a round-trip test (the same
shape the `social` fix took). Until then it is pinned by an executable
ratchet in my own file set, `run.test.ts` → *"RATCHET: `platformRouting` is
accepted by the config schema and never stored"*, which goes **red the day
the column lands** — delete it then; `loadPlanContext` already reads the
field defensively and starts honouring it with no further edit.

**(b) `CreateRun` is not exported from `@thalon/db`'s barrel.** `types.ts`
declares it beside `FanoutRun`, but only `FanoutRun` reaches the public
surface, so the window's own row type is unnameable outside the package.
Worked around locally (`CreateRunRow = NonNullable<Awaited<ReturnType<
Repos["createRuns"]["get"]>>>` in `run.ts`); one export line makes it an
import.

## 3. What shipped

`packages/engine/src/create/` (new, 5 files + 3 test files, **73 tests**):

| file | what |
|---|---|
| `plan.ts` | `deriveCreatePlan` — pure. The refusal ladder, routing prefill, cost preview, blog-mirror pairing, variant-provenance groundwork, the Intel-context reader. |
| `dispatch.ts` | One arm per family over the engines that already exist and already judge; `DEFAULT_CREATE_DISPATCH`. |
| `run.ts` | `runCreate` — plan → pre-flight → idempotent run row → brief assembly → per-unit dispatch → children/lastError/status. Plus `loadPlanContext`, `createGenerationKey`, `renderWizardSlots`. |
| `reference.ts` | The describe seam: `ReferenceVisionDriver` (fake only), honest degradation, the one canonical notes rendering. |
| `index.ts` | Module barrel. |

Acceptance criteria, each test-pinned: **1** plan derivation with every
refusal code pinned (`plan.test.ts`, 36 tests) · **2** judge deps threaded
intact + the orchestrator makes no judge call of its own · **3** partial
failure recorded verbatim while the others proceed · **4** reference-role
media never reaches a dispatch arm or a draft (red-checked: removing
`outputEligible` from `run.ts` turns the wall test red) · **5** blog-mirror
pairing derived · **6** variant provenance on the stored run row.

## 4. The dispatch table AS BUILT

| family | mode | engine called | children recorded | grounding picks ride as |
|---|---|---|---|---|
| `post` | either | `runFanout`, **once per admitted destination** | `fanout_run` + `draft` per destination | INLINED into the brief text |
| `video` | `prompt` | `runOnePromptVideo` (pipeline) | `video_project` + final `draft` | INLINED into the prompt |
| `video` | `wizard` | `startVideoStages` (stage 0, judged) | `fanout_run` + stage `draft` | `groundingSourceIds` |
| `page` | either | `runWebPageGeneration` | `fanout_run` + `draft` | `groundingSourceIds` |
| `email` | either | `runOutreachEmail` (lead from `context.leadId`) | `fanout_run` + `draft` | INLINED into the brief text |

Grounding rides as ids wherever the engine accepts a list, and is inlined
into the brief text where it does not (`runFanout`, `runOutreachEmail` and
`runOnePromptVideo` each ground on the ONE source they are handed). The
alternative was dropping an operator's grounding picks silently.

Judging: the arms whose engine leaves drafts `generated` run the shared
harness (`runJudgePipeline`) with the caller's own drivers, using
`composeEmailDraft`'s exact rule — judge ONLY a still-`generated` draft, so
an idempotent replay never re-spends. Staged/one-prompt video judges inside
its own engine. `runCreate` itself never calls the judge (pinned).

## 5. Spec points I substituted or disagree with — said, not swallowed

1. **`runCreate(ctx, repos, brief, deps)`, not the kickoff's
   `runCreate(brief, deps)`.** Four of the five family engines take
   `(ctx, repos, request, deps)`; tenancy stays explicit at the call site.
2. **Video one-prompt dispatches to `runOnePromptVideo`, not `origination`.**
   The spec's table names `origination` for one-prompt video, but
   `runOrigination` produces a `pillar_script` draft — a real artifact, not
   the door Create's video family runs today. `apps/web/api/create/video`
   calls `runOnePromptVideo`, which is what "one-prompt video · armed" in the
   spec's own gap table refers to. I dispatched to the armed door.
3. **`deriveCreatePlan(brief, {routing, connections, matrix})`** — the
   kickoff sketch's `profile` is **dropped** and `connections` **added**.
   `channel_not_connected` cannot be derived without connection state; and
   there is nothing honest for the profile to do here, because the fan-out
   already folds identity topics into `targetTerms` at their own last-priority
   rung — re-supplying them would promote them above it. An unused parameter
   would be a lie about what derivation depends on.
4. **The post family calls `runFanout` once PER destination.** `runFanout`
   generates N platforms in a loop that aborts on the first irrecoverable one
   — correct for a fan-out (its replay backfills), but it would make one bad
   destination cost the whole Create run, which the spec's Error Behavior
   forbids. The price is real and worth the lead's eye: **a four-destination
   post run leaves four `fanout_runs` rows**, so the Runs surface shows four
   fan-outs behind one Create run. Each keeps the fan-out's own generation
   key, so a re-run costs nothing for destinations already drafted.
5. **`video_project` attribution differs from the window note.** The window
   says "only staged video additionally owns a `video_project`"; in the code
   the project is created by `runOnePromptVideo` (the one-prompt door) and
   NOT by `startVideoStages`. The contract is honoured — the kind is emitted
   — only the note's attribution is inverted.
6. **Status semantics, chosen and pinned:** a judge REFUSAL leaves the run
   `complete` with the reason on the child (the gate spoke, which is the gate
   working); only an exception makes a run `failed`; and a PARTIAL run is
   `failed`, not `complete` — the word an operator scans a list for must not
   say everything shipped when a destination did not.
7. **The email family is the outreach compose door, not a newsletter.** The
   spec's routing table sketches "email→list", and no list/broadcast compose
   engine exists — the only one that does needs a lead. So Create's email arm
   resolves `context.leadId` (the same field the Intel `lead_promote` chip and
   `/api/create/email` already carry) and refuses loudly, before any write,
   when it is absent. `renderOutreachBrief` stays in `apps/web` — Create hands
   the operator's own brief text rather than growing a second copy of it.
8. **Media-required is checked for the `post` family only.** A video run's own
   output is the media Instagram/TikTok demand; applying the rung there would
   refuse every video run to the two platforms video exists for.

## 6. What I deliberately did NOT build

- **Any surface** — no route, no Composer, no wizard (B-create.3/.4 are
  sheets-first and lead-direct).
- **A real vision driver.** A gateway describe call must meter through
  `withGatewayGuard` under a new operation label, which cannot merge without
  editing `packages/engine/src/__tests__/shell-inventory.test.ts` — outside my
  file set, and precisely the deliberate act that ratchet exists to force.
  Until it lands, a reference is honestly "attached, not yet analysed".
- **Persisting the describe outcomes.** They are returned on
  `CreateRunResult.references`; the stored brief already carries the
  reference-role media, so a surface can say "attached, not yet analysed"
  without a new stored shape. If the Composer wants them durable, that is a
  plan-shape decision for the next window — not a shape invented here.
- **Promoting `createVariantPlanSchema` into `@thalon/contracts`.** It lives
  in `plan.ts` under the open `plan.family` record and is exported so the
  promotion is a move, not a rewrite.
- **D3 settings wiring** (no consumer in this lane, per the kickoff), media
  upload routes, D2 analytics, and any publish-path change.

## 7. Gates

- `npx vitest run --maxWorkers=2` (root, both lanes live — the kickoff's box
  constraint; never `pkill -f vitest`)
- `npm run typecheck`
- `npm run lint`

Recorded on exit code in the commit message. `npm run verify` differs from
the above only in that its `npm test` is an unbounded vitest pool, which the
kickoff bars while a second lane is live.

**The lead rebases/merges — this lane does not.**
