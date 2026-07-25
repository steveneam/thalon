# B-media.0 — Source media on every surface (thumbnails)

> **Founder-directed, s74:** *"the media thumbnails will need to be done
> eventually, so that needs a proper and clever UI/UX with the source
> thumbnails … wrap that planning in next session when you have time (see how
> others do it)."*
>
> **Status: PLAN — no code.** DOCTRINE 0 says a new visual pattern earns a
> sheet, so the resolved treatment goes to a claude-design mock before any
> surface is touched. This doc is the research + the join map that the mock
> and the contract window are cut from.
>
> Written s75 (2026-07-25) by the lead, beside the wave-2 lanes.

---

## 0. The correction this plan opens with

The s74 wrap recorded thumbnails as the one place the rebuilt surfaces "read
thinner than the mock", and read as though nothing ships today. **That is not
what the code says.** Two surfaces already resolve real media end-to-end, and
they already implement the exact fallback the sheets specify:

- **Transcription (Library)** — `library.tsx` renders `row.thumbnailUrl` into
  `.thumb-sm` with `object-fit: cover`, falling back to the striped box with a
  mono `video` legend. The URL arrives from `sources.meta.thumbnailUrl`,
  captured at ingest by the **keyless, quota-free YouTube oEmbed** seam
  (`video-title.ts`) — the B6.6 rider, shipped session 19.
- **Intel** — `rising-card.tsx` does the same with the driver-captured
  `thumbnailUrl`, falling back to a per-row `thumbLabel`.

So this is **not greenfield**. The job is to generalise a pattern that already
works on the two surfaces whose sources are natively visual, and to be honest
about the two that have nothing to join to. It also means the resolved
treatment is **already duplicated twice** — same `<img>`, same inline
`style`, same eslint suppression, in two components. A shared component is owed
on those grounds alone, independent of any new surface.

---

## 1. The join — where a thumbnail legitimately comes from

Per row kind, the exact source of truth, and today's state:

| Surface | Row kind | Source of truth | State |
|---|---|---|---|
| **Transcription** | `video_transcript` source | `sources.meta.thumbnailUrl` — YouTube oEmbed at ingest | ✅ **ships** (renders + striped fallback) |
| **Intel** | capture | driver-captured `thumbnailUrl` on the capture | ✅ **ships** (renders + `thumbLabel` fallback) |
| **Videos / Dossier** | take / cut | `video_takes.ref` → object store → `/assets/<sha256>` (B-pub.4, live) | ⚠️ **ref exists, no poster frame derived** |
| **Approve** | draft | — nothing on the wire | ❌ **the real gap** |
| **Runs** | run | — joins through its drafts | ❌ derived from the gap above |
| **Create** | preview row | — nothing (the s74 honest deviation) | ❌ derived |
| **Dashboard** | mixed feed | — whatever the above resolve to | ❌ derived |

**Read the table as three different problems, not one.** They deserve
different answers and different sequencing:

**(i) Already solved — generalise it.** Transcription and Intel need no new
plumbing at all. What they need is the shared component (§4) so the pattern
stops being copy-pasted and so hover/ratio behaviour is fixed in one place.

**(ii) Ref exists, poster missing — one derivation.** `video_takes.ref` is a
real object-store ref and the `/assets/<sha256>` door is live and revocable.
The missing artifact is a **poster frame**, which is exactly what the
`THALON_FFPROBE` seam named in the B-media charter is for: one frame extracted
at render time, stored content-addressed like any other asset, referenced as
`meta.posterRef`. No new storage, no new door — one derivation step and one
additive meta key.

**(iii) Genuinely nothing to join — do not fabricate.** A draft is text. It
has no media reference of any kind, which is why the s74 lanes each hit this
independently and why Create shipped its honest deviation rather than a
fixture value. **A draft only earns a thumbnail once it actually owns media**
— i.e. once it carries generated or operator-imported media, which is the
B-media charter's own upload door. Until then the striped placeholder is not a
degradation, it is the truth: *there is no media yet*. Approve's rows should
keep the placeholder and **must not** borrow a thumbnail from the run, the
brief, or the grounding source to look fuller — that would be an invented
provenance, and it would violate VISIBLE PROVENANCE (plan §5) on the one
surface where the operator is deciding whether to publish.

> **The sequencing this implies is the opposite of the intuitive one.** Approve
> is where media matters most (founder's media-first doctrine: scan-and-decide)
> **and it is the surface that must wait longest**, because its thumbnail is
> blocked on B-media proper (the import/generate door), not on read-model work.
> Nothing in this plan can honestly put a picture on an Approve row today.

---

## 2. The treatment — what the research says

Founder's brief was "see how others do it". The findings that actually bear on
our decisions, with the ones we can act on marked:

**Reserve the box before the image loads.** NewsKit's Image component takes
aspect ratio as a *prop supplied alongside width*, so the container is sized
before the bytes arrive; its loading state is a placeholder icon *inside* that
reserved box. This is the single most important pattern for a dense list —
it eliminates layout shift when 40 rows resolve at different times. **We
already do this**: `.thumb-sm`/`.thumb-md` are fixed-pixel boxes and the
striped placeholder lives inside them. ✅ *no change needed — but it is the
reason the fixed box must never become fluid.*

**The industry storyboard tile is 16:10 — and so is our thumb.** Mux
generates storyboards at **256×160** tiles. `.thumb-sm` is **64×40**. Both are
exactly **1.6**. `.thumb-md` (148×96) is 1.54. This is a useful corroboration:
the sheets' boxes already sit on the convention, so nothing about the existing
chrome needs revisiting.

**But a YouTube poster is 16:9 (1.78), not 1.6.** Cover-cropping 1.78 into 1.6
trims **~10% of the width**, ~13% into `.thumb-md`. That is comfortably inside
the "keep faces and text within the central 80% of the frame" guidance the
YouTube thumbnail specs give, precisely because creators design for edge crop
on TV and feed surfaces. **So cover-crop is safe for landscape sources and
stays.** ✅

**Portrait sources are where cover-crop fails badly.** A 9:16 Short is 0.5625;
cover-cropping it into a 1.6 box discards **~65% of the frame height** and
reliably decapitates the subject. Mature products don't solve this by
letterboxing everything — YouTube gives Shorts a differently-shaped card
altogether. In a uniform row list we can't change the box per row without
wrecking the rhythm, so the answer is: **keep the box, switch the fill** —
portrait-native media renders `contain`, centred, against its own dimmed
extension, instead of `cover`. That preserves the subject and still keeps the
row height constant.

> **This is the one decision that needs data we currently throw away**, and it
> is nearly free — see §3.

**Hover-scrub is out of scope, and for a real reason.** The storyboard pattern
(sprite sheet + WebVTT index, `#xywh` fragments, 50–100 tiles) requires
**owning the transcode**. We don't own it for our densest case: Transcription
sources are YouTube URLs where we hold a poster URL and nothing else. For our
*own* renders (§1-ii) we could generate a sprite, but the value on a 64×40 row
thumb is negligible. **Recommendation: no hover-scrub anywhere.** Hover earns
its keep differently — see §4.

**Review-queue ergonomics.** Pinterest's Pinqueue treats review time as the
platform's success metric, keeps hotkeys a native feature, and positions its
widgets on the principle that attention lands centre-page. Approve already has
the hotkeys (a/r/e + bulk bar, s74). The media-first argument for giving
Approve the *largest* thumb is sound — it is just blocked on §1-iii.

---

## 3. The one cheap plumbing line

`video-title.ts` calls YouTube oEmbed and reads `thumbnail_url`. **The same
response already contains `thumbnail_width` and `thumbnail_height`, and we
discard them.**

Capturing them costs **zero extra network calls, zero quota, zero new
dependencies** — it is two fields off a response we already parse — and it is
the only thing standing between us and the portrait decision in §2. Proposed:

- `video-title.ts` → `VideoOEmbedMeta` gains `thumbnailWidth`/`thumbnailHeight`
  (`number | null`, same never-throws degradation as every other field);
- `ingest-video-url.ts` → additive `meta.thumbnailWidth` / `meta.thumbnailHeight`,
  spread-guarded exactly like `thumbnailUrl` is today, so **pre-rider rows
  simply lack them** and degrade honestly — the established B6.6 pattern;
- `lib/library/serialize.ts` → surfaces a single derived `orientation:
  "landscape" | "portrait" | null`, not raw pixels. The surface should never
  do arithmetic; `null` means "we don't know, treat as landscape".

Everything else in this plan is read-model and presentation. This is the only
ingest change, and it should ride the **contract window** rather than a
surface lane, together with `meta.posterRef` from §1-ii.

---

## 4. The mock — and what it decides

**Built, s75:** `mock-sheets/Source Media.dc.html`, on the same canvas as the
other sheets (`?file=Source+Media.dc.html`), drawn in `theme.css`'s own
language. It is registered in the sheets README under **Proposals — not yet
verdicted**, so no wave-2 lane will port it by accident.

It puts the five calls below in front of the founder as pictures rather than
prose:

The plan deliberately stops here and hands the following to the claude-design
mock, because they are visual calls that DOCTRINE 0 says earn a sheet:

1. **The shared `<SourceThumb>`** — one component replacing the two
   copy-pasted `<img>` blocks. Props: `src`, `orientation`, `legend`, `size`
   (`sm`/`md`/`lg`). Owns cover-vs-contain, lazy loading, the striped
   fallback, and the failed-load path (below). No inline styles: the sheet's
   classes, and per README rule 6 the per-surface CSS must not leak.
   **Constraint rule 6 already records:** `.thumb-sm` is a proven
   cross-sheet collision *and* Approve deliberately overrides it. So the
   shared component must render the shared box while leaving each surface's
   scoped override intact — consolidating the `<img>` must not flatten the
   sizing a surface has legitimately nudged.
2. **The failed-load state, which nothing currently handles.** Both shipped
   components render `<img>` with no `onError`. A dead remote poster (YouTube
   URLs *do* rot) currently paints a broken-image glyph inside the striped
   box — the one state that looks like a bug rather than an honesty. The mock
   should give "we had a thumbnail and it's gone" a treatment distinct from
   "there was never any media".
3. **Portrait fill** — the dimmed self-extension of §2, or a flat token
   pillarbox. Needs to be seen at `sm` before it's chosen.
4. **What hover actually does**, given scrub is out: candidates are a 2× peek
   at `md`, or nothing at all. Nothing is a legitimate answer and is cheaper
   to defend than a half-measure.
5. **Whether `lg` exists at all** — two sheets use `.thumb-lg` but neither
   shipped surface does.

---

## 5. Sequencing

1. **Contract window** (with the next window, not a lane): `thumbnailWidth`/
   `Height` → `orientation` (§3), and `meta.posterRef` for takes (§1-ii).
2. **Mock** the five calls in §4 → founder verdict → the sheet.
3. **Build `<SourceThumb>`**, migrate Transcription + Intel onto it. This is
   pure consolidation and can be verified against the two surfaces that
   already work — the safest possible first step.
4. **Videos/Dossier** posters once the ffprobe derivation lands.
5. **Approve/Runs/Create/Dashboard** — *only* when B-media proper gives drafts
   real media. Until then the placeholder is the correct and honest render,
   and this plan explicitly recommends leaving it.

**Open question for the founder** (§1-iii is the crux): if a draft never owns
media until the B-media import door ships, Approve keeps striped placeholders
for the foreseeable future on the surface where media-first matters most. That
is honest, but it is worth his explicit call as to whether that is acceptable
or whether it should pull B-media's import door forward.

---

## Sources

- [Mux — Create timeline hover previews](https://www.mux.com/docs/guides/create-timeline-hover-previews) (storyboard contract: 256×160 tiles, WebVTT `#xywh`, 50–100 tiles)
- [NewsKit design system — Image](https://www.newskit.co.uk/components/image/) (`loadingAspectRatio`, reserved box, placeholder-icon loading state)
- [Pinterest Engineering — Pinqueue3.0](https://medium.com/pinterest-engineering/introducing-pinqueue3-0-pinterests-next-gen-content-moderation-platform-fcfa972bf39c) (review time as the metric, native hotkeys, centre-weighted widget placement)
- [YouTube thumbnail specs 2026](https://blondish.net/youtube-thumbnail-aspect-ratio/) (16:9 posters, 9:16 Shorts, central-80% safe area)
- [Storyboard thumbnails — the scrub-bar preview](https://nikodev1.medium.com/storyboard-thumbnails-the-scrub-bar-preview-your-players-are-missing-8ee4182ea5f4) (why per-frame fetching fails; sprite + index inversion)
