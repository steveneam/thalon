# Workspace Phase D — design record (opened s58 · design-complete s59, checkpoint-ripe)

> Phase D of the workspace redesign (founder pulled it forward post-s57; queue
> row 1). The designs themselves live in claude-design, project **"Thalon
> workspace — Phase D (journey spine · calendar · boards)"** — three annotated
> `.dc.html` mocks, each carrying its own decision table for the founder
> checkpoint. This file is the repo-side pointer + decision ledger: what was
> decided, what is flagged, what Phase D still owes. Inputs of record:
> founder's journey-first direction (COORDINATION s56 verdict + s57 messages),
> `boards-calendar-ui-patterns.md` (survey; §4 adopt/adapt/reject, §5 open
> questions), `DESIGN.md` §5 (list grammar incl. the Bounded-List Rule),
> `workspace-ux-v2.md` (§1 dossier/context spine, §10 dashboard v3).

## The three designs (session 1 of Phase D)

1. **Workspace Spine** — the dashboard IS the journey: five stations
   (intel → pick → create → approve → fan-out) on a literal connecting line,
   each with live state + one primary action; extras (Leads · Library ·
   Videos · Runs, Profiles/Settings at the foot) demoted to a slim icon
   side-rail; top bar keeps tenant switcher + needs-you badge. Below the
   spine: the week strip (dashboard-v3 item 2, honest three-mark legend:
   engine / waits-on-you / planned slot) and a bounded Needs-you list.
   Pick is a state, not a route — its exits live on the intel dossier cards.
2. **Content Calendar ("Fan-out")** — month view + right-hand day panel;
   Month/Week/Agenda density tabs; channel filter chips + first-class
   exclusion filters; always-visible timezone chip (operator-local);
   drag-to-reschedule with Terminal Toast, no dialog, terminal verbs never
   drop targets; recurrence marker = word + icon ("↻ wk").
3. **Leads Board** — the first (only) v1 board, as a saved-view tab on the
   Leads surface: columns = operator-owned stage field values, drag = one
   UPDATE; advisory WIP `count / limit · over` chip (bronze word, never
   blocks); GitHub-model saved views with unsaved-dot; bulk bar spans
   columns; Dismissed stays a tab, never a column.

## Survey §5 answers (decided in the designs)

| Q | Answer | Where |
|---|--------|-------|
| Q1 which surfaces board | Leads only in v1 (operator-owned stages ⇒ honest drag). Approve is NOT a board — its stages are engine-derived (judge gates), drag would fake agency; it keeps list + detail. Scheduling lives on the calendar. | Leads Board |
| Q2 cell overflow | 3 chips then "+N more"; day click opens the day panel (same route, no navigation); panel scrolls internally past 8. | Calendar |
| Q3 lane dimension | Flat + channel filter chips; no swimlanes v1; calendar always scoped to the active tenant (cross-tenant rejected — tenancy rule). | Calendar |
| Q4 reschedule undo | Drag-back + Terminal Toast with "view" link; no confirm on non-terminal drags. True undo-after-terminal rides the queued B-crm contract change (flagged). | Calendar |
| Q5 2D keyboard | useListKeys extended: j/k in column, h/l across, x multi-select spans columns, Four-Verbs letters act; named confirms intact. Differentiator — no surveyed tool documents any keyboard grammar. | Leads Board |
| Q6 timezone | Operator-local + always-visible zone chip; per-tenant audience-zone lock = Settings config (not checkpoint-blocking). | Calendar |
| Q7 WIP limits | Advisory, per-view setting, default none; word "over" in bronze; never blocks (blocking would make amber act). | Leads Board |
| Q8 saved views | Per-operator until "Save view" shares tenant-wide; unsaved-dot + word. Tabs = a sanctioned Bounded-List bound. | Leads Board |
| Q9 recurrence | v1 one-shot only; marker grammar designed (word+icon); series-edit + date-override = schema work, **flagged for the checkpoint**. | Calendar |

Bounded-List conformance is stated per surface in each design's annotation
table (needs-you 16rem scroll · day panel scroll past 8 · board region 30rem
with sticky-header counts · month cells 3+N). Two-channel purity audited in
each: bronze appears only as signal (needs-you, gated, over, unsaved),
blue only as act.

## Flagged for the founder checkpoint (not designed in v1)

- Recurring-slot series editing + date overrides (Q9) — schema work.
- Undo-after-terminal (Q4) — rides the queued B-crm approve/reject change.
- Per-tenant audience-zone lock (Q6) — Settings config detail.
- The approve-queue informed-consent panel + judge-reason display (ux-v2 §10
  critique backlog) — Phase D session 2 scope.

## Session 2 (s59) — the owed designs, DONE

4. **Intel Dossier** — the card as launchpad (ux-v2 §1/§3 concrete): heat +
   magnitude + outlier, provenance with source link, why-it's-moving, 4 ready
   titles (copy buttons), 3 angles, 1 hook, per-family exits with an honest
   "suggested" pre-pick; cadence stamp + Sweep-now in the header; watchlist
   chips in place (auto-discovered wear a bronze "auto" word); Dismiss = the
   quiet teaching verb; rising list bounded (14rem, count stated).
5. **Create Handoff** — the seam that never re-asks: capture rendered as six
   typed removable chips (title · angle · hook · source · area · heat — the
   s52 judge-block lesson as UI); working title + prompt pre-seeded; settings
   panel marked "profile" per row; One-prompt | Advanced toggle; honest
   five-step goal gradient (profile ✓ context ✓ genuinely done); the
   outcome-stating generate button names the judge gate.
6. **Approve Consent** — informed consent: lineage chips (intel → run →
   judge, every node a deep link), profile + model seats visible, per-check
   judge verdicts with reasons VERBATIM (positive case included), the
   consequence-stating approve sentence, quiet-red Reject with named confirm,
   and the blocked-sibling inset stating the fail-closed rule in UI copy.
7. **Calendar Week** — completes the density ladder: 06:00–20:00 window with
   quiet hours collapsed + honest count, ONE shared time→position mapping
   (a label may never drift from the slot it names), now-line on the act
   channel, same drag/toast/terminal discipline as month.

**Icon cleanup (design decision, not a mock):** the Spine's side-rail set is
the canonical icon grammar — 17px, 1.5–1.8px stroke, no fills, one metaphor
per feature (journey dots · leads person+lines · library spines · videos
player · runs trend · profiles person · settings gear). Surfaces drop local
icon variants and import the rail set; the per-surface sweep is Phase I
implementation work (W-spine owns `components/ui`).

## Next: the founder design checkpoint (gates Phase I)

All seven designs live in the claude-design project, each with its in-file
annotation table. The checkpoint also carries: manifest schema model/credits
fields · headlamp.webp provenance cleanup · the Q9 recurrence flag · the Q4
undo-after-terminal flag. On approval → Phase I lane map (W-spine lead ·
W-intel · W-create · W-boards, per the s56 plan; new component homes
`components/calendar` + `components/board` keep Phase I lanes disjoint by
construction; every lane launch = fresh founder approval).

*Owner: lead. Fable-5-authored per the standing design rule; no design
subagents were run.*
