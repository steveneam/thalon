# WRAP — lane `intel-rebuild` (exact-mock rebuild: the Intel surface)

Branch `agent/intel-rebuild`, based on `861ae2f`. TWO commits, one per
kickoff step. Full `npm run verify` at the repo root before this wrap —
unfiltered, never piped through tail. Zero spend, zero contracts/db/engine
edits, no npm install.

**The port was screenshot-diffed in-lane, not assumed.** `next dev` can't
run in a worktree, so the surface was rendered to static HTML against the
REAL `workspace.css` + built theme (jsdom render → `container.innerHTML`,
wrapped in the sheet's own rail/topbar) and opened in Chrome beside
`Intel.dc.html` at 1440×940. Both documents were then measured
element-by-element, not eyeballed. Recipe for the merge gate is at the
bottom — it is ~40 lines and works for any surface.

## Step 1 — the pure port (`f728dfa`)

The sheet's markup React-ized, wearing the sheet's own classes: shared ones
from `app/app/workspace.css` READ-ONLY, its helmet atomics ported into a new
surface-scoped `components/intel/intel.css`. The sheet's OWN placeholder
content, nothing wired — the structural verdict point.

Measured against the sheet, every band's rect matches exactly: `.content`,
the watch chips, both cards, `.dossier-h`, `.prov`, the thumb, the three
`.reason` rows, the pick rows, the exits footer, `.card-head`, the rising
rows, the tabs, the heat bar. Two drifts were found by measuring and fixed
rather than shipped:

- **Button line-height.** The sheet's span-controls are `<button>`s here
  (keyboard + screen-reader reach); a button's UA `line-height: normal`
  shrank the tab band by 2px and every copy-bearing pick row by 3px, which
  cascaded down the whole surface. The ported atomics now inherit the
  sheet's line-height (the `.seg-opt` precedent in workspace.css).
- **The angle radio.** The sheet marks the first TITLE and leaves the angle
  rows unmarked. A default-marked angle would have claimed a pick the
  operator never made, so an unpicked angle stays unmarked and the promote
  seam keeps owning its documented "first entry" default.

One deliberate 1px delta remains: the rising rows sit in the bounded
`.card-rows` region, so the first row drops its `border-top` instead of
doubling the card-head's border the way the mock's flat markup does. This
is the verdicted Dashboard exemplar's own behaviour.

## Step 2 — wired + keepers (`__STEP2__`)

Real data through the EXISTING `lib/intel/*` clients — no new endpoint, no
contract edit. `components/intel/intel-model.ts` is the whole mapping layer
(wire row → what the sheet draws), unit-tested beside the surface, so the
markup formats nothing.

**Keepers woven, all behind byte-true resting chrome:**

- **Capture doors** (`old-design-keepers.md` row 1) — promote hands Create a
  capture id (context never retyped) and dismiss records its capture and is
  signal, not deletion. `lib/intel/store` semantics untouched. The
  suggested exit follows the DATA (`launchpad.suggestedExit`), so the demo
  dossier's Bluesky post draws "Create post · suggested" where the sheet's
  video-native card drew "Create video · suggested" — the sheet's word is a
  render of the heuristic, not a constant.
- **Demo-banner + cadence-stamp honesty** (row 2) — the sheet draws no
  banner, so the honesty lives IN the sheet's own stamp band rather than as
  new chrome: `Swept 2h ago · next in 4h · YouTube + Bluesky`, where the
  third segment reads `demo dataset — no live sweep yet` for as long as the
  fake-driver dataset is on screen. The middle segment is the SCHEDULE's
  truth — `sweep due now`, or `no next sweep scheduled` when there honestly
  is no next sweep — never invented.
- **The merged multi-source read** (WRAP-blearn §Slice 3, consumed) — the
  platform segment names every swept source, and the per-source stamps ride
  in its hover title, one line each: `YouTube: 12 cards, swept 2h ago` /
  `Bluesky: 4 cards, swept 9h ago`. A staler source says so instead of
  riding the freshest one's stamp.
- **The one list keyboard grammar** — j/k move, ↵ opens the selected rising
  row into the dossier; selection IS the sheet's `.row.sel`. (The `x`/`d`
  bulk keys did NOT re-enter: the bulk bar + action toast are Approve's
  step-2 keepers, and the sheet draws no checkboxes.)
- **Media-first** — a driver-captured thumbnail renders in the sheet's own
  thumb frames; when the driver captured none, the sheet's striped
  placeholder keeps its legend. Nothing is synthesized.
- **Honest states** — a failed read is an alert with retry ("a read
  failure, not a quiet watch"), and a driver refusal surfaces VERBATIM in
  the sheet's card grammar, never a fake spinner.
- **Area doors** — add / pause-resume / edit-the-description live behind the
  chips: the resting band is exactly the sheet's, the forms appear only once
  a chip is engaged. An area pauses, never deletes.
- **Light mode** (the founder's wave-0 keeper) verified in the harness —
  every value in intel.css is a token alias, so `light-dark()` rides free.

**Named app adaptations** (all documented in `intel.css`, none silent):
surface-scoped selectors, the button resets, `.pick-hit`/`.row-open` hit
targets, `min-width: 0` on the dossier columns, the BOUNDED `.pick-rows`
(the sheet draws 3 picks; a real dossier carries up to 4 titles + 3
angles), the shared `.card-rows` bound on the rising list, and one measured
change: the `.reason` name track went 96px → 104px because the ranker's
FOURTH signal name ("Engagement 0.74", 100px at 12.5px Geist) wrapped the
row onto two lines — the sheet's own three names measure 75/88/89px and
were the only ones the canvas ever had to fit.

## Deletions (demolish, don't renovate)

`intel-surface.tsx` · `trends-tab.tsx` · `trend-card.tsx` · `rising-list.tsx`
· `watchlist.tsx` · `cadence-stamp.tsx`, plus `trends-tab.test.tsx` ·
`trends-bulk.test.tsx` · `trends-keyboard.test.tsx`.

KEPT deliberately, each with a reason: `heat-grade.tsx` (leads/board/library
/create still import it — its `heatBand` is also the new model's one thermal
definition), `launchpad.ts` (the sheet's own suggested-exit reason string,
freshness stamp and compact counts are this helper), and
`search-tab.tsx` + `horizon-card.tsx` + `demo-banner.tsx` — see the first
ambiguity below.

## Pin deltas (my surface's rows only)

- `bridge-burndown.test.ts`: −95 bridged tokens (cadence-stamp 4 ·
  intel-surface 7 · rising-list 11 · trend-card 39 · trends-tab 7 ·
  watchlist 27). Repo total 938 → **843**. Intel's remaining 25 are all
  Search's (search-tab 10 · horizon-card 9 · demo-banner 5 · heat-grade 1).
- `mono-ratchet.test.ts`: −12 (cadence-stamp 1 · rising-list 1 ·
  trend-card 7 · trends-tab 1 · watchlist 2). Total → **90**; the one
  remaining intel pin is heat-grade, which serves other surfaces.
- `selected-row.test.ts`: untouched — intel was never in its list, and the
  rebuilt surface marks selection with the sheet's `.row.sel` as the s73
  note prescribes.

## Test deltas

- NEW `components/intel/__tests__/intel.test.tsx` (10 cases, MSW fixtures,
  mirrors `dashboard.test.tsx`): the sheet's bands on the real read · the
  demo era named · the live era naming its platforms with per-source truth
  in the title · media shown when captured and the placeholder when not ·
  promote through the capture door with the data-driven pre-pick · dismiss
  handing the dossier to the next card · j/k/↵ with `.row.sel` · read
  failure = alert + retry · driver refusal verbatim · Search still reachable.
- NEW `components/intel/__tests__/intel-model.test.ts` (10 cases): the
  ranker's four reason grammars + the scoreless `disarmed` variant · reason
  rank ordering and colour ramp · the thermal words · platform labels · the
  dossier and rising mappings · the sweep stamp in both eras, due-now, and
  the honest no-next-sweep.
- `launchpad.test.ts`: `compactCount` re-pinned on the sheet's number
  grammar — see ambiguity 3.
- `lib/testing/handlers.ts`: the trends handler now sends `sources: []`
  (one additive line, as the kickoff allowed) because `TrendsPayload.sources`
  is typed as required — the real route sends it on both branches.

## Ambiguities + calls for the lead

1. **Search has no sheet.** `Intel.dc.html` draws a Search TAB but no Search
   panel, and there is no `Intel-Search` sheet in `mock-sheets/`. Deleting
   `search-tab.tsx` would have deleted shipped function (keyword targets +
   horizon cards), so it stays behind the sheet's own tab with its legacy
   styling and its bridge pins intact. **It looks like the old design when
   you click that tab** — honest, since it is not yet rebuilt, but it is the
   one place this surface is not the mock. If the founder wants it rebuilt,
   it needs a sheet first (canvas change → re-export).
2. **Surface-scoped CSS is a cross-lane contract question.** I scoped every
   ported atomic under `.intel-surface` because the mock's helmets reuse
   short names ACROSS sheets with different values — `.reason` and
   `.sec-label` are in Leads.dc.html (its `.reason` grid is 120px/54px/1fr,
   not this one's), `.prov` is in Videos Overview.dc.html as a 10px mono
   line. Unscoped per-surface files would collide the moment two of those
   lanes land. Worth making it the stated rule for every lane, or overriding
   it deliberately.
3. **`compactCount` now keeps one decimal above 10k** ("24.6k", not "25k")
   because that is what the sheet writes — twice ("24.6k views", "12.1k").
   Only Intel used the helper after the demolition, so the blast radius is
   this surface; its test carries both the sheet's examples and the
   drop-the-zero case.
4. **The angle pick starts unmarked** (sheet bytes). The promote seam's
   documented default still fills index 0, so behaviour is unchanged from
   the old surface — but a marked-by-default angle would have claimed a
   choice the operator never made.
5. **EmptyArt did not re-enter.** The keeper inventory lists it for "each
   surface's empty states", but `empty-art.tsx` is paper-register art
   (`mix-blend-multiply`, authored for light surfaces) and renders near-black
   on the dark workspace. The empty state uses the sheet's card grammar with
   honest copy instead — the verdicted Dashboard exemplar's own pattern.
   Recommend the illustration set is re-cut for dark before it re-enters
   anywhere; that is a founder/lead call, not a lane call.
6. **Not a port defect, but visible:** the demo dataset is frozen at
   2026-07-05, so `freshnessStamp` renders "rising 20d · catchable" today.
   With live sweeps these are hours. Whoever owns `lib/intel/fixtures.ts`
   may want the fixture dates relative to now.
7. The design hook wrote an untracked `apps/web/.impeccable/hook.cache.json`
   (a per-session tool cache). Removed before this wrap; consider
   gitignoring it if the hook keeps recreating it in other lanes.

## The screenshot-diff recipe (for the merge gate)

A lane can't run `next dev`, but it can still diff against the sheet:

1. A temporary jsdom test renders the surface, awaits its data, and writes
   `container.innerHTML` into an HTML skeleton that `<link>`s the real
   `thalon-theme.css` + `workspace.css` + the surface css, wrapped in the
   sheet's own `.screen`/`.rail`/`.topbar` markup, with `data-astryx-theme`
   and `data-theme` on `<html>`.
2. Copy those three stylesheets and the sheet next to the output.
3. Open both files in Chrome at 1440×940 and screenshot each.
4. Then MEASURE — the eye missed both drifts this lane fixed. Run the same
   `getBoundingClientRect` dump over a band-level selector list in each
   document and diff the numbers.
5. Flip `data-theme` to `light` to check the founder's keeper.

Worktree clean; the lead merges behind screenshot-vs-sheet + a full
post-merge verify.
