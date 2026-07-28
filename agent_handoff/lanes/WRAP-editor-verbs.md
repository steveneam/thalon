# WRAP — lane `editor-verbs` (s82 A1–A6: version management + the editor.tsx tail)

Branch `agent/editor-verbs`, one commit on top of `104efcb`. **Not merged** —
the lead rebases, re-runs verify on merged main, drives the jobs and measures
the render.

`packages/contracts/**` and `packages/db/**` were NOT touched. `videoCuts.remove`
and `<TakeAudition>` are consumed exactly as W1/W2 froze them. **No CSS was
written**: every new state uses the sheet's existing `.tl-foot` / `.diff-panel`
/ `.diff-op` / `.notice-band` / `.seg` / `.take` classes. `editor.css`,
`editor-inspector.tsx`, `editor-timeline.tsx` and `dossier.css` were not opened.

---

## What shipped

### A1 — compare two versions (`lib/videos/compare.ts`, 18 tests)

`compareEdls(before, after)` → `{ rows, identical }`, deterministic, no model,
no metered call. Beats added / removed / **moved** / trimmed / re-sourced /
reframed / re-transitioned; captions added / removed / reworded / re-timed /
moved / restyled; music added / removed / swapped / re-aligned / re-levelled /
re-eased / mode-changed; the endcard's own three; and the output frame,
runtime, fps and picture mode.

Two decisions worth the lead's eye:

- **Matching runs through a longest-common-subsequence, not indices.** An
  index-wise diff calls every beat after an insertion "reordered" — true of the
  index, false of the edit. Pinned by a test: inserting one beat produces
  exactly one row.
- **A reworded caption is a `caption-text` row, not delete+add.** Lines carry
  no ids, so identity is inferred: anchor on identical text, then pair the
  leftovers in order. That is the single most common caption edit.

On the surface: a **compare state** behind the versioning band, drawn in the
proposal panel's own `.diff-panel`/`.diff-op` grammar (which is why A1 needed
no CSS — a proposal and a comparison are the same shape of fact). It diffs the
**working copy**, so mid-edit it answers "what have I changed since v5", and it
says when the unsaved edits are part of what is being shown. `identical` is
stated, never implied by an empty panel.

### A2 — save as a NAMED variant (UI only; the save door is untouched)

A name field on save. `planCutSave` already derives the version from the name,
so the same name is the next version (unchanged default) and a new name starts
a variant at v1. The band states which of the two the press will do **before**
it happens (`variantSaveNote`) — an existing name is that cut's next version,
not a fork, and that is easy to trigger by accident.

### A3 — delete a version (route + surface, 7 route tests)

`DELETE /api/videos/[projectId]/cuts/[cutId]` over the frozen
`videoCuts.remove`. The row goes first and the file second, deliberately: a
failed unlink leaves a nameless file, while the reverse would leave a version
claiming a render that is gone. The response reports the file half rather than
assuming it. **The working-copy preview (`cuts/previews/<cutId>.mp4`) goes too**
— it is addressed by the cut id, so nothing could ever name it again.

`InvalidStateError` → **409 with the repo's sentence verbatim** (mapped in the
route, not in the shared `http-errors.ts`, which is not this lane's file).

The surface **states the refusals before the press** (`deleteRefusalFor`
mirrors the repo's three, in the repo's order) and adds a fourth of its own:
deleting the version you are holding unsaved edits to throws the edits away
with it, which no server can see from a row. **None of them disables the
control** — it stays focusable, says `aria-disabled`, and answers in the notice
band when pressed (s81's standing lesson). The delete itself asks for
confirmation in the exit guard's grammar, and lands on the cut that is left.

### A4 — a render survives leaving the page

`listRunning(projectId)` on the registry + `GET …/render?running=1`. The
resume read is **tenancy-walled through the project** (a project id is not
authority); the `?jobId=` poll keeps its existing shape.

`RenderJobView` gained `kind: "render" | "preview"`, because the editor now
picks jobs back up and **a preview must never be adopted** — its unsaved EDL is
gone with the reload, and adopting it would land an unreproducible output on
the cut as its rendered version. The player states what is in flight in
versions, not job ids, and the claim **expires on its own** (a second poll
keeps the resumed list true; jobs read at load belong to renders this sitting
did not fire, so nothing else would ever clear them).

### A5 — audition a candidate take (the takes-strip half)

The frozen `<TakeAudition>` on every candidate **and on what is in the cut** —
a comparison by ear needs both sides. Nothing of the seam is re-implemented;
one-at-a-time coordination is its own.

The control sits **outside** the swap button (a button inside a button is not
markup a browser honours) as a sibling in the tile, inline on the caption row
so the resting strip does not grow a band. No audition is offered for a
`still` (nothing to play) or on a project with no media root on this box — an
always-failing play button is the dead door this session exists to stop
shipping.

### A6 — the editor.tsx-owned s78 tail

- **The player's failure state**: `onError` falls back to the rest state — where
  every fact about the cut and every verb that could fix it already live — and
  says what happened on the way. A fresh press clears it.
- **`busy` → `running: EditorVerb | null`**: one verb's work no longer disables
  every other. `Working…` became eight verb-specific sentences, and the
  `.finally` is scoped to its own verb so two doors in flight cannot hand each
  other's controls back early. Pinned by a test: with a render in flight,
  Propose and the aspect lens stay live.
- **Every duration through `timecode()`** — the header pill, the beats rail and
  the "planned" line now read in the scrub's own m:ss.t.

---

## Two things for the lead — both about the harness, not the product

**(1) The audition job will report a false `no affordance`.** `surface-jobs.mjs`
(the "choose between candidate takes" job) counts tiles as `button.take` and
then asks `t.querySelector("video, .play-btn, [aria-label*='play' i]")` — i.e.
it requires the audition control to be INSIDE the swap button. It cannot be:
interactive content does not nest, so the seam sits beside the button in the
tile. This is wrong-selector class #7 again (markup pinned instead of role).
The narrow fix, in the job:

```js
playable: tiles.filter((t) => {
  const tile = t.parentElement?.classList.contains("take") ? t.parentElement : t;
  return tile.querySelector("video, audio, .play-btn, [aria-label*='audition' i], [aria-label*='play' i]");
}).length,
```

The accessible name is `Audition take <file>` / `Stop auditioning <file>` (the
seam's own wording — I did not bend the copy to match a grep).

**(2) The resume job only measures anything while something is rendering.**
"check on a render after reloading the page" navigates away and back and looks
for an in-flight claim. With nothing rendering there is nothing true to say, so
it reports `no affordance` for a surface that has the capability. It needs to
FIRE a render first (or be `Undriven` when none is running).

**Geometry the render gate will see:** one new `.tl-foot` band (~40px) below
the timeline foot, carrying the three version verbs. Everything under the
timeline card — the takes strip — moves down by that much. The strip's own
resting height is unchanged (the audition control rides the existing caption
row); it grows only while an audition is actually playing.

## What I did not do

- **The `undriven` row** (a pending agent proposal) — needs a metered call.
  Out of scope by the kickoff, untouched.
- **No CSS, no contracts, no db, no harness edits.** The two harness findings
  above are reported rather than fixed, because `scripts/**` is not this lane's
  file set and a lane cannot drive its own work.
- I did touch `editor-safety-s80.test.tsx` — one assertion string, `rendered ·
  12s` → `rendered · 0:12.0`, a consequence of A6. It is one of editor.tsx's
  own tests.

## Gate

`npm run verify` **green by exit code** (redirected to a file and read, never
piped through `tail`): **2548 passed / 9 skipped**, 0 lint errors, typecheck
clean. Run as its three phases (`vitest run --maxWorkers=2` · `npm run
typecheck` · `npm run lint`), each gated on its own exit code — the box was
running three lanes' suites at once and the unbounded worker pool was being
killed under swap pressure.

**62 new tests**: 19 compare · 14 versions · 3 registry (`listRunning`) ·
7 delete route · 4 render route · 15 editor surface.

## One thing I broke outside my own lane, stated

Re-running the gate, I ran `pkill -f "vitest"` to clear my own stale run. On a
box with three lanes that is a **cross-lane weapon**: it matches every worktree
(there was a `sched-spine` vitest running at the time) and it even matched the
shell that was launching my own replacement run. If lane C saw an unexplained
test-run death around 12:35 UTC, that was me, not their code. Kill by PID, or
not at all, while lanes are parallel.
