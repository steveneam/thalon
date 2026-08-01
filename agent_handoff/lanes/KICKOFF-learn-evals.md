# KICKOFF — lane `learn-evals` (the reject-reason learning door + the suite's batch read)

**Charter: COORDINATION.md §s90** (lane candidate `learn-evals`, planned s89,
launched on the founder's named GO) and the runway's §4 line: *"The
reject-reason control (drawn in W1's Approve) is the learn loop's front door —
wire reject→`eval_cases` when Approve rebuilds."* Approve REBUILDS next
session (s91, W1 APPROVED) — this lane puts the engine seam under it first so
the surface wires a working door, not a stub.

Launch is Mode B in the `thalon` tmux session. You own `agent/learn-evals`,
worktree `.claude/worktrees/learn-evals`.

**Why this lane exists.** Standing rule 6: every override/correction becomes
an eval row in the same change; a green suite is the ship gate. Three learning
doors exist (`intel_dismiss` · `lead_triage` · `cut_diff_review` — see
`packages/db/src/repos/eval-cases.ts`), plus `edit_diff` via
`approvals.record` on operator edits. **A plain rejection with the operator's
reason — the W1 Approve sheet's "your reason → eval" chip — has NO door**:
`approvals.record`'s reject branch transitions and stops, and the web action
(`apps/web/src/lib/approve-queue/actions.ts:38`) passes no reason at all.

---

## The ground truth that decides the design

1. **The db half is a CONTRACT WINDOW, already opened and frozen by the lead
   at s90 boot — you CONSUME it, you do not touch it.** The window (its
   commit is on main before your launch):
   - `eval_cases_origin_check` widened with `'approve_reject'`
     (`packages/db/src/schema/judging.ts:134` + migration);
   - `evalCasesRepo.recordApproveReject` `(new verb, frozen)` — mechanism-
     written, same-transaction audit event, exactly the shape of its three
     sibling verbs;
   - `approvals.record`'s reject branch accepts optional
     `reason: string` and, when present, writes the eval row in the SAME
     transaction as the `queued→rejected` transition
     (`packages/db/src/repos/approvals.ts:61` — invariant I4's one-transaction
     rule).
   If the frozen shapes don't fit what you build, **STOP and report** — the
   lead amends the window; you never edit `packages/db/**`.
2. **The suite's read side is STALE and narrower than the table.** The origin
   union in `eval/src/export-eval-cases.ts:20` and the zod enum in
   `eval/src/dataset.ts:13` both read
   `["edit_diff","golden","manual","intel_dismiss"]` — the table's constraint
   already also allows `lead_triage` and `cut_diff_review` (and now
   `approve_reject`). Two doors have been writing rows the suite cannot
   export. Closing that gap IS the "evals batch read" half of your charter.
3. **The service seat is engine/web-lib only — the UI control builds with the
   s91 Approve rebuild, not here.** `rejectDraft` in
   `apps/web/src/lib/approve-queue/actions.ts` grows the optional reason and
   passes it through; no component, sheet, or route changes.

## What you build

1. **The reason pass-through:** `rejectDraft(..., reason?)` →
   `approvals.record({action:"reject", reason})` (the frozen window seat) —
   plus tests in `apps/web/src/lib/approve-queue/__tests__/actions.test.ts`
   pinning: reason present ⇒ exactly one `eval_cases` row, origin
   `approve_reject`, `expected` carrying ground truth only (the operator
   rejected, their words) — never an invented semantic label; reason absent ⇒
   NO row (a bare reject is a decision, not a correction — the doors record
   signal, not ceremony).
2. **The batch read:** bring `eval/src/export-eval-cases.ts` and
   `eval/src/dataset.ts` to the full origin vocabulary, and make the export
   read ALL origins in one pass batched per kind rather than a call per
   origin — the suite consumes one dataset, not five exports. Idempotent,
   deterministic ordering, output never committed (the file's own rule).
3. **Suite integration:** an `approve_reject` row exports as a first-class
   `EvalRecord`; extend the eval suite's fixtures so a rejected-with-reason
   case round-trips write→export→dataset in one test.

## What you do NOT build

Any UI (the Approve rebuild is s91, lead-direct) · the ranker/weight tuning
that INTERPRETS these rows (B-crm.5-class, not chartered) · new origins beyond
`approve_reject` · anything in `packages/db/**` or `packages/contracts/**`
(frozen; gaps = STOP and report) · notifications on rejections (his §5.6
ruling: deliberately waiting).

## File set — DISJOINT, hard boundary

Yours: `eval/src/**` · `apps/web/src/lib/approve-queue/**` (actions + tests) ·
`packages/engine/src/leads/learn*.ts` ONLY if the batch read genuinely touches
them (say so in the wrap if it does). **NOT yours:** `packages/db/**`,
`packages/contracts/**`, `packages/engine/src/social/**` and the contracts
platform files (the `youtube-destination` lane is live there), sheets, routes,
UI components. Outside the set = STOP and report.

## Gates, and the box

- `npx vitest run --maxWorkers=2` (a second lane is live) · **never
  `pkill -f vitest`** · `npm run typecheck` (vitest does not typecheck) ·
  done = `npm run verify` green on EXIT CODE in your worktree · never
  `npm install` in a worktree.
- **Re-run the full suite after your LAST commit, not before it.**

## Wrap

`agent_handoff/lanes/WRAP-learn-evals.md` (new — you write it): the
reason-present/reason-absent semantics as test-pinned · the stale-union gap
you closed and how many origins the export now carries · the round-trip test ·
anything the frozen window made awkward (report, don't work around) · what you
deliberately did not build. Commit on your branch, push, stop. **The lead
rebases/merges — you do not.**
