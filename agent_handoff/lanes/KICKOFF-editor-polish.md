# KICKOFF — lane `editor-polish` (the s78 medium/low tail in the inspector, the timeline and the css)

> **APPROVAL ON RECORD (founder, s81 close): "I'll go with your
> recommendations"** — given against all four s82 calls, of which call #1 was
> the named-lane launch approval for exactly these three lanes. The standing
> rule is that every launch needs fresh approval; this is it, and it covers
> exactly this run.

You are lane B of three running in parallel. **The contracts and the shared
seam you build against are FROZEN** — the s82 pre-flight window merged to main
at `7fee14c` (W1) and `3513ef5` (W2) before you were launched. You do not edit
`packages/contracts/**` or `packages/db/**`; that is a re-plan and a message to
the lead, never an ad-hoc edit.

Read `CLAUDE.md` first, then IN ORDER:

- **`docs/research/s82-PREPLAN.md` §2 "Lane B"** — THE PLAN OF RECORD. Your
  ten items B1–B10 are its table, each carrying the audit severity it came
  from.
- **`docs/research/video-editor-audit-s78.md`** — the findings themselves. Do
  not work from the one-line summaries in the plan; read each finding's own
  section, because several name the exact mechanism and the sibling surface
  that already solved it.
- **`docs/research/jobs-table-s79.md`** — the harness ledger. EIGHT wrong
  selectors are on record. Read it before you trust a harness verdict or
  conclude a product defect from a harness complaint.
- `apps/web/src/components/media/take-audition.tsx` — the frozen W2 seam B9
  consumes. Read its props and its one-at-a-time guarantee; do not
  re-implement any of it.

## Your file set (nothing outside it)

- `apps/web/src/components/videos/editor-inspector.tsx`
- `apps/web/src/components/videos/editor-timeline.tsx`
- `apps/web/src/components/videos/editor.css`
- `apps/web/src/components/videos/dossier.css` — **B8 only**
- NEW `apps/web/src/components/videos/__tests__/editor-polish-s82.test.tsx`
  (the s80 safety-test precedent — a NEW file, because `editor.test.tsx`
  belongs to lane `editor-verbs` and it is editing it right now)

**Do NOT touch `editor.tsx`, `lib/videos/**` or `app/api/videos/**`** — lane
`editor-verbs` owns all three. `app/app/workspace.css` is the lead's.

---

## The ten items

| # | task | audit finding |
|---|---|---|
| B1 | Remove-easing restores the held values | `medium` R-lens |
| B2 | Proposal marks on the caption/music lanes get the word and an accessible state — border colour alone is not a mark | `medium` |
| B3 | Judge-refusal marks on the timeline plates (`refusedCaptions` beside `propCaptions`) | `medium` |
| B4 | Numfield width scoped to numeric — free-text reason fields get their flex back | `medium` |
| B5 | Pan-axis flatten retains its endpoints for the return trip | `low` R-lens |
| B6 | Copy-mode music block: selectable-not-draggable cursor, and a "no knobs" tag | `low` ×2 |
| B7 | The endcard overlay's freeze fact becomes visible, not a dead tooltip | `low` |
| B8 | Player plate ink fixed-register in light mode — **both videos surfaces in one change** (`editor.css` + `dossier.css`, the audit's own condition) | `low` |
| B9 | Audition in the BED PICKER — consume the frozen `<TakeAudition>` | s81 gap |
| B10 | Beat-block label clips mid-token, and `.prop-tag` clips to 0px visible | `high` remnant |

**B9 is the one that changes a decision rather than a look.** s81 shipped a bed
picker that offers nine candidates addressed by filename — "pick one of nine
beds by name" is not a choice anyone can actually make. That is why the seam
exists and why it was frozen before you launched.

**B10 is a `high` and everything else is medium/low — do it first.**

## The rule that governs every CSS edit you make

`editor.css` is a per-surface stylesheet, so **every rule you add must be
scoped under `.editor-surface`** — `lib/__tests__/surface-css-scope.test.ts`
enforces it and will fail you otherwise. The mock sheets deliberately reuse
class names across surfaces with different values; an unscoped rule silently
restyles a neighbour, and it shows up long after the change that caused it.

B8 is the one item that legitimately spans two sheets, and the audit made that
its condition: fixing the player plate in only one leaves the two videos
surfaces disagreeing in light mode.

**Values come from the sheets, byte-true.** Do not invent spacing. Note that
three existing `editor.css` design-hook findings are known FALSE POSITIVES
(the border-triangle technique and byte-true sheet values) — do not "fix"
them.

---

## The gates you are held to

- **`npm run verify` is THE gate, and you gate on its EXIT CODE.** Never pipe
  it through `tail` — that swallows the failure (main has gone red five times;
  #3 was exactly this). Redirect to a file and read the file.
- **vitest does NOT typecheck and does not lint.**
- Write tests WITH the code, in the same change.
- **You cannot drive or screenshot your own work** — the lead runs the jobs
  harness and the render measurement at the merge gate.
- Do not rebase onto main or merge anything; the lead owns rebase, PR and
  merge. Commit on `agent/editor-polish` and stop at a verified boundary.

⛔ **The sequence gate is untouched:** nothing publishes, nothing posts,
nothing spends a metered call.

When you are done: verify green, commit, and report to the lead what you
built, what you did not, and anything you found that the audit or the plan got
wrong. Several of these ten are one-liners; if an item turns out to be already
fixed or a false positive, say so with the evidence rather than inventing work.
