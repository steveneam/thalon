# KICKOFF — lane `media-lane-b` (poster derivation + ffmpeg in the image + B-audio.1's three pieces)

> **APPROVAL ON RECORD (founder, s77): "approved"** — given against the named
> scope below, after the s77 window was frozen and lane A's core shipped.
> The plan of record states that every launch needs his fresh approval; this
> is it, and it covers exactly this run.

You are the ENGINE-side lane of B-media.0 plus all of B-audio.1. **The
contract you build against is FROZEN** — `packages/contracts/src/media.ts`
landed at `13163d4` and lane A already consumes it on main (`a70a53c`). You
do not edit contracts. If you believe you need to, that is a re-plan and a
message to the lead, never an ad-hoc edit (COORDINATION.md header).

Read `CLAUDE.md` first, then IN ORDER:

- **`docs/research/media-framework-plan.md`** — THE PLAN OF RECORD. §1 (the
  contract you consume), §5 (the three write moments — yours is #2), §8 (the
  three audio pieces), §9 (the build order; you are lane B).
- `packages/contracts/src/media.ts` — read it end to end before writing a
  line. Note especially: the ext families are SPLIT (a poster cannot be an
  mp3, by type), audio is STORED-ONLY, `capturedAt` is optional and absent
  means "we did not record when", and every schema is `strictObject` — so an
  envelope carrying a derived field like `orientation` is refused at the
  door. Do not work around that; it is invariant 3.
- `apps/web/src/lib/media/resolve.ts` — lane A's resolver, so you can see
  exactly what shape your writes must produce. `resolveTakeMedia` already
  reads `meta.posterRef` and validates it with `videoTakePosterSchema`.
  **The moment you write one correctly, the dossier lights up.** That is your
  acceptance test, not a mock.
- `packages/engine/src/render/narration.ts` lines ~34–36 — a FOUNDER-RATIFIED
  constraint that binds piece 1 below. Read it before you touch audio.

## Your file set (nothing outside it)

- `packages/engine/src/ingest/**` — the oEmbed capture
- `packages/engine/src/render/**` and the video/editor engine paths
- `packages/engine/src/assets/**` if poster storage genuinely needs it
- `Dockerfile.web`
- your own tests beside each

**Do NOT touch:** `packages/contracts/**` (frozen), `apps/web/src/lib/media/**`
or `apps/web/src/components/media/**` (lane A shipped them), or
`apps/web/src/app/app/workspace.css`. The lead owns the web surfaces.

---

## Piece 1 — the free plumbing line (do this first; it is the smallest)

`packages/engine/src/ingest/video-title.ts` calls YouTube's keyless oEmbed
and parses `thumbnail_url` out of the reply. **The same response carries
`thumbnail_width` and `thumbnail_height` and the code discards them** — it
types the body as `{ title?: unknown; thumbnail_url?: unknown }` and drops
the rest on the floor.

- `VideoOEmbedMeta` gains `thumbnailWidth`/`thumbnailHeight` (`number | null`,
  the same never-throws degradation every other field has).
- `ingest-video-url.ts` writes `meta.thumbnailWidth`/`meta.thumbnailHeight`,
  **spread-guarded exactly like `thumbnailUrl` is today**, so pre-rider rows
  simply lack the keys. The frozen contract's `sourceMediaMetaSchema` already
  names these keys — match them exactly.
- Dimensions ride TOGETHER or not at all. The contract's helper already
  enforces this and the reason is in its comment: half a measurement only
  invites a consumer to guess the other half.

Zero extra network calls, zero quota. This is what unblocks the portrait
crop-vs-contain decision the founder verdicted.

## Piece 2 — poster derivation + the backfill door

When a take's bytes land, derive its poster in the same flow: ffprobe/ffmpeg
a frame at ~1s → 640w webp → sha256 → object store → `meta.posterRef` as a
`videoTakePosterSchema` envelope with `provenance: "derived"`.

- The object key family is **`media/<sha256>.<ext>`** — that is what lane A's
  `/api/media/[ref]` door already reads (`objectKey("media", sha, ext)`).
  Use `objectKey`; do not hand-roll a key (that is the B4.6 lesson).
- **Gate on binary presence** and degrade to an honest "poster pending"
  (= `empty`, with a provenance note in the log). This stays as defence in
  depth EVEN after piece 3 puts ffmpeg in the image — a missing binary must
  never take down a render.
- **Ship a lead-runnable BACKFILL door in the same change** for the takes that
  already exist (58 on the concept film alone), so the dossier lights up
  without waiting for new mints. Idempotent: re-running it must be a no-op on
  takes that already carry a poster, never a re-derive.

## Piece 3 — ffmpeg into `Dockerfile.web` (**the founder's GO is on record — DO it, do not re-ask**)

Ground truth already checked for you: ffmpeg and ffprobe live at
`~/.local/bin/` on the box but are **NOT in the image**, and `Dockerfile.web`
is `node:24-slim` (Debian) with **no apt layer at all** today — both the
builder and runner stages are clean. So this is a real, deliberate addition
to the RUNNER stage.

- Install in the runner stage only (the builder does not need it), pin what
  you can, and clean the apt lists in the same layer so the image does not
  carry the package cache.
- **Say what it costs.** Measure the image size before and after and put both
  numbers in your wrap. The founder's GO was given on "image size vs staging
  parity"; he is owed the actual number, not a shrug.
- The binary-presence gate from piece 2 stays regardless.

## Piece 4 — B-audio.1, the three pieces (§8). This is ARMING A SEAM, not a green field

Verified state, so you do not rediscover it: the editor already carries the
music cue end to end as DATA (`AudioCue` offset/gain/tail, `music-align`,
`patchMusic`, the wavesurfer lane); the engine already has
`CompositionAudio`/`RenderAudioBundle`/`RenderAudioProvider` and a working
keyless TTS narration seam; and `composition-project.ts:131` **already emits
`<audio id="music-bed">` when `spec.audio.bed` is set**. What is missing is
that nothing fills the slot, nothing is audible, and nothing is muxed —
`composition.ts:139` still says "null = today's silent composition".

1. **Bed source.** Operator-licensed upload → content-addressed store → a
   `stored` ref with `provenance: "operator"`, through the frozen contract's
   `audioRefEnvelopeSchema`. **THE BINDING CONSTRAINT, founder-ratified and
   written at `narration.ts:34-36`: no music bed lives in-tree.** The bed is
   operator-supplied track DATA; self-generation stays a recorded follow-up
   behind the same registry discipline as every other driver. Do not commit
   an audio file, not even a test fixture — synthesize bytes in tests.
   Licensing is a launch gate to RECORD, never to assume.
2. **Audition.** The drawn waveform becomes audible playback wired to the
   cue's real offset/gain. The s44 measured-alignment method is why that
   waveform survived the rebuild; this completes its purpose.
3. **Mux.** The render target mixes the bed per the cue so a rendered cut
   actually carries its music — otherwise the editor lies about its output.
   **"No bed configured" stays a normal, stated state**, in the refusal-ladder
   register. A silent render is honest; a render that silently drops a
   configured bed is not.

---

## The bar

- **`npm run verify` is THE gate**, and it must be green before you wrap.
  Baseline on main right now: **2153 passed / 9 skipped, 0 lint errors.**
  Never pipe the suite through `tail` — write it to a file and read the file
  (a real lesson: it hid a failure for three sessions).
- Run the guard before every commit: `pwsh scripts/ci-grep-guard.ps1`.
- **Tests beside the code, in the same change.** Networkless and hermetic:
  inject fetch, fake the binary, synthesize bytes. No test may shell out to a
  real ffmpeg or hit a real CDN.
- **Sequencing courtesy (a real s74 lesson):** if another lane's suite is
  live, wait it out rather than driving box load — a full verify while
  siblings run has pushed this box to load 13.
- Commit messages: no AI attribution, ever. Plain prose about what changed
  and why, in the repo's voice.
- **If a founder-level question appears, do NOT decide it.** Write it in your
  wrap for the lead to home. Named candidates already: whether generated
  music ever becomes a second bed driver, and the audio licensing gate.

## Wrap

Write `agent_handoff/WRAP-media-lane-b.md`: what shipped, the image-size
delta with both numbers, what you deliberately did not do, every flag for
the lead, and the verify totals verbatim. Then stop — **the lead rebases,
re-runs verify on merged main, and merges.** Do not merge to main yourself.
