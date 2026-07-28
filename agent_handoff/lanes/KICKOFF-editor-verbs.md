# KICKOFF — lane `editor-verbs` (version management: 4 of the editor's 5 open no-affordance rows)

> **APPROVAL ON RECORD (founder, s81 close): "I'll go with your
> recommendations"** — given against all four s82 calls, of which call #1 was
> the named-lane launch approval for exactly these three lanes. The standing
> rule is that every launch needs fresh approval; this is it, and it covers
> exactly this run.

You are lane A of three running in parallel. **The contracts and the shared
seam you build against are FROZEN** — the s82 pre-flight window merged to main
at `7fee14c` (W1) and `3513ef5` (W2) before you were launched. You do not edit
`packages/contracts/**` or `packages/db/**`. If you believe you need to, that
is a re-plan and a message to the lead, never an ad-hoc edit (COORDINATION.md
header).

Read `CLAUDE.md` first, then IN ORDER:

- **`docs/research/s82-PREPLAN.md` §2 "Lane A"** — THE PLAN OF RECORD. Your
  six tasks A1–A6 are its table; §3 call #2 records the founder's ratified
  delete rule, which A3 implements exactly.
- **`docs/research/jobs-table-s79.md`** — the harness ledger. EIGHT wrong
  selectors are on record there. Read it before you trust any verdict the
  drive harness gives you, and before you conclude a product defect from a
  harness complaint.
- `agent_handoff/CURRENT.md` — the s81 stamp: what the editor's two gates
  measured at close, and which five rows are still open. Four of them are
  yours.
- `packages/db/src/repos/video-cuts.ts` — `remove()` is frozen and waiting.
  Read its three refusals and their reasons before wiring A3.
- `apps/web/src/components/media/take-audition.tsx` — the frozen W2 seam A5
  consumes. Read its props and its one-at-a-time guarantee; do not
  re-implement any of it.

## Your file set (nothing outside it)

- `apps/web/src/components/videos/editor.tsx` **and its tests**
  (`editor.test.tsx` is yours)
- `apps/web/src/lib/videos/**`
- `apps/web/src/app/api/videos/**`

**You own NO CSS.** Use the sheet's existing classes — the proposal
`.diff-panel`/`.diff-op` grammar is exactly a compare view's, which is why A1
needs no new rules. Do NOT touch `editor.css`, `editor-inspector.tsx`,
`editor-timeline.tsx` or `dossier.css`: lane `editor-polish` owns all four and
is editing them right now. `app/app/workspace.css` is the lead's.

---

## A1 — compare two versions

A pure `compareEdls(a, b)` in `lib/videos/` — beats added/removed/reordered/
trimmed, caption text and timing, music source and knobs — plus a compare
state behind the existing Cut-history door, drawn in the diff-panel grammar
already on the surface.

**Deterministic. No LLM, no metered call, no spend.** Two EDLs in, a diff out;
if you find yourself wanting a model for this, the answer is that the diff is
structural and the ops vocabulary already exists in contracts.

## A2 — save as a NAMED variant

The save door already derives the version per name (`planCutSave`). This is UI
only: a name field on save, where the same name means the next version
(unchanged default behaviour) and a new name starts a variant at v1. Do not
change the door.

## A3 — delete a version / an abandoned derived cut

A DELETE route over the frozen `videoCuts.remove`. The three refusals are the
founder's ratified default and are already enforced in the repo — your job is
that the SURFACE states them, in the notice band, when the operator presses:

  a. an approved cut carries its judge receipt;
  b. a lineage parent anchors a living derived cut's provenance;
  c. the project's last cut is what makes the project openable.

**The refusal must not be a disabled button.** s81's standing lesson: a
control that refuses stays focusable, says `aria-disabled`, and answers with
its reason when pressed. Refusing is fine; refusing silently is not. The
rendered file is the ROUTE's to delete — `remove()` hands back `outputRef`
precisely so the file does not get orphaned.

## A4 — a render survives leaving the page

The registry gains `listRunning(projectId)` (in-process, no schema — the
window is closed) plus a GET parameter; the editor resumes its poll on load
and the player states "a render is in flight for vN" rather than looking idle
while ffmpeg works.

## A5 — audition a candidate take (the takes-strip half)

Consume the frozen `<TakeAudition>` in the takes strip. Lane B wires the same
component into the bed picker — you two must not edit each other's files, and
because the seam coordinates through its own module store you do not need to.

Note the s81 sideways Bounded-List rule already on the takes strip: it exists
because nine candidates would otherwise clip.

## A6 — the editor.tsx-owned s78 tail

- the player's failure state and a way out (`onError` → an honest notice);
- the shared `busy` flag becomes an action identity (`running: null | "save" |
  "render" | …`) — today one verb's spinner disables every other verb;
- every duration through `timecode()`.

---

## The gates you are held to

- **`npm run verify` is THE gate, and you gate on its EXIT CODE.** Never pipe
  it through `tail` — that swallows the failure (main has gone red five times;
  #3 was exactly this). Redirect to a file and read the file.
- **vitest does NOT typecheck and does not lint.** A targeted test run passing
  means very little; two s81 defects reached the merge gate that way.
- Write tests WITH the code, in the same change.
- **You cannot drive or screenshot your own work** — the lead runs the jobs
  harness and the render measurement at the merge gate. Do not run
  `drive-surface.mjs` against your own lane and report the result as proof.
- Do not rebase onto main or merge anything; the lead owns rebase, PR and
  merge end to end. Commit on `agent/editor-verbs` and stop at a verified
  boundary.

⛔ **The sequence gate is untouched:** nothing publishes, nothing posts,
nothing spends a metered call. Your one remaining `undriven` row needs a
pending proposal, which needs a metered call — leave it; it is explicitly out
of scope.

When you are done: verify green, commit, and report to the lead what you
built, what you did not, and anything you found that the plan got wrong.
