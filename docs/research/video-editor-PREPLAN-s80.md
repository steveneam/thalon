# PRE-PLAN — the video editor full build-out (s80)

> The PREPLAN.md artifact class (⑯, s62): decide before code, in writing, so the
> build has something to be held to. Spec = `video-editor-audit-s78.md`
> (36 findings). Definition of done = the 27-job table, now executable as
> `node scripts/drive-surface.mjs --jobs editor`.

## 0. The two numbers this session starts from

Both measured today, both first-of-their-kind for this surface.

| gate | measured | how |
|---|---|---|
| **jobs** | **27 jobs: 6 works · 3 dead doors · 14 no affordance · 3 console · 1 undriven** | `drive-surface.mjs --jobs editor` |
| **render** | **48 sheet classes: 10 missing · 38 drifted · 0 within ±2px · 8 app-only** | `measure-sheet.mjs --route … --sheet Videos.dc.html` |

The s78 walk read 8 work · 4 dead · 15 gap. Driving says 6/3/14 (+3 console,
+1 undriven). The differences are explained, not waved at: the walk had no
console lens; three jobs score reachability rather than execution because
pressing them spends (Propose, Send-to-Approve) or writes rows (Save, derive);
and one job is undriven because no proposal is pending on the fixture.

**Three of the harness's own first verdicts were false and were corrected before
the baseline was believed** — `.playhead` measured against itself, the copilot
CHIP counted as a music-swap verb, and a 1-beat cut with no captions chosen as
"the cut with audio". That is the fourth, fifth and sixth wrong selector this
harness has produced (`jobs-table-s79.md` records the first five). The lesson
holds and is now in the file beside each fix: **read the element the defect
lives in, and exercise the row that exhibits it.**

## 1. THE CONTRACT-WINDOW QUESTION — answered first, because windows freeze

**Answer: NO new schema. No window needs to open for this session.**

Checked against the contracts rather than assumed:

- **Undo / redo** — a bounded stack of previous EDLs in component state over the
  one working copy the editor already keeps. One dirty bit, one working copy.
  Client-side only. *No schema.*
- **Unsaved-work guard** — `saveCut` is already live (`lib/videos/client.ts`),
  so Save / Discard / Stay needs no new door. *No schema.*
- **Insert / delete a beat, insert / delete a caption** — `edl.video` and
  `edl.captions.lines` are arrays in `video-project.ts`; adding and removing
  entries is data, not shape. *No schema.*
- **Swap the music track** — this is the one that could have needed a window,
  and the answer turns on WHICH bridge is taken. `edl.audio` is already
  `z.array(audioCueSchema).default([])`, and `AudioCue.source` is a
  `videoSourceRefSchema` — a **project-relative ref**. So a swap that chooses
  among the project's own `music-candidates/` takes pushes a cue into an
  existing array against the existing contract. *No schema.*
  The **other** bridge — pointing a cue at a stored bed, which is addressed by
  **sha** and not by a project ref (`WRAP-media-lane-b.md`, "what I deliberately
  did not do") — WOULD need a contract change, and is therefore **not the route
  this session takes**. Recorded as the reason, so the next session does not
  re-derive it.

Two facts from lane B that this build rests on, verified in the code today:
`edl/compile.ts:lowerAudioCue` **already** muxes an `AudioCue` into the ffmpeg
argv, so the editor's render path was never silent by omission; and `patchMusic`
only patches an existing cue, which is exactly why a one-prompt cut can never
acquire music. The missing verb is **add**, not the plumbing under it.

## 2. Build order

Slices are mergeable. Each lands verified — full suite gated on its exit code,
the jobs table re-driven, the render re-measured — before the next begins. If
the session runs long, what has merged is coherent and the rest rolls to s81.

### (a) THE SAFETY CORE — first, because everything else edits a working copy that can currently be lost silently

1. **Undo / redo spine.** `apply()` is the single funnel for every manual edit
   (drag reorder, edge trim, per-character caption patch, take swap, music
   knobs), and it only ever pushes forward. A bounded past/future stack behind
   it, with ⌘/Ctrl+Z and ⇧⌘/Ctrl+Y bound — noting `lib/workspace/keyboard.ts`
   deliberately ignores modifier keys, so this needs its own binding rather than
   the shared list grammar.
2. **Unsaved-work guard on every exit.** Three plain `<Link>`s (`← project`,
   `Cut history →`, `All takes →`), the rail, and the back button all discard a
   dirty working copy with no word. Save / Discard / Stay.
3. **The honest player.** While dirty the player shows the PREVIOUS render with
   only an "unsaved" pill. It must say which render it is showing.

### (b) THE BLOCKER — keyboard-reachable timeline blocks

The three block types are real `<button>`s with `aria-pressed` and focus rings
carrying **only `onPointerDown`**, so Enter/Space is a silent no-op — and
selecting a plate is the ONLY entry to the caption and music inspectors. Driven
and confirmed today. The suite masks it because `user.click` synthesizes
pointerdown; the new test fires `{Enter}` on a focused plate.

### (c) THE MISSING VERBS

insert / delete a beat · insert / delete a caption · swap the music track (per
§1) · preview the working copy. The preview is a **local** render (hyperframes
+ the ffmpeg now in the image) — compute, not credits, not a platform call — so
it is inside the sequence gate by the founder's own line: draw the line where
the money is, not wider.

### (d) THE 36 FINDINGS, folded in where they touch the same code

Prioritised by the render gate, which found they are not 38 separate problems:
**`.copilot` renders 60px against the sheet's 79** (its wrapping `.cop-box`
became a single-line `<input>`, 57px → 38), and every band below it is shifted
**exactly −19px** — player top y=188 vs the sheet's 207. One fix retires ~20
drift rows. `.strip` is the other named one: 110px reserved in the sheet, 39 in
the app, which is also the "selecting a beat jumps the page 260px" finding.

### (e) COPILOT HONESTY

Four chips spend a metered call to be refused. Wire them or say so. Reachability
only this session — the gate stands.

## 3. Lane stance

**LEAD-DIRECT, no lanes.** The editor is one tightly-coupled file set
(`components/videos/editor*.tsx` + `/edit`), the work is design-heavy, and two
lanes in one component tree buy conflicts rather than speed. No genuinely
disjoint engine seam surfaced in the pre-plan: the EDL operations are small and
live beside the component that calls them. Any lane would still need fresh
founder approval, per named run.

## 4. Out of scope, stated so it is a decision

- Any publish path (sequence gate).
- The stored-bed **sha** bridge (§1) — it is the one thing here that would open
  a contract window.
- The 139 s77 mediums+lows (s81+, re-DRIVEN not re-read).
- Transcription's free-tier flag + AI button (s81+, his sequencing).

## 5. One finding the pre-plan itself produced

The cut the editor opens is **`project.cuts[0]`** — whatever the detail query
returned first. Not the master, not the latest, not the furthest along. On the
concept film that is a 1-beat scored master with no captions and no music, which
is why the harness now resolves a richer cut explicitly (founder call: "can make
the one with the music the default"). **The arbitrary default is a real defect**
and belongs in slice (d): the editor should open a cut on a stated rule.
