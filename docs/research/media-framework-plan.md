# The media framework — one reference model for every image, poster and bed

> **Founder directive (s76, verbatim):** *"it requires a sustainable plan and
> implementation. and so dont you have to create a schema and framework so
> that images/media/thumbnails can dynamically change based on the sources an
> content? i think this requires careful planning."* Planned on Fable 5 at his
> direction (design-on-Fable-5 rule); Opus 5 implements in s77.
>
> This doc is the FRAMEWORK — the schema, the resolver, the serving story and
> the dynamism model. `source-media-plan.md` (B-media.0) remains the UI
> treatment spec it always was: the five states, three sizes, the 1.6 ratio,
> the portrait call. That sheet is founder-verdicted (s76) and nothing here
> reopens it; this doc is what makes its component sustainable instead of a
> fourth copy-paste. Link, don't copy: where the two overlap, the sheet wins
> on appearance, this doc wins on data.

## 0. The problem, stated once

Four surfaces already resolve real media end-to-end (Transcription, Intel,
Sites, Videos/Dossier) — but each grew its own resolution wiring, and the
resolved `<img>` is hand-rolled separately in `transcription.tsx`,
`intel/dossier-card.tsx` and `intel/rising-card.tsx`, with Sites on its own
preview route. Meanwhile the entities themselves CHANGE: a draft is text
today and has a render tomorrow; a take has bytes today and a poster only
after someone derives one; a platform thumbnail lives on YouTube's CDN and
can die there. "Dynamic" is therefore not a refresh mechanism — it is the
discipline that **media is always resolved from the entity's current row
state by one pure function**, so the moment a write lands (ingest, render,
upload), every surface's next read shows it. No pushed invalidation, no
cached lies.

Three invariants, carried from rulings already on record:

1. **No invented provenance.** A resolver may never borrow media across
   entities (a draft never wears its run's or its grounding source's image —
   the Approve ruling, s75). Fallback chains are declared per entity kind and
   stop at `empty`, honestly.
2. **`empty` and `broken` are different facts** (the verdicted sheet's own
   call): no media ever existed vs. we had a URL and it died. They must never
   look alike or be stored alike.
3. **`orientation` is derived, never stored.** One function of
   width/height; storing it would create a second truth that drifts.

## 1. The reference model — `MediaRef` (new `packages/contracts/src/media.ts`)

A discriminated union on **where the bytes live**, because that is what
decides trust, failure mode and serving path:

```ts
/** Bytes on someone else's CDN — may die; renders direct, onError → broken. */
{ kind: "external"; url: string;            // https-only (the serialize.ts rule)
  width?: number; height?: number }
/** Bytes in OUR content-addressed store — verified reads, cannot silently rot. */
{ kind: "stored";   sha256: string; ext: "webp" | "jpg" | "png" | "mp3" | "m4a" | "wav";
  width?: number; height?: number; bytes?: number }
```

Wrapped with provenance — **who put it there**, the fact every tooltip and
audit reads:

```ts
interface MediaRefEnvelope {
  ref: MediaRef;
  provenance: "captured" | "derived" | "operator";
  // captured  = taken from the platform at ingest (oEmbed, trend driver)
  // derived   = we computed it from bytes we hold (ffprobe poster)
  // operator  = the human brought it (B-media import door, audio bed)
  capturedAt: string;                        // ISO — when the ref was written
  alt?: string;                              // absent = decorative (aria-hidden)
}
```

Derivations (exported helpers, not fields): `orientation(w, h)` →
`"landscape" | "portrait" | "square" | "unknown"`. The portrait
crop-vs-contain decision in the verdicted sheet consumes exactly this.

Audio note: `ext` includes audio deliberately. A music bed is the same
object — stored bytes, a provenance, a capturedAt — so B-audio.1 (§8) rides
this contract instead of inventing a parallel one.

## 2. Where each entity's media lives (the join map, ground-truthed s76)

| entity | storage today | change in the s77 window | migration? |
|---|---|---|---|
| `sources` (transcription) | `meta.thumbnailUrl` (jsonb) — set at ingest by `video-title.ts`, which **types the oEmbed reply as `{title, thumbnail_url}` and discards `thumbnail_width/height` from the same response** (`ingest/video-title.ts:43`) | capture `meta.thumbnailWidth/Height`; serializer emits a full envelope | **NO** — jsonb |
| trend items (intel) | `thumbnailUrl` passthrough in the sweep schema (`trend/sweep.ts:65`), drivers never synthesize | add optional width/height passthrough where the platform gives them (YouTube does) | **NO** — zod only |
| `video_takes` | `ref` (project-relative asset) + `meta` jsonb + `provenance` jsonb; **no poster** | `meta.posterRef: MediaRefEnvelope` (stored-kind, derived) | **NO** — jsonb |
| sites | catalog + same-origin preview route (s76) | none — already an envelope in spirit; adapter maps it into `MediaResolution` | **NO** |
| drafts / runs | **nothing, by design** — founder s75: placeholders until B-media | none. The import door (B-media proper, chartered separately) later adds a `media_assets` pool + draft attachments — a REAL table on a FUTURE window. Nothing in s77 pre-bakes it; the contract is shaped so it can consume `MediaRef` unchanged | — |

The whole s77 window is therefore **contracts-only: zero SQL migrations.**
Freeze = `media.ts` (new) + `source.ts` meta extension + `video-project.ts`
posterRef line + the two riders already queued (Runs' Retry replay route
contract; Library's "grounds N drafts" count on `/api/library`).

## 3. The resolver — one pure function, per-entity declared chains

`apps/web/src/lib/media/resolve.ts`:

```ts
type MediaResolution =
  | { state: "resolved"; src: string; envelope: MediaRefEnvelope;
      orientation: Orientation }
  | { state: "empty" }                       // never had media — permanent, honest
  | { state: "broken"; was: MediaRefEnvelope } // had a ref; the read failed
  | { state: "loading" };                    // a read is in flight, nothing known yet
```

- Chains are **data, visible in one table in this file** — e.g. take:
  `meta.posterRef → empty`; source: `meta.thumbnailUrl → empty`. Nobody's
  chain reaches into another entity (invariant 1), and the test that pins
  this is part of the same change: a unit test enumerating the chains and
  asserting no chain references a foreign entity's fields.
- `broken` is detected at the edge, not probed: external URLs render direct
  and the `<img onError>` flips the resolution to `broken` client-side.
  No new table, no checker daemon — the sheet's own "today this paints a
  browser broken-image glyph" is the bug being fixed, and onError is its
  whole cost. Stored refs go through verified reads and 404 loudly instead.
- **`loading` is real, not cosmetic** (the shoot-surface lesson this same
  session: a surface that cannot distinguish loading from empty lies to
  every gate and every operator).

## 4. Serving — two doors, deliberately not one

- **Stored bytes, workspace reads:** a thin authed route
  `/api/media/[sha]` — verified read from the object store, correct
  content-type from the closed ext map, immutable cache headers (the sha IS
  the version). This is NOT the public `/assets/<sha256>` door: that one is
  allowlist-gated for the blog/IG unlock (s71) and stays exactly as scoped.
  Workspace thumbnails must never require public allowlisting to render.
- **External URLs:** rendered direct (they are already https-validated at
  the serializer). No proxying — proxying platform CDF media would spend our
  bandwidth to hide a truth (link rot) the broken state exists to surface.

## 5. Dynamism — the three write moments

The resolver being pure over row state means "dynamically change" reduces to
writing the right ref at the right moment:

1. **Ingest** (exists): oEmbed/driver capture — gains width/height in s77.
2. **Render/mint completion** (new): when a take's bytes land, derive the
   poster in the same flow — `ffprobe`/`ffmpeg` frame at ~1s → 640w webp →
   sha256 → object store → `meta.posterRef`. Plus a **lead-run backfill
   door** for the existing takes (58 on the concept film alone) in the same
   change, so the dossier lights up without waiting for new mints.
   **Executable constraint found while planning: ffmpeg/ffprobe exist on the
   box (`~/.local/bin`) but NOT in `Dockerfile.web`** — so derivation gates
   on binary presence with an honest "poster pending" (= `empty`, provenance
   note in the log), and adding ffmpeg to the image is a named founder call
   (image size vs. staging parity), not a silent assumption.
3. **Operator upload** (future, B-media proper): the import door writes
   `media_assets` rows carrying the same envelope. Nothing to build in s77;
   the point of the shape is that this door adds rows, not concepts.

## 6. `<SourceThumb>` — the one component (spec: the verdicted sheet)

Consumes `MediaResolution` and nothing else. Five states (resolved ·
resolved-portrait[contain] · empty[striped] · broken[slash chrome] ·
loading), three sizes on the one 1.6 ratio. Replaces the hand-rolled `<img>`
in Transcription and both Intel cards; Sites' gallery keeps its own hero
geometry (it is not a 1.6 thumb) but its **dossier mint strip** adopts
SourceThumb — that strip is the first surface that can actually reach
`broken` (s76 lane finding), so the new state has a live caller on day one.
Rule-6 discipline: the component's css is its own scoped file; the known
`.thumb-sm` per-surface override on Approve is preserved, not flattened
(README's own warning).

## 7. The empty-state layer — a DIFFERENT question than per-row media

Per-row media answers "what does this row show?"; the zero state answers
"what is this surface for, before anything exists?" They never share pixels
and must not share machinery — B-media filling rows never removes the
first-run screen, which for a multi-tenant product is a permanent,
customer-facing state (every new tenant's day one).

What already ships: honest teaching copy on every rebuilt surface. What's
missing: the art beside it. The eight founder-minted plates (falconer's
glove, paper stack, watchtower, hand lens, open ledger, shelves, survey
chart, calling card) are light-paper `mix-blend-multiply` art that reads
near-black on dark — a rendering problem, not a design rejection.

**Plan:** an `<EmptyState>` component (plate + the existing copy + one
action), entering behind the sheets' own chrome per the re-entry rule; the
plates re-cut for the dark register as a small remint batch (8 plates,
estimate ≤1.5cr, soul-class, dark ground — **founder GO line, it is spend**);
`EmptyArt`'s current light-surface blend stays for any light-mode use. The
sheets are silent on zero states, so this is Intel-Search-precedent design
work (designed in the sheets' language, not ported) — and if the founder
wants it on the canvas, that is a sheet addition at his call.

## 8. B-audio.1 rides the same framework (founder s76: "definitely need to
include the sound/music to the video editor")

Verified state: the editor already carries the music cue end-to-end as data
(`AudioCue` offset/gain/tail, `music-align`, `patchMusic`, the wavesurfer
lane); the engine already has `CompositionAudio`/`RenderAudioBundle`/
`RenderAudioProvider` and a working keyless TTS narration seam. But
`CompositionAudio.bed` is, in its own comment, "the honest empty seam", and
the composition is "today's silent composition" — nothing is audible,
nothing is muxed.

Three pieces, smallest first, all consuming §1's contract:

1. **Bed source** — operator-licensed upload: bytes → content-addressed
   store → a `stored` MediaRef with `provenance: "operator"`; licensing
   recorded as a launch gate, never assumed. Generated music is a LATER
   second driver behind the same registry discipline as every seam.
2. **Audition** — the drawn waveform becomes audible playback wired to the
   cue's real offset/gain (the s44 measured-alignment method is why that
   waveform survived the rebuild; this completes its purpose).
3. **Mux** — the render target mixes the bed per the cue so a rendered cut
   carries its music; otherwise the editor lies about output. "No bed
   configured" stays a normal, stated state — the refusal-ladder register.

## 9. s77 sequencing (Opus 5 implements; windows freeze BEFORE lanes)

1. **The window** (lead, `contract-window` skill): everything in §2's last
   paragraph. Contracts-only; re-freeze before any lane launches.
2. **Lane A — apps/web:** resolver + `<SourceThumb>` + migrate the four
   surfaces + the `/api/media/[sha]` route. Screenshot-vs-sheet gate via
   `scripts/shoot-surface.mjs`.
3. **Lane B — engine + editor (disjoint files):** ingest width/height
   capture · poster derivation + backfill door · B-audio.1 pieces 1–3.
4. **Lead-serial after founder GO:** the EmptyState re-entry + dark plate
   remints (§7 spend line).
   Lanes A/B are launchable in parallel (disjoint sets, the wave-2/3 shape);
   every launch still needs the founder's fresh approval per standing rule.

## 10. Founder calls this plan surfaces (nothing blocking a start)

- **Remint GO** for the eight dark plates (≤1.5cr est).
- **ffmpeg in the web image** (staging poster parity) vs. box-only for now.
- Whether zero-state designs should become canvas sheets after the fact.
