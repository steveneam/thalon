# WRAP — lane `analytics` (BUILD COMPLETE — ready for the lead's gate)

Branch `agent/analytics` · worktree `.claude/worktrees/analytics` · kickoff
`agent_handoff/lanes/KICKOFF-analytics.md` (founder GO s91b, on record).

Read-only against the engine. Zero live platform calls, zero credits, nothing
armed. Every platform number in the tests is an injected fake.

---

## Deliverable 1 — the Facebook fixture reconciliation (derivation; the LEAD applies the sheet edit)

Truth source: `packages/engine/src/social/metrics/capability.ts`, facebook
entry, `verifiedOn: "2026-08-01"`. Meta retired `post_impressions_unique` (and
its variants) on **2025-06-15** and the rest of the `post_impressions*` family
on **2025-11-15**, directing callers to `post_media_view`. What Facebook
reports NOW, per that file's `reports`:

| label | platformField (verbatim) | note (verbatim from capability.ts) |
|---|---|---|
| views | `post_media_view` | "the impressions replacement — times the content was played or displayed" |
| reach | `post_total_media_view_unique` | "unique media viewers; the surviving unique-audience metric after the 2025 impressions retirement" |
| clicks | `post_clicks` | — |
| reactions | `post_reactions_by_type_total` | "the named reaction types summed — the metric is a per-type map and this is its own stated total" |
| comments | `comments.summary.total_count` | from the post OBJECT read, not insights |
| shares | `shares.count` | from the post OBJECT read |

And the one refusal: `impressions` → `retired` — *"Meta retired
post_impressions on 2025-11-15 (and post_impressions_unique on 2025-06-15) in
favour of post_media_view — asking for it now returns an invalid-metric error,
so nothing is asked"*.

### What in `docs/research/mock-sheets/Analytics.dc.html` conflicts, exactly

The sheet contains **no literal `post_impressions` string** — the conflict is
the *implied provenance* of every Facebook "Reach" number, drawn on the
pre-retirement assumption that FB reach = `post_impressions_unique`:

1. **The three Facebook rows' Reach values** (fixture values `6,410` line ~241,
   `3,120` line ~319, `1,870` line ~380). The VALUES may stand as fixtures and
   the column word "Reach" SURVIVES — capability truth keeps
   `audienceLabel: "reach"` for Facebook — but their provenance is now
   `post_total_media_view_unique` ("unique media viewers; the surviving
   unique-audience metric after the 2025 impressions retirement"), never
   `post_impressions_unique`. Any tooltip/as-of copy the sheet grows for these
   cells must carry that field name verbatim.
2. **The Reach tile** (line ~202: `18.2k`, footnote "3 of 5 platforms report
   reach"). The footnote's *count* survives (Facebook remains a reach
   reporter), but the tile's FB share now rides
   `post_total_media_view_unique`. If the sheet ever names the FB field in tile
   provenance, that is the word.
3. **The chart tip** (line ~417: "Drawn over the 3 platforms that report
   reach. LinkedIn and Bluesky are not in it…") — **survives unchanged**: FB
   is still legitimately inside the reach line, under the new platform word.
   Recorded here so the lead does not "fix" it.
4. **Consistency confirmations (no edit needed):** Bluesky cells "no
   impressions" (~287, ~365) shorten the capability reason *"no impressions in
   the API"* — compatible; LinkedIn "partner-gated" (~272-273, ~334-335)
   matches the `gated` refusal word verbatim.

### Adjacent fixture observations (not capability conflicts — lead's call)

- The sheet's **Blog row** (Reach `2,240`) has no wire source: blog/site
  deploys are not `social_publications` rows and no metrics reader exists for
  them, so the BUILT surface never renders a Blog analytics row. Fixture-only.
- Tile arithmetic slop: the drawn per-row reach values sum to 18,620, the tile
  reads `18.2k`. Fixture licence, noted only because a sheet edit is coming
  anyway.
- The sheet's fourth tile ("Steering the next run", `6 of 14`) and the
  "Feeds back ✓ v4" chips fixture a metrics→profile loop that has **no wire
  read yet** — the built surface renders those spots honestly (see "honest
  divergences" below) rather than fabricating the loop.

The BUILT surface renders the capability-truth words from the live read (cell
and tile provenance carry `platformField` verbatim — `post_media_view`,
`post_total_media_view_unique`, …), so the lead's screenshot-vs-sheet diff
closes the loop after the sheet edit.

---

## What shipped (commits, branch `agent/analytics`)

- `ff6032f` **feat(analytics): read-only /api/analytics over the engine
  read-model** — GET only, null-ctx guard (`{ model: null }` on an unseeded
  tenant), `?windowDays` (28 default, 400 on malformed), `new Date()` at the
  route edge. + `route.test.ts` (PGlite, full draft→judge→publication chain,
  injected metric rows).
- `ae34053` **feat(analytics): exact-mock Analytics surface** —
  `components/analytics/` (`analytics.tsx`, `analytics-model.ts`, `client.ts`,
  `plat-mark.tsx`, `analytics.css` scoped `.analytics-surface`) +
  `app/app/analytics/page.tsx` + model/surface tests.
- `a7b4301` **feat(analytics): Analytics joins the rail after Schedule** —
  `NAV_SURFACES` entry + `IconAnalytics` (canonical set) + the sheet's rail
  glyph in `RAIL_ICONS` + the work-cluster label + the shell test's pinned
  label array (see boundary notes).
- this file — the wrap + the deliverable-1 derivation above.

Zero live platform calls, zero credits, nothing armed. `packages/**` and
`docs/research/mock-sheets/**` untouched, as chartered.

## Honest divergences from the sheet's fixtures (all data-truth, not design — geometry/classes are the sheet's)

1. **"Feeds back" never claims `✓ v4`** — the metrics→profile write-back has
   no wire read. Measured rows read `pending`, unmeasured `nothing to feed`;
   each title says why. The `✓ vN` state exists in the code path the day the
   loop lands (the chip only renders what is true on the wire).
2. **Tile 4 "Steering the next run"** renders `—` + *"the metrics→profile
   loop isn't wired yet"* instead of the fixtured `6 of 14` — a fabricated 0
   would read as "the loop ran and nothing fed".
3. **"Where this goes back" pill** reads `none yet` (same reason); the P row's
   excerpt is the honest wait sentence, not the fixtured insight; the C and J
   rows are sheet-verbatim (both already true).
4. **`vs previous N`** rests unarmed (title explains: comparison is fixed to
   the preceding equal window) and drops the sheet's `▾` — a menu glyph on a
   menuless control is a dead door.
5. **Cards** seg option rests unarmed with a title (not built — sheet open
   call b); **Avg/Days/Heatmap** rest unarmed (nothing to segment yet);
   **"What this does →"** is a real disclosure (toggles the explainer), not a
   dead `#` link.
6. The hour box's mono line extends the sheet's copy with the wait's name:
   *"arrives with publication_metrics · the metrics tick is not scheduled yet"*.
7. **Filter band**: one real platform filter wearing the sheet's chip grammar;
   the fixtured `Kind · has video` chip is not drawn — kind truth is only on
   the wire for plan-window-covered drafts, and a filter that silently dropped
   unknown rows would lie. Filters narrow the TABLE; the end-line says
   "narrowed by the platform filter" (the tiles stay whole-window, as the
   sheet itself draws them).
8. **Chart**: reach area drawn from real capture series (per-day last-known
   reconstruction, summed over reach-reporting platforms); the engagement
   dashed line covers only the platforms whose series IS engagement, and the
   tip names both bases (see gap G1). A values-at-a-point readout line sits
   under the axis — the sheet's drawn crosshair is its static state. With no
   series at all the card says *"No metric series yet — the metrics tick has
   not run."*
9. **Sparklines** (tiles + rows) come only from real series; `< 2` captures
   draws nothing (one point has no shape). Real refusal clauses run longer
   than the fixture's, so `.na` cells clamp at two lines with the full reason
   on the title.
10. **Post cell**: title/sub join the plan read by draftId (excerpt · format ·
    deployRef); `pmedia` renders `clip` only for a video-format asset; the
    avatar is the tenant's initials from the pulse read. A post outside the
    plan window renders platform + external id. The sheet's **Blog row** never
    renders — blog deploys are not `social_publications` (see derivation).
11. The as-of line reads *"no measurements yet — the metrics tick has not
    run"* when nothing is measured, instead of a timestamp that doesn't exist.

## Test counts

- **38 new**: 28 `analytics-model.test.ts` (null-vs-0, deltaPct-null → raw
  delta, absence words verbatim incl. deferred/partner-gated/no-impressions,
  no-spark rules, family-mirror pin against engine `METRIC_FAMILIES`, daily
  reconstruction, tip membership, end-line bound) · 6 `analytics.test.tsx`
  (populated bands + honest words, dev-reality empty states, read-failure
  alert+retry, truncated banner, platform knob, window refetch) · 4
  `route.test.ts`.
- Full `apps/web` suite: **151 files / 1315 tests green** (vitest
  `--maxWorkers=2`), incl. the surface-css-scope and shell ratchets.
  `npx tsc --noEmit -p apps/web` clean · eslint clean on touched files ·
  contracts `spec-ground-truth` green.

## What the lead must verify visually (no `next dev` in a lane; no screenshots from me)

- 1440×940 screenshot-vs-sheet on the main checkout after rebase: rail
  (Analytics under Schedule + active state), tile band geometry, the table's
  six-column grid at the sheet's densities, the right column's three cards —
  dark AND light.
- **Dev renders the honest empty states** (dev `publication_metrics` is
  empty — that is TRUE). The populated bands only exist under test fixtures,
  so the populated-vs-sheet diff needs seeded dev data or the lead's call on
  the empty states.
- Not exercisable in jsdom: the `.tip` hover/focus reveal (CSS `:hover`), the
  chart's mouse readout, native `<select>` menus in the sel-ctl chrome, the
  `.na` two-line clamp with real clause lengths.
- Deliverable 1's sheet edit is lead-applied; after it, the screenshot diff
  closes the reconciliation loop.

## Stopped-and-reported gaps / boundary notes

- **G1 — read-model gap (engine FROZEN for this lane, so reported, not
  patched):** `PostAnalyticsRow.trend` carries ONE series per post (audience
  preferred, else engagement). The sheet's chart wants BOTH a reach and an
  engagement line over the reach-reporting platforms, and the engagement
  tile's spark ideally covers every measuring platform — not derivable from
  today's wire (FB/IG engagement SERIES are not exposed; their latest values
  are). The built surface draws the engagement line over its honest, named
  basis instead. Fix when D2 continues: an additive second series (or
  per-family series map) on the read-model row.
- **G2 — pre-existing, lead-owned, untouched:** `RAIL_ICONS` still keys
  `Calendar` while the nav label is `Schedule`, so the Schedule rail item
  renders without an icon (`RAIL_ICONS["Schedule"]` is undefined). Predates
  this lane (the Calendar→Schedule rename); one-key fix in
  `components/workspace/rail-icons.tsx` when the lead is next in there.
- **Boundary exception, flagged loudly:** three lead-owned
  `components/workspace/**` files took minimal additive edits because the
  kickoff's cited ground truth ("nav.ts — the ONE registry; rail + palette +
  topbar route from it") is stale against the shipped rail, which hard-codes
  its cluster label lists and a separate icon map. The mandated rail entry
  cannot exist without: `workspace-rail.tsx` (+`"Analytics"` in the work
  cluster), `rail-icons.tsx` (+the sheet's Analytics glyph), and
  `workspace-shell.test.tsx` (+`"Analytics"` in the pinned label array —
  the pin exists precisely to make registry changes reviewed). Each is one
  line-ish and merge-trivial, but the lead is live in that area this
  session — check for conflicts at rebase.
- The `platform APIs lag up to 48h` clause in the as-of line is the sheet's
  own copy, kept verbatim; it is a general claim about platform insight APIs,
  not derived from the wire — the lead may keep or trim it at the gate.
