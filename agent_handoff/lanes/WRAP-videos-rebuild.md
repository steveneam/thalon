# WRAP — lane `videos-rebuild` (the last three sheets)

**All three sheets shipped, two-step each. `npm run verify` GREEN at the repo
root: guard PASS · 2068 passed / 9 skipped (285 files) · typecheck clean ·
lint 0 errors (8 pre-existing warnings, none in this lane's files).**

Branch `agent/videos-rebuild`, seven commits off `main`:

| commit | what |
|---|---|
| `76573e2` | rebuild(videos-overview) step 1 — pure port |
| `e8c3bbe` | rebuild(videos-overview) step 2 — wired; `video-projects.tsx` deleted |
| `2f57946` | rebuild(video-dossier) step 1 — pure port |
| `cf9e777` | rebuild(video-dossier) step 2 — wired; `project-browser.tsx` deleted |
| `b87d585` | rebuild(video-editor) step 1 — pure port |
| `4ef672d` | rebuild(video-editor) step 2 — wired; the whole old editor deleted |
| `5cf26b8` | fix — the music waveform keeper re-enters behind the cue block |

The surface is now nine files where it was nine before, and none of them
carries a bridged token:

```
components/videos/  videos.tsx · videos.css · videos-model.ts
                    dossier.tsx · dossier.css
                    editor.tsx · editor.css · editor-timeline.tsx
                    editor-inspector.tsx · editor-model.ts
```

---

## What shipped, per sheet

### 1. Videos Overview → `/app/videos`

The headline row (count pill · state segmented control · Import media · +
New video) · the dashed bring-your-own band · the three-column project grid ·
the new-project tile · the closing record line.

Every card speaks for its **headline cut** — the furthest-along one, newest
on a tie — so the state pill, the runtime badge and the provenance stamp can
never describe different cuts. The family line carries versions · aspect
cuts · takes; the segmented control filters on the same cut the pill names.
`+ New video` opens Create's video family.

### 2. Video Dossier → `/app/videos/[projectId]`

The title row · the attributed **version strip** · the player over the aspect
band · **The record** · the closing line.

Each version chip names what changed it, read from the attribution the save
door already stamps at `meta.attribution` (see the read-model note below).
The player keeps the sheet's resting chrome and reveals the real rendered cut
on play. The aspect band is the derived cuts of the picked version with their
real B-ve.5 lineage and honest staleness. "Send cut to Approve" is the real
judge-gated transition, and a refusal is shown verbatim, per line.

### 3. Videos (the editor) → `/app/videos/[projectId]/edit`

The title row with the aspect lens · the **copilot** band · the player · the
timeline card (proposal row + three lanes + playhead + snap + zoom) · the
takes strip · the beats rail.

The copilot is the real propose door: the agent answers with a diff, the diff
lands **on the timeline** as the sheet's `.prop` marks, and nothing applies
until the operator says so. Dismiss takes the reason with it. The timeline is
the EDL — magnetic reorder, edge trims, caption plates at their real fade
windows, the music cue at its measured offset, Esc cancelling a drag
losslessly.

---

## Every keeper's fate

| Keeper | Fate |
|---|---|
| **Multi-track EDL editor** (magnetic reorder · edge trims · snap · Esc-cancel) | **Re-entered whole** in `editor-timeline.tsx`. None of it was ever pixels: the same pure seconds-math in `lib/videos/track-view.ts`, projected in percent of the track instead of px/sec, so a lane can never disagree with the card it sits in. |
| **Version rail** | **Re-entered** as the dossier's version strip — and it gained what the old rail never had: each version's attribution. |
| **Takes + rejects-with-reasons** | **Re-entered twice**: as the editor's takes strip (the slot-scoped swap, keepers first, every reject leading with its reason) and as the dossier's takes panel behind the record's Runs row. |
| **Per-take pinned provenance** | **Re-entered** in that dossier panel, following the picked take. |
| **Assist panel** (agent diff · Apply · Reject-with-reason → eval row) | **Re-entered** as the sheet's own copilot + proposal row. Reject became the sheet's "Dismiss", which opens the required reason field before it records the correction. |
| **Music lane** (measured alignment, s44) | **Re-entered** behind the cue block: drag-to-offset on the lane, and the wavesurfer waveform + audition + gain/tail knobs in the inspector. This was reduced to numbers at first and caught in the same session (`5cf26b8`) — the waveform is the method, not decoration. |
| **Frame composer** (B-ve.5/7 crop/pan) | **Re-entered** as the inspector's Reframe section, ported to the sheet's classes: the same draggable source-pixel window over the real take, the same `lib/videos/frame` math, expression pans still shown as data and never dragged. |
| **`NumField` commit-on-blur** | **Re-entered** as the inspector's own `Field`, in the sheet's language. |
| **`VideosSubnav`** (Project/Editor tabs) | **Deliberately retired** — the sheets carry the doors inline (the dossier's "Open in editor", the editor's "← project" and "Cut history →"), so a tab rail is chrome the sheets don't draw. |
| **`EmptyArt` illustrations** | Untouched (`components/ui/`), not deleted — the video empty states speak in the sheets' own rows for now. |
| **Storyboard cards / staged-flow multi-stage UX** | **FLAGGED, not touched** — see "Above this lane's pay grade". |

---

## Every honest deviation, with its reason

Each is a backend gap, not a design choice.

**Videos Overview**
1. **The state pill says `draft` · `rendered` · `approved`** — the contract's
   own transition order. The sheet's fixture says "published" / "live on 3";
   nothing carries a video to a platform, so those would be invented states.
2. **No platform facts on any card.** The sheet's family line has four
   dimensions and this engine records three. Rather than implying zero on
   every card, the surface says it once, in the sheet's own closing line.
3. **The poster is the striped placeholder** (founder s75: *"also have
   placeholder until bmedia ready"*). A poster frame derived from video is not
   built; no card fabricates one.
4. **Both import buttons open a disclosure, not an upload.** There is no
   browser upload door — media enters through `npm run videos:import`. The
   panel names the command and the tree shape rather than offering a file
   picker that would do nothing.
5. **A card's record is read per project.** `/api/videos` carries names and
   counts but no status or duration, so the grid does one detail read per
   project (the same shape `listProjectSummaries` already uses server-side, at
   browse scale). A counts/status column on the list door retires this — a
   contract-window candidate, below.

**Video Dossier**

6. **Grounding and Published name their missing joins.** No grounding record
   exists for video projects, and no publish path carries video to a platform.
   Both rows say so instead of showing a fabricated count.
7. **Only "Runs" wears the door arrow.** The sheet's band says "every fact is
   a door"; five of the six have nothing to open, so they don't pretend to.
8. **No platform chips on an aspect cut.** Same missing join as (2).
9. **The derive verb is not duplicated here.** The aspect lens belongs to the
   editor's own 16:9/9:16/1:1 control, so this band's button is a door to it.

**Videos (the editor)**

10. **The sheet's three crescendo diamonds are not drawn.** An `AudioCue`
    records offset, gain and tail easing. Nothing measures crescendos, so
    drawing them would be an invented fact — the one place the sheet asks for
    data the engine has never had.
11. **The sheet draws ONE primary button, and this is that button in whichever
    state the cut is actually in** — `Save as vN+1` while dirty, then
    `Render`, then `Send cut to Approve`. Save and Render have no chrome of
    their own in the sheet; giving them buttons would have grown the band.
12. **The "+ retake" tile is absent.** No retake door exists, and a dead tile
    would promise one.
13. **The endcard overlay is a dashed tail marker across the beat lane**, not
    a block beside the beats: it starts at its own freeze boundary and holds
    to the end, so a sibling block would misdraw the time it overlaps.
14. **Zoom past "fit" scrolls the lane body.** The sheet's `−/fit/+` control
    needs px to mean anything on a proportional lane; at "fit" — the resting
    state — nothing scrolls and the geometry is the sheet's exactly.

---

## Pin-file deltas

- **`bridge-burndown.test.ts`** — all nine `components/videos/*` rows removed
  (**155 bridged tokens burned**: assist-panel 20 · cut-editor 33 ·
  frame-composer 12 · music-lane 5 · num-field 6 · project-browser 35 ·
  track-view 30 · video-projects 8 · videos-subnav 6). The rebuilt surface
  sits at **zero**.
- **`mono-ratchet.test.ts`** — all five `components/videos/*` rows removed
  (**9 violations burned**: cut-editor 2 · frame-composer 1 ·
  project-browser 4 · track-view 1 · video-projects 1).
- **`selected-row.test.ts`** — **no delta**. Videos was never in
  `SELECTION_SURFACES`; the rebuilt surfaces mark selection with the sheets'
  own `.row.sel` / `.blk.on` / `.beat-row.on`, so nothing needed removing.
- **`surface-css-scope.test.ts`** — three new stylesheets, every rule anchored
  under `.videos-surface` / `.dossier-surface` / `.editor-surface`. Rule 6's
  named collisions are all live here and all held apart:
  `.prov` (Intel ≠ Overview) · `.ver-strip` (Approve ≠ Dossier) ·
  `.thumb-sm` (dossier OVERRIDES the shared 64×40 to 52×33) ·
  `.strip` / `.play-btn` / `.play-tri` / `.thumb-md` (dossier ≠ editor, every
  one a different value).

**One read-model change, inside the lane's file set and no further:**
`lib/videos/types.ts` + `lib/videos/queries.ts` now project `attribution`
onto `CutView`/`CutDetail`. The save door has always stamped it at
`meta.attribution` (never trusting the client) — the read layer simply never
surfaced it, which made the dossier's "attributed — every version names what
changed it" band unrenderable. No API route, contract, db or engine code was
touched; the routes serialize whatever `queries.ts` returns.

---

## Above this lane's pay grade — for the lead / the founder

1. **The staged-flow keeper has no band in any of the three sheets.** The
   keepers inventory assigns "staged-flow multi-stage video UX (candidate
   picker, direction editor, storyboard)" to *Videos step 2*, but Videos
   Overview, Video Dossier and Videos all draw a one-prompt world — no stage
   rail, no storyboard, no candidate picker. Porting the bytes means no such
   band, so I did not invent one. `components/staged/*` is **untouched and
   currently unmounted** (nothing outside that folder imports it; Create
   shipped s74 with a door only). That is a founder call: either a fourth
   sheet, a state behind one of these three, or a deliberate retirement.
2. **A counts/status column on `/api/videos`** would retire the overview's
   per-project record read (deviation 5). Contract-window candidate.
3. **The judge's video gate is caption-only.** "Send cut to Approve" runs the
   caption denylist; nothing gates the picture. Worth naming before a video
   ever publishes.
4. **`wavesurfer.js` survived** because the waveform keeper came back — had it
   not, deleting `music-lane.tsx` would have left the dependency with no
   consumer. Nothing to do; noted so the next audit doesn't puzzle over it.
5. **The impeccable design hook flags 19 findings across the three
   stylesheets, all of them the sheets' own bytes** — the players' letterbox
   `oklch(0.1 0.008 262)`, the 4px badge/thumb radii, the 11.5px clip caption,
   and the 1px accent rings on `.ver.on` / `.blk.on` / `.take.on` (read as
   "side-tab accent borders"). DOCTRINE 0 says the sheet's bytes win, so I
   left every one of them and did not add ignore entries — silencing them is
   a founder/lead call, not a lane's.

## What the lead should gate on

A screenshot-vs-sheet diff of all three surfaces at 1440×940. Note that
`next dev` cannot run inside a worktree lane (Turbopack rejects the
out-of-root `node_modules` symlinks), so the three surfaces have **not** been
rendered in a browser from this lane — the port is byte-faithful by
construction and pinned by structural tests, but the screenshot gate is
genuinely still open and is the lead's to close on merged `main`.

Useful states to walk: a project with no cuts (overview card + dossier empty
row), a derived cut whose parent has moved on (staleness chip), a cut with an
endcard overlay (the dashed tail marker), and a proposal in flight (the
`.prop` marks on the timeline).
