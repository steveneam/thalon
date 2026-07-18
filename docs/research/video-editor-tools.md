> **Status: historical** — fed the B-ve charter (ADR-0010, window complete). (Marker added at the s61 hygiene pass; see docs/research/README.md.)

# B-video-editor — open-source tooling survey + integration shape

> Research for the **B-video-editor charter candidate** (founder ask, session 44:
> "basically a video editor" in-app; re-affirmed session 45 with the direction that
> AI may assist the editing *or* the operator does it manually — moving music,
> scenes, captions around). No feature code rides this doc (AGENTS.md rule 1);
> it exists so the re-charter conversation starts from verified facts.
> License/status facts verified against upstream sources **2026-07-16**; licenses
> drift — re-verify at charter time.

## 1. What exists vs. what's missing

**Exists (shipped product):** the staged video *creation* flow — B5.2 stages
`structure`/`scenes`/`polish` + B5.4 UI (one-prompt & advanced modes,
direction.md), deterministic SRT/timeline derivation in core, Hyperframes
(Apache-2.0) as the default render driver behind the render seam, ffmpeg as the
local assembler of record, B7.1 asset pinning with provenance manifests.

**Missing:** any *editing* surface over a finished project — scene/beat
timeline, take swapping from keepers/rejects, music-cut alignment, caption
layer manipulation, trims/extensions, aspect recuts.

**The manual prototype is on record.** Sessions 42–45 hand-built every
operation such an editor would automate, and the concept-film project tree is
the founder-directed reference shape for the in-app video-project contract
(deterministic names, keepers/rejects with reasons, provenance pinned per mint,
versioned cuts, measured QA). The editor's verb set, extracted from that
ledger:

| Verb (proven manually) | Evidence |
| --- | --- |
| Assemble beats with transitions | v1–v3 rough cuts (xfade chain; overlay+alpha-fade for stills at trim boundaries — xfade is brittle there) |
| Per-beat grade | night-beat eq pass, warm interiors untouched |
| Take swap from keepers/rejects | six s43 retakes, reasons on record |
| Trim / clone-extension | +5s sheet hold (churn-measured static ⇒ frame-clone = longer hold) |
| Caption layer (plates, placement, fade windows) | build-captions recipe, per-beat placement table |
| Title/endcard ops | endcard v2 type-matched local edit + overlay-fade dissolve |
| Music placement, measured | RMS-envelope map + window scorer over every offset; static gain only; anti-click tail easing |
| Aspect recomposition | 9:16 recut: per-beat crop/pan toward focal objects + caption re-place + same score, 0cr (recipe `build-9x16.sh`) |
| QA as measurement | tblend-YAVG churn audits, envelope re-measure after mux |

Two hand-written recipes (`build-captions.sh`, `build-9x16.sh`) are, in effect,
compiled *edit decision lists* — the productization is a schema + compiler, not
a new idea.

## 2. Survey — candidates by seat

### Timeline/EDL data model

| Tool | License | Verdict |
| --- | --- | --- |
| **OpenTimelineIO** (Academy Software Foundation) | Apache-2.0 | **Adopt the schema shape, not the library.** Industry interchange format for editorial timelines (tracks → clips w/ source refs, in/out, transitions, markers). Official bindings are C++/Python/Swift/Java; the JS bindings are explicitly work-in-progress. We define an OTIO-shaped JSON schema in `packages/contracts` (zod, tenant-scoped) and keep a `.otio` export seam as a later door into pro NLEs. |

### Deterministic render/assembly engine (server-side, 0 vendor credits)

| Tool | License | Verdict |
| --- | --- | --- |
| **ffmpeg** (CLI invocation) | LGPL/GPL (unmodified binary, process boundary) | **Keep — assembler of record.** Every editor op above already compiles to a filtergraph. |
| **Hyperframes** | Apache-2.0 | **Keep — default render driver** (B5.1 decision). Natural seat for HTML-native layers (caption plates, title blocks, endcards) if we outgrow magick-drawn plates. |
| MLT / GStreamer Editing Services | LGPL | Desktop-NLE engine class (Shotcut/Kdenlive). Nothing they add over direct ffmpeg for our op set; reference-only. |
| MoviePy | MIT | Python convenience over ffmpeg; wrong runtime for us (TS engine), adds nothing over the compiler we'd write. |
| Editly (declarative JSON→ffmpeg edit specs) | MIT | Unmaintained; but its *edit-spec JSON → filtergraph* pattern is exactly our recipe-compiler direction. Pattern reference only. |
| **Remotion** | Source-available, company license; automation tier $0.01/render, $100/mo minimum | **Stays ruled out for the hot path** (commercial gate; consistent with its B5.1 demotion to swap path). |

### In-browser preview + editor UI

| Tool | License | Verdict |
| --- | --- | --- |
| **WebCodecs** (browser API) | n/a | The modern preview path: decode keeper proxies client-side for frame-accurate scrubbing without a server round-trip. |
| **mediabunny** | MPL-2.0 | Pure-TS, zero-dependency browser media toolkit (demux/mux/transcode over WebCodecs). Strongest library candidate for client-side preview/scrub and draft exports. MPL = file-level copyleft: use **unmodified**, isolated behind a clean interface (licensing-hygiene rule); any fork would have to publish its changes. |
| **OpenCut** (opencut-app) | MIT | The open-source CapCut alternative (~48k stars). Being rewritten ground-up: Rust core (desktop/mobile/browser from one codebase), plugin-first, **planned headless mode (automation/batch rendering) and MCP server for AI agents** — the roadmap that most overlaps our needs. Rewrite is explicitly early-stage and closed to outside contributions; classic version (Next.js) still runs opencut.app. **Watch item + UI-pattern reference; not a drop-in today.** Their timeline UX patterns are MIT and studiable. |
| FreeCut / OpenReel / Omniclip / vue-video-editor | MIT (FreeCut, OpenReel claim; Omniclip license unverified) | 2025-26 wave of browser-local editors on WebCodecs/WebGPU — useful pattern references for multi-track timeline + local-first media handling. Verify licenses individually before lifting anything concrete. |
| **wavesurfer.js** | BSD-3 | Waveform rendering for the music lane. Our s44 RMS-envelope/window-scorer output overlays it — the measured-score method becomes *visible* UI (candidate crescendos marked on the waveform against the beat arc). |

### AI-assist seats (optional, per founder direction)

| Tool | License | Seat |
| --- | --- | --- |
| **Thalon's own agent** (director/editor seat, s43 standing directive) | — | The primary "AI edit" mechanism: the agent emits **EDL diffs** (score alignment candidates, caption placements, crop windows, take swaps) against the same contract the manual UI edits — never bytes. s44/s45 proved every op deterministically; the agent proposes, the operator approves. |
| **auto-editor** | Public domain (Unlicense) | Silence/motion-based rough cuts for *ingested* footage (client material, talking-head sources) — a cheap first-pass suggester. |
| **PySceneDetect** | BSD-3 | Shot/scene boundary detection on ingested footage → auto-populate the beat lane. |
| whisper / faster-whisper class | MIT | Already covered by the transcript-provider seam — enables Descript-style **text-based editing** (cut the transcript, the timeline follows) as a later rung. |
| Seedance multi-shot (vendor, metered) | commercial | Stays the *creative-elaboration* seat for generative motion (s43 directive) — that's creation, not editing; edit operations themselves stay 0cr local. |

## 3. Integration with the Thalon engine (the shape that fits)

```
video-project contract (tenant-scoped, = the film-tree reference shape)
  assets: pinned originals + provenance (B7.1)        [exists]
  takes:  keepers/rejects + reasons                    [formalizes s43 layout]
  cuts:   versioned outputs + the EDL that built each  [formalizes recipes]
  EDL:    OTIO-shaped JSON in packages/contracts       [new: the one new schema]
            tracks: video(beats→takes, transitions, crop/pan, grade)
                    audio(music cue: source+offset+static gain+easings)
                    captions(lines, plates params, placement, fade windows)

engine (packages/engine): EDL compiler → ffmpeg filtergraph → deterministic
  render behind the existing render-driver seam (ffmpeg assembly; Hyperframes
  for HTML-native layers). Golden tests replay the 16:9 master and the 9:16
  recut from checked-in EDLs — the two hand recipes become executable fixtures
  (ratchet: the strongest rung, it runs).

workspace UI (apps/web, light register): timeline surface over the EDL —
  beat lane w/ take-swap (keepers/rejects with reasons inline), trim/extend,
  caption lane (drag placement, live plate preview), music lane (wavesurfer +
  measured-envelope overlay + scorer-found alignment candidates), aspect lens
  (per-beat crop-window handles → 9:16/1:1 recut = new EDL, same takes).
  Preview: WebCodecs/mediabunny proxy scrub client-side; full render server-side.

AI-assist: agent proposes EDL diffs through the SAME door the UI writes —
  diff view → operator approve (Approve-queue grammar). Caption/text layers
  pass the judge harness (denylist + grounding) before any cut can be marked
  approved — an edited caption is content like any other draft (invariant).
  Every applied diff is replayable + attributed (operator vs agent) — and the
  correction stream feeds the eval suite (rule 6) exactly like fan-out edits.
```

Why this composes cleanly: the engine already has the one-status-writer
pattern, the judge gate, the render seam, provenance pinning, and per-tenant
config — the editor adds **one schema (EDL), one compiler, one surface**, and
reuses everything else. Nothing vendor-metered sits on any edit path.

## 4. Recommended charter shape (for the founder's re-charter call)

1. **B-ve.1 — contract window:** video-project + EDL schemas (OTIO-shaped) +
   EDL→filtergraph compiler with golden tests that rebuild the concept film
   (16:9 + 9:16) byte-stable from EDL fixtures.
2. **B-ve.2 — project surface (read-only):** browse takes/cuts/provenance in
   the workspace; reject reasons visible (the learning material).
3. **B-ve.3 — timeline editor MVP (manual first):** reorder/trim/take-swap/
   caption moves/music offset + waveform lane; server render; versioned cuts.
4. **B-ve.4 — AI-assist:** agent-proposed EDL diffs (music alignment + caption
   placement first — the ops we've measured), approve flow, judge gate on text.
5. **B-ve.5 — aspect lens:** crop/pan handles per beat; vertical/square recuts
   as derived EDLs (never vendor reframe — s44 invariant, 225cr vs 0cr).

**Adopt:** OTIO schema shape · ffmpeg+Hyperframes (already ours) ·
wavesurfer.js (BSD-3) · mediabunny (MPL-2.0, isolated) for preview ·
auto-editor/PySceneDetect as ingest-side suggesters when client footage
arrives. **Watch:** OpenCut's Rust core + headless/MCP APIs (MIT) as a
possible future preview/engine swap. **Ruled out on the hot path:** Remotion
(commercial gate), anything AGPL, any vendor-metered edit op.

## Sources

- [OpenCut repo](https://github.com/opencut-app/opencut) · [OpenCut classic](https://github.com/opencut-app/opencut-classic)
- [OpenTimelineIO](https://github.com/AcademySoftwareFoundation/OpenTimelineIO) · [OTIO JS bindings (WIP)](https://github.com/JeanChristopheMorinPerso/OpenTimelineIO-JS-Bindings)
- [mediabunny](https://github.com/Vanilagy/mediabunny) · [mediabunny.dev](https://mediabunny.dev/)
- [wavesurfer.js](https://github.com/katspaugh/wavesurfer.js)
- [auto-editor](https://github.com/wyattblue/auto-editor)
- [Remotion license](https://www.remotion.dev/docs/license) · [pricing](https://www.remotion.dev/docs/license/pricing)
- [FreeCut](https://github.com/walterlow/freecut) · [OpenReel](https://github.com/Augani/openreel-video) · [Omniclip](https://github.com/omni-media/omniclip)

---
*v1, 2026-07-16 (session 45). Owner: lead. Feeds the B-video-editor charter
decision; supersede at charter time with the ADR if chartered.*
