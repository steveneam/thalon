# KICKOFF — lane `analytics` (the Analytics BUILD + the Facebook fixture reconciliation)

**Charter:** the founder's s91b GO, on record verbatim — *"board approved and go
analytics"* (2026-08-02; COORDINATION §s91 close item 2). Launch is Mode B in the
`thalon` tmux session. You own branch `agent/analytics`, worktree
`.claude/worktrees/analytics`.

**Read-only against the engine. Zero live platform calls, zero credits, nothing
armed.** You build a surface and one read-only API route over reads that already
exist. Every platform number in your tests is an injected fake.

---

## What you build

### 1. The Facebook fixture reconciliation (derive; do NOT edit the sheet)

`packages/engine/src/social/metrics/capability.ts` is the truth (its facebook
entry, `verifiedOn: "2026-08-01"`): Meta retired the `post_impressions*` family
(2025-06-15 / 2025-11-15). What Facebook reports NOW, per that file's `reports`:

- **views** = `post_media_view` (the impressions replacement)
- **reach** = `post_total_media_view_unique` (the surviving unique-audience metric — the reach COLUMN lives, under a different platform word)
- clicks = `post_clicks` · reactions = `post_reactions_by_type_total` · comments = `comments.summary.total_count` · shares (post-object)

The sheet (`docs/research/mock-sheets/Analytics.dc.html`) draws Facebook
reporting "Reach" on the pre-retirement assumption. **Your deliverable is a
derivation, not a sheet edit**: a short section in your wrap
(`agent_handoff/lanes/WRAP-analytics.md`, written as you go) stating exactly
which fixture strings/tooltips/values in the sheet conflict with capability
truth and the corrected wording/values — provenance words verbatim from
capability.ts. **The LEAD applies the sheet edit at the merge gate; sheets are
lead-owned. `docs/research/mock-sheets/**` is outside your file set.** Your
BUILT surface renders the capability-truth words from the live read, so the
lead's screenshot-vs-sheet diff closes the loop after the sheet edit.

### 2. The Analytics build — `Analytics.dc.html` → `/app/analytics`, exact-mock

DOCTRINE 0: this is a demolition-grade exact-mock build, not an improvisation.
The sheet is the spec of record (ledger row 1, DONE s85b + tooltips + rail
sweep). Sheet-verbatim values (radii, font sizes) are intentional even where
lint/design hooks grumble — the shipped `approve.css`/`runs.css` are the
precedent. The mock-sheets contract README's rule 6 binds you: **every CSS rule
scoped under `.analytics-surface`** (applied beside `.content` on the surface
root) in a new `apps/web/src/components/analytics/analytics.css` — the sheets
deliberately reuse class names with different values across surfaces.

What the sheet draws (and its honesty rules, which won every conflict with
"more visual" — header comment, lines ~20–36):

- **Tiles** with value + previous-window delta + sparkline; a delta from
  `previous: 0` is NOT a percentage (`deltaPct: null` — render per sheet).
  Each tile's honest footnote = `platformsNotReporting` with reasons.
- **Posts table**: post rendered in-row at full fidelity (avatar + title + sub
  + media chip) · real platform marks (the sheet's own SVGs, surface-local —
  NEVER invented logos; `components/approve/plat-mark.tsx` is the Approve-scoped
  precedent, don't import it cross-surface, lift the sheet's markup) · Sent
  date · Reach · Engagement · per-row sparkline **only where a series exists —
  a row with no metrics gets an empty cell, never a flat line at zero** · the
  "Feeds back ✓ v4"-style provenance chip only where true on the wire.
- **Channels**: `reportsAudience: false` renders WORDS, never a 0 —
  "partner-gated" (LinkedIn), "no impressions in the API" (Bluesky, whose
  engagement counts ARE real), and X = **deferred** ("we won't yet", not "we
  can't" — the founder's s87 cost ruling; the read-model already carries the
  `deferred` absence word).
- **28-day area chart** drawn ONLY over platforms that report reach, and it
  SAYS SO on the card (the "how this line is built" tip, verbatim grammar).
- **Engagement by hour**: the reserved box with Avg/Days/Heatmap seg,
  explicitly EMPTY, naming what it waits on (the metrics tick is not
  scheduled) — never a fabricated curve.
- **Every number carries its as-of** (s83b copy grammar; `MetricCell.asOf`).
- `value === null` and `value === 0` are DIFFERENT facts and render
  differently: the first is a sentence, the second is a zero.
- The `bound.truncated` flag: when true, the deltas are computed over less
  than they claim — the surface must say so.
- **Dev reality**: dev `publication_metrics` is empty (no tick has run). The
  surface renders its honest empty states on dev — that is TRUE, not a bug.
  Your tests exercise the populated states with injected fakes.

## Ground truth — dependencies as facts (rule 12)

Existing, cited verbatim (read them before writing anything):

- `docs/research/mock-sheets/Analytics.dc.html` — THE spec · `docs/research/mock-sheets/theme.css` · `docs/research/mock-sheets/README.md` (rule 6 + the collision list)
- `packages/engine/src/social/metrics/read-model.ts` — `analyticsReadModel(deps, input, now)` → `AnalyticsReadModel { window, previousWindow, published, audience, engagement, posts, channels, bound }`; `MetricCell { value, parts, reason?, absence?, asOf }`; `PostAnalyticsRow` (incl. `trend: … | null` = draw NOTHING); `ChannelAnalyticsRow` (incl. `reportsAudience`); `AnalyticsTile` (incl. `platformsNotReporting`, `deltaPct: null` on zero-previous). Two queries total; the clock is an argument.
- `packages/engine/src/social/metrics/capability.ts` — `MetricLabel` / `MetricFamily` / `MetricAbsence` (`"structural" | "retired" | "gated" | "permissioned" | "no_driver" | "deferred"`) + the per-platform vocabulary truth
- `packages/engine/src/social/metrics/__tests__/read-model.test.ts` — the fixture patterns to extend, not fork
- `packages/db/src/repos/publication-metrics.ts` — `publicationMetricsRepo` (`latestPerLabel`, `listForPlatform`, `seriesForPublications`); reached only through `repos`
- `apps/web/src/lib/repos.ts` (`getRepos`) + `apps/web/src/lib/tenant.ts` (`resolveTenantCtx`) — the route pattern of record is `apps/web/src/app/api/create/runs/route.ts` (read-only GET, null-ctx guard, one JSON shape)
- `apps/web/src/lib/workspace/nav.ts` — `NAV_SURFACES`, the ONE registry (rail + palette + topbar route from it) · `apps/web/src/components/ui/icons.tsx` — the canonical icon set
- `apps/web/src/app/app/layout.tsx` + `apps/web/src/app/app/workspace.css` + `apps/web/src/components/workspace/**` — the shell you render inside (read, never edit)

New, marked:

- `apps/web/src/app/app/analytics/page.tsx` **(new)**
- `apps/web/src/app/api/analytics/route.ts` **(new)** — read-only GET calling `analyticsReadModel` with `{ repos, ctx }`, `new Date()` at the route edge (the engine takes the clock as an argument), `windowDays` 28 default
- `apps/web/src/components/analytics/**` **(new)** — components + `analytics.css` scoped `.analytics-surface` + tests
- One `NAV_SURFACES` entry **(new, additive)**: label "Analytics", href `/app/analytics`, `section: "work"`, inserted AFTER Schedule (the sheet's rail order: Home · Intel · Create · Approve · Schedule · **Analytics**) + `IconAnalytics` **(new, additive)** in `icons.tsx`, drawn in the set's one-metaphor grammar. **Do NOT touch the Transcription entry** — the sheet's rail says "Library", but that rename is the s93 Sites+Library arc, not yours.

## File set — DISJOINT, hard boundary

Yours: `apps/web/src/app/app/analytics/**` (new) ·
`apps/web/src/app/api/analytics/**` (new) ·
`apps/web/src/components/analytics/**` (new) · the additive
`nav.ts`/`icons.tsx` entries above · your own test files.

**NOT yours:** `docs/research/mock-sheets/**` (lead-owned) ·
`packages/**` (contracts + schema + engine + db FROZEN for you — the reads
exist; if the read-model turns out to miss something the sheet needs, STOP
and report the gap in your wrap-in-progress, do not add engine code) ·
dashboard/create/composer/board surfaces and `components/workspace/**` (the
LEAD is live in those files this session) · `.env*` · anything armed.
Outside the set = STOP and report.

## Gates, and the box

- **vitest capped: `npx vitest run --maxWorkers=2 -w …`** — never an unbounded
  pool, and NEVER `pkill -f vitest` (it matches every worktree and kills the
  lead's suites — measured s82). `vitest run -w <pkg>`: note `-w` without
  `run` is `--watch`, and vitest does not typecheck — run
  `npx tsc --noEmit -p apps/web` before calling green.
- **No `next dev` in the worktree** (Turbopack rejects out-of-root symlinks).
  No screenshots from you — the LEAD is the screenshot-vs-sheet merge gate on
  the main checkout after rebase. Build for the sheet, state in your wrap what
  you could not visually verify.
- **NEVER `npm install`** in the worktree (preinstall guard; node_modules are
  symlinked from the main checkout).
- Commits: conventional, small, no AI attribution (repo standing rule).
- Multi-tenant: every read rides `resolveTenantCtx` — no tenant-less query.
- Wrap: `agent_handoff/lanes/WRAP-analytics.md` — what shipped (commits),
  the fixture-reconciliation derivation (deliverable 1), test counts, what
  the lead must verify visually, any stopped-and-reported gaps. Then stop —
  the LEAD rebases, gates, and merges. Do not merge, do not push to main.
