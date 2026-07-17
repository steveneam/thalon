# NLE timeline UI patterns — survey → B-ve.6 track-view design brief

> Researched 2026-07-17 (s50, founder-directed: "what does a good video editor
> look like — Figma, Adobe, Mac, DaVinci, CapCut"). Survey first, then the
> design decisions mapped onto OUR contract physics. Companion to
> `video-editor-tools.md` (the tooling survey); this one is interaction design.

## 1. What the reference editors actually do

### Final Cut Pro — the magnetic timeline (Apple)
- **Trackless primary storyline**: the main clips form a CHAIN; insert/trim/
  delete makes everything downstream ripple automatically — gaps cannot exist
  by accident. Overrides are explicit (position tool, gap "slugs").
- **Connected clips**: titles/B-roll/music attach to a *moment of the story*
  (a frame of a primary clip), not to absolute timecode — move the story and
  the connected media rides along. Visual media connects above the spine,
  audio below.
- **Keyboard trimming** (`⌥[`, `⌥]`) with live ripple.
- Criticism on record: connection points demand attention; pros coming from
  tracks miss free placement.

### Adobe Premiere Pro — the track standard
- Video tracks stack above, audio below; free clip placement, collisions and
  gaps are the editor's problem. Tool-modal editing: Selection (V), Razor (C),
  Ripple (B), Rolling, Slip, Slide; snapping toggle (S); track targeting for
  keyboard navigation (↑/↓ jump edit points).
- The convention library everyone knows: ruler on top, playhead, in/out
  points, edge-drag trim with tooltip deltas.

### DaVinci Resolve — the refinements
- **Smart trim tool**: ONE tool that becomes ripple/roll/slip/slide from
  cursor POSITION on the clip (upper/lower half, edge/body) — mode from
  geometry, not from a toolbar hunt.
- Snapping on `N`, `Shift+Z` = fit-timeline zoom, `⌘±` zoom, per-track
  height options, waveforms toggleable on audio tracks.

### CapCut — the social-operator baseline
- Timeline-first layout at the bottom; stacked lanes for video / text /
  audio / effects; tap a clip → white trim handles on its edges; drag body to
  move, drag edge to trim; properties panel on the right edits the selected
  chunk. This is the grammar our tenant operators already know.

### Canva / Descript — the web simplifications
- Canva: drag-and-drop chunks, rounds to ~0.1s — *snappy over surgical*
  (frame-precision sacrificed for responsiveness). Descript: the timeline is
  a PROJECTION of a text transcript — a reminder that the timeline need not
  be the only editing surface (our Assist panel already edits by ask).

### Figma — the interaction-quality bar (not an NLE)
- Direct manipulation with live numeric readouts; zoom-to-cursor; smooth
  transform-based drags; keyboard nudge; snap guides that APPEAR as you
  approach; `Esc` cancels a drag losslessly. The bar for "feels professional."

## 2. The central mapping: our EDL is a magnetic timeline, not tracks

The B-ve.1 contract's beat lane derives every offset from durations
(`offset_k = offset_{k-1} + dur_k − fade_k`); clips cannot be freely placed
and gaps cannot be expressed. **That IS Final Cut's primary storyline, not
Premiere's tracks.** A free-placement track view would lie about the
contract; a magnetic one renders it truthfully — reorder ripples, trims
ripple, nothing collides.

One honest divergence: our captions and music carry ABSOLUTE times (the
contract), so they do NOT ride their beat the way FCP connected clips do. The
track view must show that truth (chips on their own lanes at absolute
positions). If clip-anchored captions are ever wanted, that is a contract
window question, never a view-layer trick.

## 3. B-ve.6 design decisions (each traceable to a reference)

1. **Magnetic beat lane** (FCP): chunks with width ∝ duration at derived
   offsets; xfade overlaps drawn as overlapped edges. Drag a chunk
   horizontally → REORDER with live ripple preview (drop between neighbors).
   No gaps, no collisions, ever.
2. **Edge-drag trim** (CapCut/Premiere): right edge = `duration`; left edge =
   trim-start (`in` += d, `duration` −= d — the classic trim, mapped to the
   existing `trimBeat`). Live delta readout in seconds (measured doctrine).
3. **Lanes stacked FCP-style**: captions ABOVE the beat spine, music BELOW.
   Caption chips span fadeIn→fadeOut; drag body = move the fade window
   (`patchCaptionLine`); music block drags `offset` (encode mode only — copy
   stays honestly locked, the B-ve.3 precedent); waveform paints the music
   block (wavesurfer, already a dependency).
4. **Endcard as a connected block** (FCP): the overlay-fade clip renders
   above the spine tail with a draggable freeze-boundary marker (`at` →
   `setOverlayAt`).
5. **Ruler + playhead + zoom** (Premiere/Resolve): px-per-second zoom
   (`⌘±`-equivalent buttons + fit), click-to-place playhead; when the cut has
   a rendered output, the playhead scrubs the guarded <video> preview.
6. **Snapping** (Resolve/Premiere): toggleable; snap targets = beat
   boundaries, caption fade edges, the endcard `at`, the playhead.
7. **Figma-grade feel**: transform-based drag (no re-layout per frame), live
   numeric readouts near the pointer, `Esc` cancels a drag, keyboard nudge on
   the selected chunk, snap guides appear on approach.
8. **Selection unifies with the inspector**: clicking a chunk selects the
   clip/caption/cue and the EXISTING right-rail inspector (trim fields, frame
   composer, swap picker, caption fields, music knobs) edits it — chunks and
   NumFields write the same pure transforms. The track view replaces the
   vertical Timeline LIST; nothing else moves.
9. **Web restraint** (Canva lesson, inverted): stay snappy AND surgical —
   drags quantize to 0.001s (the contract's `fmt` precision), never 0.1s.
10. **Every gesture = an existing pure transform** (`reorderBeat`, `trimBeat`,
    `patchCaptionLine`, `patchMusic`, `setOverlayAt`, `setOutputDuration`) —
    the view proposes, the transform disposes, the compiler caps still refuse
    at the door. Zero contract change; zero new mutation paths.

## 4. Out of scope for B-ve.6 (recorded so they don't creep)

- Free clip placement / multi-track video (the contract has one beat lane +
  one overlay by design; more lanes = a future contract window).
- Razor/split (a new EDL op — contract window question).
- Clip-anchored (connected) captions — contract window question (§2).
- Frame-stepping preview of unrendered EDLs (needs a preview compiler seat;
  mediabunny stays the upgrade path per ADR-0010).
- Audio mixing beyond the contract's static gain + easings.

## Sources

FCP magnetic timeline: [Apple support intro](https://support.apple.com/guide/final-cut-pro/intro-to-the-magnetic-timeline-verb8fcfc133/mac) · [frame.io interaction analysis](https://blog.frame.io/2017/10/16/fcpx-magnetic-timeline/) · [Jonny Elwyn on FCPX](https://jonnyelwyn.co.uk/film-and-video-editing/understanding-the-fcpx-magnetic-timeline/) — Premiere: [timeline anatomy](https://coursehorse.com/blog/learn/premiere-pro/the-anatomy-of-the-premiere-pro-timeline-and-layers) · [trim tools](https://helpx.adobe.com/nz/premiere-pro/using/trimming-clips.html) · [track targeting](https://helpx.adobe.com/premiere/desktop/edit-projects/intro-to-editing/work-with-clips-on-the-timeline-using-track-targeting.html) — Resolve: [UO timeline guide](https://blogs.uoregon.edu/uocinetech/tutorials-and-guides/software-tutorials/davinci-resolve/working-on-the-timeline-in-davinci-resolve/) · [trim edit mode](https://dvresolve.com/tutorial/rippling-timeline-trim-edit-mode/) — CapCut: [timeline guide](https://filmora.wondershare.com/advanced-video-editing/capcut-timeline.html) · [interface patterns](https://spliceapp.com/blog/capcut-style-timeline-editing-editors/) — Web editors: [Canva timeline precision](https://designertofullstack.com/mastering-the-canva-video-timeline-how-to-zoom-for-precision-edits/) · [Descript vs Canva](https://www.descript.com/compare/descript-vs-canva)
