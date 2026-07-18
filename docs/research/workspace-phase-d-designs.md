# Workspace Phase D — design record (opened s58)

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

## Phase D still owes (session 2)

- Intel dossier card + per-family exits + Create context-chip handoff mocks
  (ux-v2 §3 — the data-shape is ratified, the surfaces need their mocks).
- Week view detail of the calendar; approve list refinements (judge reasons,
  consent panel); icon-set cleanup pass across all surfaces.
- Then: **founder design checkpoint** → Phase I lane map (W-spine · W-intel ·
  W-create · W-boards, per the s56 plan; new component homes
  `components/calendar` + `components/board` keep Phase I lanes disjoint).

*Owner: lead. Fable-5-authored per the standing design rule; no design
subagents were run.*
