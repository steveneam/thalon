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

### `Approve.dc.html` — the sort chip says "Oldest first"; the rows are newest-first (RULED s77)

The sheet contradicts itself: its chip reads *Oldest first* while its own five
rows are drawn newest-first. The s74 lane followed the ROWS plus the founder's
s66 ruling, so the app already defaults to `newest` (`approve-surface.tsx`
`useState<QueueSort>("newest")`, label "Newest first"). **Founder ruling, s77:
"newest first."** So the code is correct and the SHEET is the wrong one here —
do not "fix" the app to match the chip. Both sort options stay available; only
the default is settled.

### `Calendar.dc.html` — concurrent events clip; adopt the sheet's own "+N more" (LEAD'S CALL, s77)

When several platforms are approved for the same instant the week column
splits N ways and each chip lands at ~45px, clipping mid-word ("Linked·",
"Faceb·"). That is the sheet's own `.ev { overflow: hidden }` meeting a density
its fixture never had. The founder handed the call to the lead ("calendar is up
to you"), and the call is: **adopt "+N more"** — capped visible chips, the
remainder collapsed behind a count that opens the day.

Why this is the conservative choice rather than an invention: **the sheet
ALREADY uses that treatment in its own waiting lane**, so this applies the
sheet's existing vocabulary to a density it never drew, instead of introducing
new grammar. Clipping a platform name mid-word is not an honest state — it
loses information with no cue that anything was lost, which is exactly what the
"+N more" pattern exists to prevent. Implementation rides the s78 fix pass.


The sheets are the spec, with these recorded exceptions. **A lane must not
"correct" one back to what the sheet draws.**

- **`Library` again — the s74 "Transcription" rename RETIRED s94.** The s74
  exception (founder-directed: *"the libary (we should really rename it to
  Transcription) also needs the media/thumbnail treatment, since it's mostly
  youtube/video based"*; shipped s75 as B-media.1) carried its own boundary:
  *"revisit the name only if the surface's source kinds widen beyond
  transcripts, at which point 'Transcription' becomes the wrong word."* The
  founder's §5.3 W2 ruling did exactly that — *"ONE Library surface;
  transcription becomes an ingest kind + a filter, not a second route"* —
  so the sheets' own "Library" text is authoritative again. Live since s94:
  route `/app/library` (real surface, `/app/transcription` deleted),
  `components/library/`, scope class `.library-surface`, the read widened
  to every non-`prompt` source kind with the kind qtab lens. The data layer
  (`lib/library/`, `/api/library`, `LibrarySourceRow`) never renamed, which
  is why the retirement was cheap.

## Proposals — NOT yet verdicted (do not port)

Sheets in this section are the lead's proposals against a founder-directed
question. They are drawn in the sheets' language and live on the same
canvas, but **no lane may port one until the founder has ruled on it** —
they carry open questions on purpose.

### The D4 wave — four sheets, authored s85 (`Analytics` · `Schedule` · `Composer` · `Channels`)

Brief: `../d4-PREPLAN.md`. Raw material: `../mobbin-patterns-s83.md` +
`../mobbin-patterns-s83b-microux.md`. Authored lead-direct per the standing
founder rule; each carries **its own OPEN CALLS in its file header** — the
questions the mock asks him rather than answers for him. **His verdict makes a
sheet law; no build lane opens on any of them before that.**

- **`Analytics.dc.html`** — a NEW surface. Per-post table with honest per-platform
  N/A (LinkedIn reach/engagement read "partner-gated", Bluesky reach reads
  "no impressions" while its engagement is real), every number carrying its
  as-of, an end-of-data line, and a **"Feeds back" column** making the D2 closed
  loop visible per post. Engagement-by-hour is drawn as a RESERVED BOX that says
  it has no data and names what it waits on, never a fabricated curve.
- **`Schedule.dc.html`** — the Calendar surface's successor. Organizing idea is the
  **three-fact split** (planned / queued / published) as three distinct objects
  with a legend that names them. Carries the answer to **deferred item #2**: the
  schedule modal shows CADENCE PRESSURE BEFORE THE COMMIT, so a cadence-illegal
  slot is refused with its next legal instant instead of failing terminally after.
- **`Composer.dc.html`** — the Create/Approve per-platform band. The fit line is a
  **counter with refusal reasons**, and a platform that refuses outright says so
  in words rather than showing a green count that lies. The judge is visible in
  the band ("would block", the denylist hit named and located) and the doctrine
  is stated on the surface: *it gates — it never rewrites*. Closes the s70c gap by
  giving target terms / discoverability a visible home on the social path.
- **`Channels.dc.html`** — Settings › Integrations, renamed. Drawn from LIFE: every
  state is the shipped `CREDENTIAL_CARD_STATES` vocabulary, and the destinations,
  labels and connect flavors are the live registry's. Adds `connectedAs` +
  `connectedAt` + `lastValidatedAt` per card, the disconnect confirm that COUNTS
  the queue rows it would strand (shipped s83), and the connect dance drawn as all
  four of its real states so none of them is a blank screen.

**The two cross-cutting proposals are RATIFIED and SWEPT (2026-07-29)** — founder:
*"you can run the sweep when you have time."* **Calendar is renamed `Schedule`**, and
**`Analytics` joins the rail** directly under it, so the rail reads as the loop it is
(Intel measures the market → Create → Approve → Schedule → Analytics measures us).

The sweep touched **15 sheets** and only the rail: the nav item was matched on its
full icon markup, so the word "Calendar" in prose was never blind-replaced. Two
mentions were then handled by hand, because a regex could not tell them apart:

- `Profiles.dc.html` cross-referenced the surface **by name** ("Calendar — platform
  cadence caps the fan-out plan") → renamed; it means the surface.
- **`Calendar.dc.html` is now SUPERSEDED** by `Schedule.dc.html` and carries a banner
  saying so. It is kept, not deleted: the shipped `/app/calendar` was built from it
  and it stays that code's spec until the rebuild lands. Its rail was swept with
  every other sheet (one canonical rail in this directory) while its own headline
  still reads "Calendar", because that is what shipped. **Do not resolve that tension
  by editing the file — resolve it by building Schedule.**

Verified after the sweep: all 15 rails render identically to the D4 four, and the
extra item causes **zero rail overflow** at the 1440×940 viewport.

`Source Media.dc.html` and `Wave 0 - Triage spine.dc.html` were skipped correctly —
neither draws a rail.

- ~~**`Source Media.dc.html`**~~ — **VERDICTED s76, MOVED OUT OF THIS SECTION.
  The founder ruled it worth doing** (*"my verdict on b-media is that its
  worth doing right? maybe next session"*), so the do-not-port bar is LIFTED
  and it is a portable sheet like any other. Its one open question needed no
  re-ask: his s75 ruling (*"also have placeholder until bmedia ready"*)
  already answers it — Approve/Runs/Create/Dashboard keep honest striped
  placeholders until B-media proper gives drafts real media. **Sequencing
  constraint that survives the verdict:** step 1 of the plan is a CONTRACT
  WINDOW (`meta.posterRef`, and the discarded oEmbed
  `thumbnail_width/height` → a derived `orientation`), and windows freeze
  BEFORE lanes launch — so the window opens first, then the build. Details
  below stand as written.

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
