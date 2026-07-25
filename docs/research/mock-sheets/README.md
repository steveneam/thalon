# Mock sheets — THE SPEC OF RECORD (founder-verdicted, s72)

These 16 sheets + `theme.css` are the founder-approved claude-design mock
(canvas project `f5d304cb`), exported verbatim at s72. **They are the
blueprint, not inspiration** — the founder's words on seeing wave-0's
bridge-repaint approach:

> "i wanted the exact claude design mock ... i wanted to demolish the house
> and build a new one, not renovate. i want the claude design as EXACT, and
> put in any placeholders (like the thumbnails) as needed if the backend is
> not ready yet."

## The contract (binding until the founder revokes it)

0. **"Exact" means the sheet's own HTML and CSS, ported.** These sheets ARE
   code — implement each surface by porting its markup and `theme.css`
   classes 1:1 (React-ized, data-wired), NOT by re-expressing the design
   through a component library. That re-expression is precisely how s72
   failed: the kickoff narrowed "exact" to "token values verbatim" and the
   layout was lost. Never narrow "exact" again — when in doubt, the sheet's
   bytes win. Component-library primitives are allowed only where the
   rendered result is indistinguishable from the sheet.
1. **A surface ships when it matches its sheet** — layout, bands, density,
   copy grammar, type roles, and the sheet's own CSS classes. Same-looking
   is not exact; diff the screenshot against the sheet.
2. **Placeholders over drift.** Where the backend lacks data (thumbnails,
   sparklines, counts), ship the sheet's placeholder treatment (striped
   thumb + mono explainer) — never redesign the band to fit missing data.
3. **Demolish, don't renovate.** The old surface implementation is DELETED
   in the same change that ships its rebuild. The wave-0 legacy-token
   bridge exists only for not-yet-rebuilt surfaces and burns down to zero.
4. **Lead-direct — AMENDED s73 close: parallel lanes are open, the lead is
   the GATE.** The founder assigned exactness to the lead personally (s72),
   and at the s73 close opened parallel rebuild lanes on top of the shipped
   foundation ("if that rule and logic is followed exact, then parallel
   workflows should be safe now"). So: a lane MAY port a surface, under the
   conditions pinned in `../ui-overhaul-plan.md` §5 "s73 close" — the
   kickoff cites the sheet + keeper rows (no design judgment in the lane —
   port the bytes), `workspace.css` is READ-ONLY to lanes (helmet atomics go
   in a surface-scoped css file), the bridge-burndown + mono pins stay
   green, and **every lane merge is preceded by the LEAD's own
   screenshot-vs-sheet diff — renovation bounces at the gate.**
   Responsibility moved from authorship to the gate; it did not move off
   the lead.
5. **Keep from wave 0:** the token/theme infrastructure (the tokens ARE
   these sheets' values), the light-mode mapping (the founder's one keeper),
   and the executable ratchets (contrast pins, mono burn-down). Everything
   visible is rebuilt to these sheets.
6. **SCOPE EVERY SURFACE STYLESHEET** (cross-lane contract, found at the s74
   merge gate — the intel lane raised it and a sweep proved it). Shared
   classes live in `workspace.css`; a sheet's own helmet atomics go in
   `components/<surface>/<surface>.css` with **every rule scoped under a
   surface root class** (`.create-surface`, `.intel-surface`, …) applied
   beside `.content` on the surface's root element. The sheets deliberately
   REUSE class names with different values, so unscoped files silently
   restyle their neighbours the moment two land. Proven collisions:
   `.prompt-box` (Create ≠ Sites), `.split` (Approve ≠ Leads), `.reason`
   (Intel ≠ Leads), `.prov` (Intel ≠ Videos Overview), `.ver-strip`
   (Approve ≠ Video Dossier), `.today` (Calendar ≠ Dashboard), `.on` (four
   sheets, all different), `.thumb-sm` and `.strip`/`.play-btn`/`.play-tri`
   (the two video sheets). Per-surface OVERRIDES of a shared workspace.css
   class (Approve nudges `.thumb-sm`) are exactly why this is mandatory.

`theme.css` here is the mock's own stylesheet — the shell (`.rail`,
`.topbar`, `.card`, pills, type roles) and every shared pattern. Open any
sheet beside it in a browser to see the target. The live canvas (fix
rounds, comments) stays https://claude.ai/design/p/f5d304cb-cd0e-484d-8542-7b6561e1ef30
— re-export here after any founder-approved canvas change.

## Founder amendments — the sheets are WRONG here on purpose

The sheets are the spec, with these recorded exceptions. **A lane must not
"correct" one back to what the sheet draws.**

- **`Library` is now `Transcription`** (founder-directed s74: *"the libary
  (we should really rename it to Transcription) also needs the media/
  thumbnail treatment, since it's mostly youtube/video based"*; shipped
  s75 as B-media.1). `Library.dc.html` and the rail in all 16 sheets still
  say "Library" — that text is superseded. The surface serves
  `video_transcript` sources only, which is why every one of its row verbs
  was already "Copy transcript". Live: route `/app/transcription` (with
  `/app/library` kept permanently as a redirect so deep links and the
  command palette survive), `components/transcription/`, scope class
  `.transcription-surface`. **Deliberate boundary:** the rename is
  surface-level. The data layer (`lib/library/`, `/api/library`,
  `LibrarySourceRow`) keeps its name because it serves the generic
  `sources` shelf, not this one surface. Revisit the name only if the
  surface's source kinds widen beyond transcripts, at which point
  "Transcription" becomes the wrong word.

## Proposals — NOT yet verdicted (do not port)

Sheets in this section are the lead's proposals against a founder-directed
question. They are drawn in the sheets' language and live on the same
canvas, but **no lane may port one until the founder has ruled on it** —
they carry open questions on purpose.

- **`Source Media.dc.html`** (s75, B-media.0, founder-directed s74: *"the
  media thumbnails … needs a proper and clever UI/UX with the source
  thumbnails … see how others do it"*) — the source-thumbnail component
  spec: five states of one reserved box (resolved · resolved-portrait ·
  empty · **broken** · **loading**, the last two new), three sizes at a
  single 1.6 ratio, the portrait crop decision, and the ruling that
  scrub-on-hover is out. Reasoning, the per-surface join map and the open
  founder question live in `../source-media-plan.md`. Note it interacts
  with rule 6 above: `.thumb-sm` is already a proven collision AND already
  carries a per-surface override on Approve, so the shared component this
  sheet proposes must not flatten those.
