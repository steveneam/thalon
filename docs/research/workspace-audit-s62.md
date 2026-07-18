# Workspace audit — s62 (W-audit items c + d)

> **Status: DONE (s62)** — the full `/impeccable audit` pass over every
> workspace surface + the parked s40 consistency re-critique, run against the
> redesigned (Phase I) workspace on live dev data at 1440 and 390. P0/P1 and
> cheap-P2 findings were FIXED in the same session (commits inline below);
> the rest are queued follow-ups. Companion work the same session: the
> Source-Link sweep + thumbnails (item b) and the storage-story audit +
> saved-views wiring (item e).

## Audit health score (after same-session fixes)

| # | Dimension | Score | Key finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 3/4 | AA tokens executable (incl. the new `ok` pin); live regions + keyboard grammar everywhere; residual: 11 form fields lack `id`/`name` |
| 2 | Performance | 4/4 | static-first, lazy images, zero external requests, no layout-thrash patterns |
| 3 | Responsive | 3/4 | calendar 390 bleed + rising-row starvation found & fixed; approve/leads/board/create verified 390-clean |
| 4 | Theming | 4/4 | token discipline near-total; the one hard-coded color (judge green ×2) tokenized |
| 5 | Anti-patterns | 4/4 | no slop tells; eyebrow is a scoped HUD label, not scaffolding; honest states everywhere |
| **Total** | | **18/20** | **Excellent** (16/20 before fixes) |

**Anti-patterns verdict: PASS.** No gradient text, no side-stripes, no
glassmorphism, no hero-metric template, no card-grid monotony. The strongest
tell-resistance is structural: honest empty/unarmed states ("publish door
unarmed — slots are plans") are product voice no template generates.

## Fixed this session

- **[P1] Calendar month, 390: slot chips bled across day-cell boundaries** —
  chips visually attached to the wrong date (chip anatomy time+title+pill has
  ~100px of shrink-proof content vs ~40px cells). Fix: phones show a per-day
  COUNT (the day panel carries the chips; the day button's aria-label already
  announces the count), `overflow-hidden` belt on every cell, tighter phone
  rows. Desktop unchanged. `month-grid.tsx`
- **[P1, pre-existing] main was red**: the sites model test pinned
  sparkwright's verdict as data; the founder's acceptance flip (740aa6f,
  docs-treated, suite never ran, Actions billing-dead) broke it. Fix: the
  test now checks `verdictStatus` logic against every record + a synthetic
  unverdicted record — verdict flips can never redden the suite again. `65248db`
- **[P2] Placeholder text was browser-default gray** (below AA on paper) —
  global `::placeholder { color: var(--muted-foreground) }` (the AA-pinned
  secondary-ink token). `globals.css`
- **[P2] Judge-pass green hard-coded twice** (`text-[oklch(0.5_0.1_160)]`) —
  now `--ok` in both themes, wired into the AA-Executable contrast pins.
  Doctrine note: `ok` is a semantic STATE color (the same class as
  `destructive`), not a third channel; the ✓/word always carries the state.
- **[P2] Bounded-List gaps: Runs history and the Library shelf grew with
  data** — both now bounded regions with stated counts (the approve-queue
  grammar). `runs-list.tsx` · `library-surface.tsx`
- **[P2] Rising rows at 390 truncated titles to ~2 characters** even before
  the new origin anchor — title now wraps to its own full-width line on
  phones. `rising-list.tsx` (shipped with the Source-Link sweep, `d6c3935`)

## Reported — queued follow-ups (not fixed this pass)

- **[P2] 11 form fields lack `id`/`name`** (Chrome issues panel; profiles
  editor + ingest/create inputs). aria-labels exist, so AT is fine — this is
  autofill/tooling hygiene. → a `/impeccable harden` micro-pass.
- **[P2] `text-[11px]` arbitrary sizes** in ~6 files (staged/approve
  components) sit between the named steps (label 12px · micro 10px) — the
  named-step doctrine says pick one. → `/impeccable typeset` micro-pass.
- **[P3] z-index**: toast and command palette both `z-50` (toast should sit
  above modal in a semantic scale). Cosmetic until they co-occur.
- **[P3] Create settings panel**: the right-aligned Voice value wraps
  awkwardly against its PROFILE chip at some widths.
- **[P3] Videos project row** could carry a poster thumbnail (visual identity
  for the film row; its takes have stills).
- **[Engine data-honesty question, not UI]**: `fanout_runs.status` stays
  `pending` on rows whose drafts are already judged (Runs shows three
  "pending" email runs with blocked/approved drafts). Either the compose path
  misses a `running→complete` transition or the word is wrong on the surface.
  Needs an engine-side look before any UI change.

## The s40 re-critique (item d) — consistency verdict

The five list recipes + Four-Verbs audited across every surface on live data:

- **Four-Verbs**: intel/leads = Dismiss · library = Delete (named confirm) ·
  approve = Reject · create chips = Remove — clean, no synonym drift.
- **Selected-row**: one treatment everywhere (conformance test extended in
  Phase I covers board + needs-you too).
- **j/k grammar**: every triage list shows its `keys ·` legend + sr-only live
  region (approve, leads list, board 2D, library, videos, sites).
- **Bounded lists**: approve states its bound; rising list states its bound;
  board columns scroll internally with counted headers; **runs + library
  shelf were the two gaps — fixed above**.
- **Two-channel purity**: blue only ever acts, bronze only ever signals, on
  every surface swept (the calendar's `gated` pill and needs-you badge are
  the bronze channel; Plan slot / exits / links all blue).
- **Honest states**: every not-yet-wired thing SAYS so in place (station 02
  "not tracked yet", calendar "slots are plans", create's advanced-door note,
  board's drag inset, profiles' re-activation note). This held everywhere —
  the Phase-I lanes' strongest shared property.

## Positive findings worth keeping

- The AA-Executable pattern (tokens pinned by a real contrast computation)
  meant the new `ok` token shipped WITH its proof — extend this to any future
  state color.
- `SELECTED_ROW` conformance-by-import + the shared `useListKeys` are why the
  consistency critique came back clean — recipes as code beat recipes as docs.
- Zero external requests on every workspace surface (fonts vendored, images
  local/lazy) — keep it that way when live thumbnails arrive (they're
  operator-supplied origins, the one sanctioned external image class).
