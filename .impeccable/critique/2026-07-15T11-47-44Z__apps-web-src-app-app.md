---
target: workspace dashboard (apps/web/src/app/app), post dashboard-v3
total_score: 30
p0_count: 0
p1_count: 2
timestamp: 2026-07-15T11-47-44Z
slug: apps-web-src-app-app
---
Method: dual-agent (A: design-review agent · B: detector-evidence agent)

# Critique — workspace dashboard (post dashboard-v3), 2026-07-15

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Counts/"–"/overdue honesty excellent; but the week band renders empty while 4 drafts wait (they started waiting before Monday) |
| 2 | Match System / Real World | 3 | "poller quiet", "fanned out", "the last pointer expected one" — engine-room dialect in operator copy |
| 3 | User Control and Freedom | 3 | Doorways + lens toggle + retries everywhere; overdue-sweep warning has no recovery affordance |
| 4 | Consistency and Standards | 4 | One card/badge/focus vocabulary throughout; smudges: blue icons on non-interactive rows, topbar title below its own Headline spec |
| 5 | Error Prevention | 3 | Judge gate is the posture; disabled empty-submit; little else to prevent here |
| 6 | Recognition Rather Than Recall | 3 | Counts restated beside actions; but WHICH runs hold the waiting drafts must be hunted after the handoff |
| 7 | Flexibility and Efficiency | 3 | Omnibox family pre-pick, ⌘K, j/k on approve; no "next waiting draft" path from the dashboard |
| 8 | Aesthetic and Minimalist Design | 3 | Disciplined and calm; noise = empty 7-box week band + a column of identical "7d ago" stamps |
| 9 | Error Recovery | 3 | EngineUnreachableCard exemplary; ErrorNotice+retry everywhere; overdue-sweeps names the problem, offers no fix path |
| 10 | Help and Documentation | 2 | First-run tutorial + card descriptions; no help surface beyond that |
| **Total** | | **30/40** | **Good — address weak areas, solid foundation** (baseline 2026-07-14: 25/40) |

## Anti-Patterns Verdict

**LLM assessment (A):** not AI slop — a system with its own laws, visibly enforced (two channels held at squint, no banned patterns, station numbers 01–05 pass sequence-with-meaning; the drafting-sheet conceit is the page's one flourish and is correctly scoped). Pauses: engineering dialect in copy, and station plates showing faint beige source rectangles on card white.

**Deterministic scan (B):** static CLI scan over dashboard/workspace/library/approve components: **0 findings** (canary-verified the detector works and is DESIGN.md-aware). Runtime browser detector: `/app` 5, `/approve` 4, `/library` 2 — of which the real items are: `line-length` ~185ch on the pipeline "Why:" lines (matches A's "reads like corrupted text"), `tiny-text` 11px + `text-overflow` by 153px on the approve panel's mono meta line (pre-existing, A missed it), `nested-cards` on the shared topbar tenant-switcher summary (pre-existing). Judged false positives against the system's own laws: `overused-font` geist/geist-mono (the One-Family Rule is deliberate), `all-caps-body` on `u-eyebrow` (scoped HUD label), `wide-tracking` on the aria-hidden sheet title block (the flourish, not body text).

**Visual overlays:** headless session — no user-visible tab; console capture used instead (recorded above). Zero console errors and zero failed network requests on all three pages.

## Overall Impression

The dashboard now answers all four questions (what needs me · what's the engine doing · what will happen · where is each asset) inside one visual system, and the honest-states discipline is structural, not cosmetic. The single biggest opportunity: the page's dominant action ("Review queue") is the one path that breaks its promise — fix the handoff and the whole surface's trust story closes.

## What's Working

1. **Honest-states discipline made structural** — "–" for unresolved reads, the engine-unreachable card that refuses to impersonate a quiet day, and sweep projection that declines to draw fiction from a dead pointer.
2. **The two-channel doctrine survives squinting** — every amber element genuinely waits on the operator; the one blue button is unambiguously the action.
3. **The flow schematic earns its spine role** — live counts at stations, honest sub-lines, doorways everywhere; a signature, not a template.

## Priority Issues

- **[P1] Review-queue handoff breaks the promise** — "4 drafts wait on you" lands on the newest run (0 queued, already-approved draft); no cue which runs hold the 4. Fix: default-select the run with waiting drafts (oldest first) + badge waiting counts per run in the feed. Suggested command: /impeccable polish
- **[P1] Week calendar hides drafts that still wait** — waiting-since falls before Monday, groupByDay drops it; a band subtitled "what waits on you" renders empty while 4 wait. Fix: waiting is a present state — carry pre-week waiting into today (or a leading "overdue" bucket). Suggested command: /impeccable polish
- **[P2] Stations 03/04 are one door wearing two numbers** — both link to /app/approve unfiltered; the blocked/queued distinction dies at the click (and 05 exits into the public /blog register silently). Fix: status-filter params per station. Suggested command: /impeccable polish
- **[P2] The empty week band spends a full band saying nothing** — while the two important facts (sweeps overdue · no cadence rules) sit in the quietest text on the page with no affordance. Fix: collapse a zero-entry week to a summary row; give overdue-sweeps a doorway. Suggested command: /impeccable layout
- **[P3] Channel and scale smudges** — blue Radar/CircleCheck icons on non-interactive rows; stepper "attention" stage is amber-color-only (no word for SR or CVD); "Why:" lines run ~185ch; approve panel's 11px mono meta line overflows 153px; topbar title below Headline spec; station plates show beige source rectangles. Suggested command: /impeccable polish

## Persona Red Flags

**Alex (power user):** the one button he clicks lands on the wrong run; 12 chrome tab-stops before content (no skip link); no one-keystroke "review next waiting"; no cross-run bulk.

**Sam (SR/keyboard):** station accessible names concatenate without separators ("01 · Intel1areas watchedsweeps overdue — poller quiet"); "–" announces as "dash" with no unknown-state alternative; stepper attention detail lives in title attributes; no aria-live on needs-you/pulse changes. Keep: aria-current on today, aria-pressed lens toggle, role=alert on unreachable card, labeled skeletons.

## Minor Observations

- Activity: column of identical "7d ago" stamps; list clips mid-row at max-height with no fade/affordance.
- Stepper wording: queued asset shows amber on a stage labeled "Decided" — word says done, color says waiting.
- "Why:" lines quote judge text quoting draft copy — gate-plus-summary would scan better on the dashboard.
- The count "4" agrees at every appearance (topbar/sidebar/card/stations) — protect this invariant.
- Mobile 390px holds (bands scroll in-card; tab strip replaces sidebar).
- HeatGrade — the system's signature — appears nowhere on the dashboard.

## Questions to Consider

1. Should the dominant action be a doorway to a run browser at all — or to the *next waiting decision* (inbox mechanics)?
2. Should the schematic absorb the needs-you card, making station 04 THE call to action instead of duplicating its numbers?
3. Is the dashboard deliberately a heat-free zone, or should station 01 carry the hottest intel card's HeatGrade? If deliberate, write the rule down.
