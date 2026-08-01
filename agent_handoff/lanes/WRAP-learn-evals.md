# WRAP — lane `learn-evals` (the reject-reason learning door + the suite's batch read)

Branch `agent/learn-evals`, all gates green (`npm run verify` exit 0 after the
last commit). The lead rebases/merges.

## What shipped

1. **The reason pass-through** (`apps/web/src/lib/approve-queue/actions.ts`):
   `rejectDraft(repos, ctx, draftId, actor, reason?)` hands the optional
   reason to the frozen s90 window seat
   (`approvals.record({action:"reject", reason})`). No component, sheet, or
   route changed — `client.ts` and the reject route are untouched; the s91
   Approve rebuild wires the UI chip onto this seat.

   **Semantics, as test-pinned**
   (`apps/web/src/lib/approve-queue/__tests__/actions.test.ts`):
   - reason present ⇒ exactly ONE `eval_cases` row: kind `draft_reject`,
     origin `approve_reject`, `sourceRef` = the approval id, and `expected`
     pinned with `toEqual` (not `toMatchObject`) to
     `{ operatorAction: "rejected", reason }` — ground truth only, never an
     invented semantic label;
   - reason absent ⇒ NO row (a bare reject is a decision, not a correction).
     Blank-reason ⇒ no row is already pinned a level down in the repo tests
     (`packages/db/src/__tests__/eval-cases.test.ts` §s90 window) — not
     re-pinned here.

2. **The batch read** (`eval/src/export-eval-cases.ts` + `eval/src/dataset.ts`):
   - The stale union (`edit_diff|golden|manual|intel_dismiss`, in BOTH the
     zod enum and the export filter type) is replaced by the canonical
     `EVAL_ORIGINS` vocabulary in `dataset.ts`, mirroring
     `eval_cases_origin_check`: **7 origins** (`edit_diff, golden, manual,
     intel_dismiss, lead_triage, cut_diff_review, approve_reject`). The gap
     was worse than "cannot export": `toJsonl` schema-parses every record,
     so one `lead_triage` or `cut_diff_review` row made the whole export
     **throw**, taking the exportable rows down with it.
   - `exportEvalCases` reads ALL origins in ONE `evalCases.list` pass (no
     call per origin), then batches per kind: contiguous kind groups, kinds
     sorted, the repo's `createdAt/id` order preserved inside each (stable
     sort) — deterministic however the doors interleaved their writes.
     Idempotent; output still never committed. The single-origin `filter`
     stays for targeted exports, now typed to the full vocabulary.

3. **Suite integration** (`eval/src/__tests__/capture-to-dataset.test.ts`):
   - The seeding boilerplate is now a fixture (`seedQueuedDraft`) — extend
     there as doors multiply.
   - **The round-trip test:** a reject-with-reason against a real embedded
     DB comes out as a first-class `EvalRecord` (kind/origin/expected/
     sourceRef pinned) and survives `parseJsonl(toJsonl(...))` losslessly.
   - **The batch test:** five doors write interleaved (intel dismiss ×2
     with a lead-triage row between, a cut-diff review, a
     reject-with-reason); ONE export pass returns all five rows with every
     mechanism origin present, kinds contiguous, within-kind write order
     preserved, and the previously-unexportable origins serializing.

## The frozen window

Fit exactly as frozen — nothing awkward, no gaps, `packages/db/**` and
`packages/contracts/**` untouched. `packages/engine/src/leads/learn*.ts` was
NOT touched either: the batch read never needed it.

## Deliberately not built

- Any UI (the Approve rebuild is s91, lead-direct — the reason control wires
  onto `rejectDraft`'s new parameter then).
- The ranker/weight tuning that INTERPRETS the rows (B-crm.5-class,
  unchartered).
- New origins beyond `approve_reject`; new repo verbs (the window's inline
  write is the door).
- Notifications on rejections (his §5.6 ruling: deliberately waiting).
