# WRAP — lane `runslib-rebuild` (exact-mock rebuild: Runs + Library, two-step each)

Branch `agent/runslib-rebuild`, based on `861ae2f`. **Five commits — the two
steps of each surface, in series (Runs, then Library), plus one self-caught
fidelity fix**, so each surface has its own structural verdict point before
any data touched it. Zero spend, zero
contracts/db/engine edits, no npm install, no API changes: every read and
write goes through an EXISTING lib client.

| # | Commit | What |
|---|---|---|
| 1 | `ff12f0b` | Runs **step 1** — pure port of `Runs.dc.html` |
| 2 | `5ea9355` | Runs **step 2** — real data + keepers; `runs-list.tsx` DELETED |
| 3 | `72110f4` | Library **step 1** — pure port of `Library.dc.html` |
| 4 | `683364b` | Library **step 2** — real data + keepers; `library-surface.tsx` DELETED |
| 5 | `f7a67ca` | fidelity fix — both footers back to the sheet's bytes (ambiguity 10) |

Files touched are inside the lane's fence: `components/runs/`,
`components/library/`, `app/app/runs/`, `app/app/library/`, their tests, and
ONLY this lane's rows in the three pin files. `app/app/workspace.css` was
read, never edited — every shared class (`.card`, `.row`, `.pill`, `.seg`,
`.thumb-sm`, `.excerpt`, `.btn`, `.card-head`, `.card-rows`, the type roles)
comes from it as-is; each sheet's own helmet atomics live in a new
surface-scoped file (`runs/runs.css`, `library/library.css`), imported by the
route's `page.tsx`.

## Step 1 — the two pure ports (the verdict points)

Both ports are the sheet's markup and classes, React-ized, still carrying the
SHEET'S placeholder content. Nothing else: no clients, no state, no keepers.

- **Runs**: headline + `18 this week` / `1 failed` pills + the
  All/Failed/Published seg · `.day-hd` + `.card` per day (rows: thumb →
  `.run-lead`/`.excerpt` → status pill → `.t-data` → door, failed rows wearing
  the ghost Retry) · the receipts footer. Atomics ported: `.day-hd`,
  `.run-lead`.
- **Library**: headline + `5 sources` + the grounding label · the `.ingest`
  band (box + Ingest) · one `.card` of source rows (thumb →
  `.src-lead`/`.excerpt` → Copy/Export → day stamp) · the grounding footer.
  Atomics ported: `.ingest`, `.ingest-box`, `.src-lead`.
- Each sheet helmet also declares `.avatar`; that is topbar chrome the shell
  already ports, so it is deliberately NOT restated (one class, one home).
  Noted so the lead's diff doesn't read it as a missing atomic.

## Step 2 — Runs, wired (`5ea9355`)

**Reads:** `fetchRunsFeed()` (`/api/runs`) says WHAT ran; `fetchPlan()`
(`/api/app/plan`, the dashboard's own client) says what each run's drafts
DID. The second read is what makes the sheet's own copy grammar honest —
"One prompt → 3 drafts · 2 passed the judge · 1 waiting on you", the
published row's live `/blog/… ↗`, the judge block's reason — and it is what
arms the sheet's **Published** seg at all (the feed alone cannot answer
publish state). Neither route changed.

**Pure model** (`runs-model.ts`, unit-tested): row lead/excerpt/pill/thumb,
day grouping, the day headings ("Today · Friday 25 July", then plain dates),
the Monday-start week count. Degradation is explicit: a run outside the plan
window shows the FEED's own numbers; a run whose plan read is still in flight
says "reading the drafts…"; a failed plan read falls back, never invents.

**Keepers woven** (behind byte-true chrome):
- `lastError` renders **VERBATIM** in the row's error channel — B4.5's triage
  evidence, in the exact place the sheet puts its failed-row excerpt.
- Partial fan-outs (`draftsComplete === false`) wear an `Incomplete` pill and
  name the gap in the excerpt.
- The `?run=` deep link still lands **selected** on its row (and scrolls to
  it) — the dashboard-provenance keeper.
- The one list keyboard grammar (j/k move · ↵ open) drives the sheet's own
  `.row.sel` — invisibly, because this sheet's footer is a single label
  (ambiguity 10).
- ONE triage predicate feeds both the header's "N failed" pill and the Failed
  filter, so the count and the view can never disagree.

**Honest states** (dashboard exemplar): failed feed read → alert + Try again
("a read failure, not an empty history"); counts read `–` until resolved; the
failed pill renders only when the count is real and > 0; the Published view
says "unresolved, not empty" when the plan read fails.

## Step 2 — Library, wired (`683364b`)

**Reads/writes:** `fetchLibrary`, `fetchTranscript`, `ingestVideo`,
`deleteSource` — all existing `lib/library/*` clients; exports come from
`lib/library/export.ts` unchanged.

**Pure model** (`library-model.ts`, unit-tested): `parseTags` (moved off the
deleted surface), title-first lead with the pre-rider URL degrade, the facts
line, the top-scored area + reason, the sheet's day stamp (today · Tue ·
18 Jul), the transcript stamp.

**Keepers woven** (none touching sheet geometry):
- The ingest door IS the sheet's box + button. Its operator extras — tags,
  pasted captions for the caption-file seam, the seam's honest provider
  readout — **unfold only once the box is engaged**; resting = the sheet.
- The transcript doors (read the segments, copy the Markdown AI brief,
  `.md/.txt/.csv/.srt` export with timed formats disabled on untimed ingests
  and the reason in their title) and **Delete** live in the panel a row
  opens. The sheet draws no panel at rest, so neither do we. The row's own
  two sheet buttons keep the sheet's labels: **Copy transcript** copies the
  brief in place (fetching the transcript first if the row isn't open, then
  flipping to "Copied" for a beat), **Export** opens that panel — where the
  four format doors live, because one row button cannot offer four formats
  without adding chrome the sheet doesn't draw.
- Delete keeps ONE confirm named by title, and the server's refusal ("still
  grounds N drafts") surfaces **verbatim**.
- The s19 "the fresh wall of segments buried the shelf" feedback is answered
  structurally rather than by a collapse toggle: the panel's segment region is
  the shared bounded `.card-rows` (scrolls internally), so a fresh ingest can
  never push the shelf off screen.
- Source-Link way-back on every web-origin row; media-first thumbnails fill
  the sheet's `.thumb-sm` when the ingest captured one, the striped
  placeholder when it didn't.
- j/k move · ↵ open · d delete, on the sheet's `.row.sel` — invisible here
  too, for the same reason (ambiguity 10).

**Honest states**: failed read → alert + Try again ("a read failure, not an
empty shelf"); `– sources` until resolved; empty shelf says so plainly.

## NAMED app adaptations (the only structural deltas step 2 introduced)

Both are in `library.css`, documented at the line:

1. The sheet's ingest box is a static `<div>`; ours is the real `<input>` (and
   the caption `<textarea>`) — so it inherits the UI font, keeps the sheet's
   colour for the PLACEHOLDER while lifting TYPED text to reading contrast,
   and shows a keyboard focus ring the static mock never needed.
2. `.ingest-field` neutralises the band's `flex: 1` for the fields that unfold
   in the options card (a column — growing there would stretch a one-line
   input to fill it).

Runs needed none: `.card-rows` (bounded scroll) and `min-width: 0` were
already in `workspace.css` from wave 1a and are used as-is.

## Pin deltas (ratcheted DOWN in the same change, per the rules)

| Pin | Before | After |
|---|---|---|
| `bridge-burndown` | 938 (s73 seed) | **891** — `runs/runs-list.tsx` (8) and `library/library-surface.tsx` (39) rows removed; every new file enters at **ZERO** bridged tokens |
| `mono-ratchet` | 102 | **100** — the two deleted surfaces' rows removed; the rebuilds use the theme's data-label style, never `u-eyebrow`/uppercase mono |
| `selected-row` | 6 surfaces | **4** — `runs/runs-list.tsx` and `library/library-surface.tsx` leave the list (rebuilt surfaces mark selection with the sheet's `.row.sel`, per the test's own note) |

## Deletions (DOCTRINE 0 rule 3 — demolish, don't renovate)

- `components/runs/runs-list.tsx` + `__tests__/runs-list.test.tsx`
- `components/library/library-surface.tsx` +
  `__tests__/library-surface.test.tsx` + `__tests__/library-keyboard-bulk.test.tsx`

Retrieval is a checkout, not archaeology: they live intact at `861ae2f`
(step-1 commits kept them on disk; each step-2 commit lists what it deleted).

## Test delta

- **Removed** 13 tests with the two old surfaces.
- **Added** 33: `runs-model.test.ts` + `runs.test.tsx` (18) and
  `library-model.test.ts` + `library.test.tsx` (15), both component files
  mirroring `dashboard.test.tsx` (MSW fixtures, jsdom, honest-state cases:
  failed reads, unresolved counts, verbatim errors, keyboard selection).
- Net **+20**.

## Ambiguities and calls for the lead

1. **Runs' Retry has no armed door.** There is no fan-out replay route
   anywhere in `app/api` (only `/api/runs` read, `/api/runs/:id/drafts`). The
   sheet draws Retry on failed rows, so it is rendered at full fidelity but
   **rests unarmed with the reason in its `title`** (the dashboard's
   disabled-Board precedent) rather than pretending to act — the whole row
   still opens the run's receipts. Arming it is an API change (contract-window
   candidate), deliberately out of this lane's fence.
2. **Runs reads the plan as well as the feed.** Kickoff named the `/api/runs`
   feed; the sheet's Published seg and its draft-count excerpts are
   unanswerable from that feed alone, so the surface also reads the EXISTING
   `fetchPlan()` client (no API change). If the lead prefers feed-only, the
   Published seg becomes a dead control — flagging the trade rather than
   silently redesigning the band.
3. **Library's "grounds N drafts" clause is absent, not invented.** No
   server-side sources→drafts count exists. Next contract window could expose
   it on `/api/library`; until then the facts line states only what the ingest
   recorded.
4. **Library bulk delete + `x` pick are parked**, with the BulkBar and
   ActionToast keepers the inventory routes to Approve step 2
   (`components/workspace/bulk-bar.tsx`, `action-toast.tsx` — both still
   tracked, untouched). Single delete with its named confirm is kept.
5. **The thermal relevance badge is parked** (`components/intel/heat-grade.tsx`,
   still tracked; the thermal register re-enters with Intel's rebuild). The
   data survives on the row as "· relevant to <area>" with the engine's reason
   on the tooltip — no extra element in the band.
6. **EmptyArt was not woven in.** The paper/navy plates are light-surface art
   (`mix-blend-multiply`) and would muddy on the dark workspace; the wave-1a
   Dashboard made the same call. The keeper stays tracked and re-enters when
   the set is re-cut for the dark register.
7. **One cross-surface import**: `runs-model.ts` imports `platformLabel` and
   `thumbLabel` from `components/dashboard/dashboard-model.ts` (the worked
   exemplar) rather than duplicating them. If the lead prefers, their natural
   home is `lib/workspace/format.ts` — a lead-owned file, so the move is a
   one-line lead change.
8. **Library's row verbs stay "Copy transcript"** on every row: `/api/library`
   serves `video_transcript` sources only, so the sheet's "Copy text" /
   "Open profile" variants have no data behind them yet. Not drift — those
   rows are the sheet's fiction for source kinds this surface does not serve.
9. **Step-1 dates are the mock's own fiction** ("Today · Friday 25 July"; 25
   July 2026 is a Saturday). Step 2 renders real local dates in that grammar.
10. **The keyboard grammar is invisible on these two surfaces** (`f7a67ca`).
    Step 2 first rendered the Dashboard exemplar's "j k move ↵ open" chips in
    both footers; the port review caught that as MY drift — the Dashboard
    sheet draws those chips itself (`Dashboard.dc.html:181`), while Runs and
    Library use `kbd` only for the topbar's ⌘K and give each footer a single
    label. The chips came out and the behaviour stayed. If the lead wants the
    grammar discoverable on every list surface, that is a canvas change
    (a founder-approved sheet edit re-exported), not a lane call.
11. **Where the surface stylesheets are imported.** Each is imported by its
    route's `page.tsx` (`import "@/components/runs/runs.css"`), which App
    Router allows for any route segment and which keeps the sheet's atomics
    loading only on the route that owns them. The alternative single import
    site is `app/app/layout.tsx` beside `workspace.css` — a shell file, so
    that move is the lead's call, not the lane's.
12. **No in-lane screenshot.** `next dev` cannot run inside a worktree
    (Turbopack rejects the out-of-root `node_modules` symlink, per the machine
    memo), so screenshot-vs-sheet at 1440×940 is the LEAD's merge gate — both
    surfaces are ready for it, dark and light (the ports carry no colour
    literals; everything rides the shared token aliases).

## Verification

**`npm run verify` at the repo root, GREEN (`EXIT=0`)** — unfiltered, redirected
to a file and read whole, never piped through `tail`:

- guard `PASS` · **1944 passed / 0 failed / 9 skipped across 280 files** ·
  typecheck clean in every workspace · lint **0 errors** (15 warnings, all
  pre-existing in files this lane never touched).
- Ran 17:53–17:59 UTC on a **quiet box** (load average 8 falling from 21,
  no other lane mid-suite) — the sequencing rule the lead pinned in
  `e072ee5`. Suite wall time **297s**.

**The earlier run is worth recording, because it is the rule's evidence.** At
17:27 the same tree verified while all three rebuild lanes ran suites at once
(load average **34** on 6 vCPU): 1940 passed, **4 failed**, wall time
**1098s** — every failure in `packages/engine/src/integrations/` (files no UI
lane touches) with `Error: PGlite is closed`, i.e. WASM boot/teardown races
under CPU starvation. Re-running those three files alone: **40/40 pass in
67s** against 280s starved. Not a defect, and not this lane's code — but a
lane reading only the summary would have chased it.

Cheap gates were run continuously during the build (targeted tests, web
typecheck, web lint after each step) and the grep guard before every commit:
**PASS 5/5**.

Worktree clean at wrap; nothing staged, nothing stashed. The branch is local
(as the other lanes' are) — the lead's merge drives it from here.
