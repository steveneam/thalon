# WRAP — lane `media-lane-b` (engine-side B-media.0 + all of B-audio.1)

Branch `agent/media-lane-b`, one commit, rebased onto `origin/main` at
`8cd04e1` (clean, zero conflicts). **Not merged — the lead rebases, re-runs
verify on merged main, and merges.**

`packages/contracts/**` was NOT touched. The frozen contract is consumed
exactly as it landed at `13163d4`.

---

## What shipped

### Piece 1 — the free plumbing line (`ingest/video-title.ts`, `ingest-video-url.ts`)

The oEmbed fetcher typed the reply as `{ title, thumbnail_url }` and dropped
`thumbnail_width`/`thumbnail_height` **from the very same response**.
`VideoOEmbedMeta` now carries both as `number | null`, degrading field-by-field
like every other field, and `ingestVideoUrl` writes
`meta.thumbnailWidth`/`meta.thumbnailHeight` spread-guarded exactly like
`thumbnailUrl` — pre-rider rows simply lack the keys. Zero extra network calls,
zero quota.

The pair rides **together or not at all**, at both ends and for the same reason
the contract's helper gives: half a measurement invites a consumer to guess the
other half. Dimensions are also dropped when there is no thumbnail URL to
measure. A round-trip test pins the mini-contract from writer to reader — an
ingested 1080×1920 Short comes back out of `sourceThumbnailEnvelope` as
`portrait`, which is exactly the input the founder-verdicted crop-vs-contain
call was missing.

### Piece 2 — poster derivation + the backfill door

`packages/engine/src/assets/poster.ts` (new, beside `pin.ts` — the other
content-addressed writer):

- ffprobe the source → ffmpeg one frame at ~1s → ≤640w webp → sha256 → the
  object store at **`media/<sha>.webp`**, composed through `objectKey`, never
  hand-rolled (the B4.6 lesson). That is the family lane A's `/api/media/[ref]`
  door already reads, so the first correctly-written poster lights the dossier
  up with no further wiring.
- The envelope is built by `videoTakePosterSchema.parse(...)` and lands on
  `meta.posterRef` with `provenance: "derived"`.
- **Measured, never estimated:** the poster's width/height are read back off
  the bytes we are about to store (a second ffprobe on the output), so the
  envelope cannot claim a geometry the file does not have. It never upscales —
  a 320w take gets a 320w poster rather than 640 pixels of invented detail.
- **The gate:** absent binaries, an audio take, and unreadable bytes are all
  `pending` with a stated reason, never a throw. A missing binary must never
  take down a render, and that stays true now that ffmpeg is in the image.
- Every subprocess sits behind `PosterFrameExtractor`, with
  `createFakePosterExtractor` beside it. **No test shells out to a real
  ffmpeg or touches a real video file.**

**A real defect I found by reviewing my own diff, and then proved against the
real binary.** The seek was `~1s` unless the clip measured *shorter* than
that — but a STILL take reports no duration at all (`format: {}` from
ffprobe), so it fell through to `-ss 1` and seeked past its only frame.
Measured by hand: `-ss 1` into a still exits **244 and writes a zero-byte
file**; `-ss 0` writes a valid 606-byte webp. Every `still` take would have
come back wrongly "poster pending". The rule is now "only seek into media we
have MEASURED as long enough" — unknown duration takes frame zero. Smoke-run
against the box's own ffmpeg on a real 960×540 demo clip too: 640×360 webp,
geometry read back off the output, exactly as the module claims.

**The backfill door** — `backfillTakePosters()` plus
`npm run videos:posters -w @thalon/web -- --project "<name>" | --all
[--dry-run]`. Idempotent by construction: a take carrying a readable poster is
skipped *before* any subprocess runs, so a re-run costs one read and is never a
re-derive. One unreadable take never costs the other fifty-seven theirs. A box
with no ffmpeg reports every take pending and exits 0.

**Write moment 2 is wired, not latent:** the import CLI derives posters in the
same flow the bytes land in (`--no-posters` opts out).

### Piece 3 — ffmpeg in `Dockerfile.web`

Runner stage only (`--no-install-recommends`, apt lists removed in the same
layer, plus a build-time check that both binaries actually run — the PGlite
executable-check discipline). Debian bookworm's **ffmpeg 5.1.9-0+deb12u1**.

**THE COST, measured on this box today rather than estimated** (built the
pinned base `node:24-slim@sha256:cb4e8f7c…` with and without the layer, then
removed both images and the pulled base):

| | before | after | delta |
|---|---|---|---|
| unpacked (on-disk) | 245.7 MB | 717.7 MB | **+472 MB** |
| compressed (registry / pull) | 80,298,096 B | 254,864,602 B | **+174.6 MB** |

Those are stripped base-only images, so the delta is exactly what the runner
stage gains; the app layers are identical either way.

Where it goes: ~160 MB of it is the Mesa/LLVM GL stack Debian's `ffmpeg`
package pulls through **ffplay's SDL dependency** — code a headless frame grab
never executes. Copying an `ldd` closure out of a builder stage would cut it to
236 MB, and I did **not** do that: it trades 236 MB for a bespoke seam that
breaks silently on any bump. Flagged for the lead, not decided.

**Deliberately not version-pinned.** The base is digest-pinned to one Debian
release; hard-pinning a *decoder's* patch version means the day Debian ships a
security fix is the day the image build breaks. What is pinned is that the
binaries WORK — the check fails the image build, not the first poster on the
box.

### Piece 4 — B-audio.1, all three pieces

**1. Bed source** (`packages/engine/src/render/audio-bed.ts`, new). Operator
bytes → sha256 → `media/<sha>.<ext>` → an `audioRefEnvelopeSchema` envelope
with `provenance: "operator"`; the project points at it via a new
`videoProjects.setAudioBed` door (`meta.audioBed`, the `setMediaRoot` shape).
Content-addressed, so the same track uploaded twice is one object.

- **Licensing is attested, never assumed — and it is executable, not
  remembered.** The door refuses a bed that arrives without the operator
  stating the licence, the source and who attested it. A refusal stores
  nothing: no bytes, no meta. Operator door:
  `npm run videos:bed -w @thalon/web -- --project … --file … --license … --source … --attested-by …`.
- A shallow container-magic check refuses a mislabelled file at upload rather
  than at render time hours later.
- **No audio file entered the tree, not even a fixture** (the ratified
  constraint at `narration.ts:34-36`). Every byte in the tests is synthesized —
  a real RIFF/WAVE header over silence, an ID3 stub.

**2. Audition** (`editor-inspector.tsx` + `auditionVolume` in
`lib/videos/editor.ts`). The waveform has been drawn since s44 and playing a
lie: clicking set the in-point, but playback started at zero and played at full
level. It now enters at **the cue's offset at the cue's gain**, the level
follows the knob live, and a boost above 0 dB clamps *and says so* rather than
pretending a player can exceed unity.

**3. Mux.** The composition's bed slot — empty since it was drawn — is filled
and **proven through the render target**, not merely armed: a test drives
`createHyperframesRenderTarget` and asserts the operator's own bytes reach the
job dir as `audio/bed.mp3` and that `index.html` carries
`<audio id="music-bed" … data-volume="0.5">` at the cue's −6 dB.
`RenderAudioBundle.bed` now carries `{ bytes, ext, volume }` (it was
`{ wav, … }` — a field named `wav` holding an operator's mp3 would be
dishonest). **That reshape had exactly one existing producer** —
`eval/src/render-demo-clips.ts`, whose `deps.bed` seam takes an operator file
path — and the workspace typecheck caught it, which is the gate doing its job.
It now reads the container from the operator's own extension and refuses one
the contract does not know, loudly, rather than inside chromium. And
`AUDIO_FILE_NAME_PATTERN` widened from `.wav` to the contract's audio family:
re-encoding someone's licensed master to satisfy a regex would be the render
lying about the bytes it was given.

**"No bed configured" stays a normal, stated state** — and is a *different
fact* from "the bytes are gone" (`none-configured` vs `bytes-missing`).
Collapsing them would let a render quietly drop configured music, which is the
exact failure the refusal ladder exists to prevent. `withMusicBed` reports the
omission to its caller rather than letting silence be discovered later.

---

## Verify

Baseline on main was 2153 passed / 9 skipped, 0 lint errors. **Green**, verbatim:

```
 Test Files  289 passed | 4 skipped (293)
      Tests  2193 passed | 9 skipped (2202)
   Duration  554.66s
TEST_EXIT=0
TYPECHECK_EXIT=0
✖ 8 problems (0 errors, 8 warnings)
LINT_EXIT=0
```

**2153 → 2193 passed, +40 tests, 9 skipped unchanged, 0 lint errors.** The 8
warnings are all pre-existing and none are this lane's: `_dataDir` in
`api/health/route.ts`, six `no-img-element` on the landing page, one in
`components/ui/empty-art.tsx`.

Written to a file and read from the file — **never piped through `tail`**.
Ran on an otherwise idle box: a sibling lane's suite was live when I first
reached the gate, so I killed my run and waited it out rather than driving the
box to load 14 (it briefly got there — my fault, my wait loop didn't hold, and
I stopped both rather than trust numbers from a loaded box).

**On the gate itself:** your mid-flight update said the grep guard is retired
and `npm run verify` no longer chains it. That change is **not on
`origin/main` yet** — `scripts/ci-grep-guard.ps1` and `CI-GUARD.md` are still
tracked there, and `package.json`'s `verify` still reads
`npm run guard:pwsh && npm test && npm run typecheck && npm run lint`. So I ran
**`npm test && npm run typecheck && npm run lint`** directly and did not
invoke the guard at any point, per your instruction. Re-run the real
`npm run verify` on merged main once the retirement lands.

---

## Files I touched OUTSIDE the kickoff's named set — flagged, not smuggled

The kickoff scoped me to `packages/engine/**`, `Dockerfile.web` and my tests.
Four things needed a home outside that, none of them contracts or the drizzle
schema (COORDINATION's definition of the frozen Contract), and none of them a
web surface:

1. **`packages/db/src/repos/video-takes.ts`** — `setPoster`. The backfill door
   is a *required* deliverable and `record()` is idempotent-and-returns-the-row-
   unchanged, so there was no existing path to stamp an existing take. Mirrors
   `videoCuts.stampLineage`: validated by the frozen schema at the door,
   silent no-op on an identical re-stamp, tenancy wall enforced.
2. **`packages/db/src/repos/video-projects.ts`** — `setAudioBed`. Same
   argument: a bed has to be recorded somewhere and no door existed. Mirrors
   `setMediaRoot`, and holds the licence floor itself.
3. **`apps/web/scripts/`** — two new lead-runnable CLIs
   (`derive-take-posters.ts`, `set-audio-bed.ts`) and four lines added to
   `import-video-project.ts`. Scripts, not surfaces; lane A never went near
   them.
4. **`apps/web/src/components/videos/editor-inspector.tsx` +
   `lib/videos/editor.ts`** — the audition. It is one of the three pieces you
   named and it cannot exist anywhere but the browser.
5. **`eval/src/render-demo-clips.ts`** — not a choice: the `RenderAudioBundle.bed`
   reshape broke its one call site and leaving it broken was not an option.

If any of those should be reverted, they are each isolated and small.

## What I deliberately did NOT do

- **No `withMusicBed` wired into a production render caller.** The seam is
  complete and proven, but the *pillar* render path renders a draft, and a
  draft has no video project — so there is no project whose bed it would use.
  Deciding which render draws which bed is a routing call, not a lane-B call.
  **Lead action: name the caller.**
- **No bridge between the stored bed and the EDL/editor render path.** Worth
  knowing precisely: `edl/compile.ts:lowerAudioCue` **already** muxes an
  `AudioCue` into the ffmpeg argv, so the editor path was never silent by
  omission. What it lacks is (a) any way to ADD a music cue to a silent EDL —
  `patchMusic` only patches an existing one, so a one-prompt cut can never
  acquire music — and (b) an `AudioCue.source` is a *project-relative ref*
  while a stored bed is a sha. Bridging those two means either a `setMusic`
  editor helper over `music-candidates/` takes, or materializing stored bytes
  to a temp file at render time. Both are real designs; neither is mine to pick
  mid-lane.
- **No ldd-closure slimming of the ffmpeg layer** (see piece 3).
- **No `npm run verify` invocation** (see above) and **no guard run**.
- **No `be-check`/`fe-check` run.** Those skills landed *in this rebase*
  (`8cd04e1`) and both spawn subagents; every subagent launch needs the
  founder's fresh approval, which this run's approval does not cover. Worth the
  lead running `be-check {mode:"building"}` over this diff at merge — it is
  aimed squarely at it.

## Founder-level questions I did NOT decide

1. **Does generated music ever become a second bed driver?** The bed is
   operator-supplied track DATA today, per the ratified constraint. Nothing
   here forecloses a second driver behind the same registry discipline; nothing
   here assumes one.
2. **The audio licensing launch gate.** I made it executable at the door
   (attestation required, refusal stores nothing) rather than merely recorded —
   but *what licences the product will accept*, and whether an operator's
   free-text attestation is sufficient for a multi-tenant product, is his call.
   It wants a home in the launch-gate ledger.
3. **The image-size call is now a number, not a shrug:** +472 MB unpacked /
   +175 MB compressed. His GO was given on "image size vs staging parity"; he
   is owed the actual figure and here it is. If 472 MB is too much, the
   closure-copy path exists and I have priced it (236 MB).

## Notes for the lead

- `audioBedLicenseSchema` and `projectAudioBedSchema` live in the ENGINE, not
  contracts — the window is frozen, and this is exactly the arrangement
  `assets/pin.ts` used for `assetProvenanceSchema` before its own window. They
  are **contract-window candidates for the next freeze.**
- `packages/engine/src/assets/poster.ts` reuses `defaultBinary()` from
  `edl/execute.ts`, so a poster and a cut can never disagree about which ffmpeg
  this box means (`THALON_FFMPEG`/`THALON_FFPROBE` → `~/.local/bin` → PATH).
- New events on the wire: `video_take.poster_stamped`,
  `video_project.audio_bed_set`.
- The impeccable hook flagged `Inter` at `composition.ts:147` — that is the
  pre-existing generic brand fallback, not my line and not a design defect.
- Docker measurement housekeeping: both measurement images and the pulled base
  were removed; `docker system df` is back where it started.
