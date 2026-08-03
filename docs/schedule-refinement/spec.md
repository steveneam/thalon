# The Schedule calendar refinement — plan + spec (the "calendar part", stamped s94)

> **Status: DRAWN s95 · W3 APPROVED (founder in-session, s95: "Everything
> else is ok … W3 is approved") — THE BUILD IS UNBLOCKED** (Phase-3 item 3 in
> `docs/video-arc/spec.md` §"The s95 execution plan"). Authored s94 on the
> founder's direction: *"continue refining the plan and spec for the video and
> calendar part as needed (mobbin, postiz, research etc)."*
>
> **s95 execution record:** S1 was already DRAWN at pass 1 (s86) — the fresh
> pull re-surfaced the same Later screen top-ranked, and the density question
> closed NEGATIVE (no product puts media in a month cell: Midday, Airtable,
> Toggl all text-only), so thumbs stay a week+agenda affordance and S1's
> remaining work is the BUILD (the event-media read widening below). S2 is
> RECORDED in the sheet's amendment block (month grammar: kind colour →
> platform glyph → clock + lead). S3 is DRAWN (the Thu 11:00 concurrent
> cluster; kickoff verify ran: month cells and the waiting lane already carry
> counts — the gap is `placeColumn`, which splits concurrent time-grid events
> evenly with NO cap; the build caps at 2 + count-door). S4 done: the sheet
> carries the amendment block, `Calendar.dc.html` is archived, the ledger's
> §Schedule rows are flipped, and the live spec pointers in `schedule.css` /
> `schedule-surface.tsx` were repointed to `Schedule.dc.html`.
>
> **BUILT s96 (2026-08-03, `ea29e49`).** S1: `PipelineAsset.media`
> (serializer-only; the draft's own `meta.mediaRefs` first image — the spec's
> `meta.posterRef` citation was corrected against ground truth at kickoff,
> rule 12) → `CalEvent.platform/media` → the chip's `.ev-media` through
> SourceThumb's five states at this surface's 30×22 `.thumb-sm` override,
> platform badge riding the thumb, Aa for text-only; `MEDIA_CHAINS.draft`
> argued open in the chain ratchet; the workspace media door reads the
> `social-media/` family beside `media/`. S2: the month mark carries the
> platform glyph. S3: `placeColumn` returns `{placed, overflow}` — cap 2 by
> mark priority, the `+N more at HH:MM · open day` door opens the agenda.
> Pins: `__tests__/schedule-s96.test.tsx` + the model/chain suites.

## What "calendar" means now (re-grounded s94 — rule 12, no inherited claims)

The Calendar SURFACE is fully retired: `Calendar.dc.html` is SUPERSEDED
(mock-sheets README, rail sweep 2026-07-29), the D4 `Schedule.dc.html` was
ratified and **BUILT s86** at `apps/web/src/app/app/schedule/page.tsx`
(surface `apps/web/src/components/schedule/schedule-surface.tsx` + model
`apps/web/src/components/schedule/schedule-model.ts` + scoped
`apps/web/src/components/schedule/schedule.css`), the rail carries
**Schedule**, and no `/app/calendar` route exists in the app. The old
open-decision line ("the shipped surface is still `/app/calendar`") is stale
— that rebuild landed. So "the calendar part" = **the refinement pass over
the built Schedule surface**: the banked-but-PENDING references, applied.

What the surface already has (cite, never rebuild): three densities
(week · month · agenda — `monthCells` in the model), the three-fact split
(planned/queued/published legend), drag + the slot write door
(`apps/web/src/app/api/schedule/slots/route.ts` over `planned_slots`,
upsert + events in one transaction), cadence pressure before commit, the
waiting lane, honest read-failure states, and the tenant-wide saved view.

## The refinements (each is a banked reference with a verdict-ready shape)

**S1 — media thumbnails inside the time-grid cells** (Later ·
`mobbin.com/screens/85de220d-…`, banked s85b, *PENDING* — the ledger's own
words: "the single biggest visual win available to this surface"). An event
chip whose draft has media wears its thumb; you recognise a post by its
picture before its words — the same media-first doctrine every other surface
already follows (B-media.0).
- Data: `CalEvent` (schedule-model.ts) today carries `lead/meta/excerpt` and
  NO media. The event read derives from the plan + queue reads
  (`fetchPlan`/`fetchQueueRows` in `apps/web/src/lib/workspace/client.ts`);
  the drafts behind them carry `meta.posterRef` (the B-media contract) and
  the one resolver is `apps/web/src/lib/media/resolve.ts` +
  `apps/web/src/components/media/source-thumb.tsx`. Work: the event wire
  gains a resolved media state `(new — a read widening on the existing
  routes, no schema change; the s90 windows stay frozen)`, and the chip
  renders it through SourceThumb's five states — a draft with no media keeps
  today's text chip, never a stripe forced into a 45px cell.
- Density rule: thumbs render at week density; at MONTH density the cell is
  too small for honest media — the month event keeps the Sprout grammar (S2)
  and the thumb stays a week/agenda affordance unless the fresh Mobbin pull
  (below) shows a month treatment that survives 1440×940 without lying.

**S2 — the month event grammar** (Sprout Social · month,
`mobbin.com/screens/31ee54e5-…`, banked s85b, *PENDING*): event = platform
icon + time + excerpt, action icons on hover. Ours keeps the three-fact
colour split as the organizing idea (the monday.com platform-colour legend
stays REJECTED — recorded in the ledger) with platform identity riding the
glyph, exactly as the week chips already do.

**S3 — concurrent-events "+N more"** (the lead's s77 call, recorded in
mock-sheets README §Calendar): capped visible chips, the remainder behind a
count that opens the day. Carried to the Schedule sheet's week AND month
densities; verify at kickoff whether the s86 build already honours it at
week density (the README's note predates Schedule) — if it does, the work is
month-only.

**S4 — sheet + record hygiene in the same change:** `Schedule.dc.html` gains
the amendment block recording S1–S3 (canvas → re-export, the house flow);
`Calendar.dc.html` moves to `docs/research/mock-sheets/archive/` — its
"stays that code's spec until the rebuild lands" clause expired when
Schedule shipped s86; the ledger's §Schedule PENDING rows flip to TAKEN with
build stamps.

## Research posture (the founder's "mobbin, postiz, research etc")

- **Banked and sufficient to draw**: the three §Schedule references above
  (s85b sweep). The amendment draws from them directly.
- **Fresh Mobbin pull at the design block** (s93 re-check precedent): one
  sweep for month-cell media treatments + one for thumb-in-cell week views,
  to confirm Later/Sprout still read best-in-class before the pencil moves.
  (Attempted s94 from this box; the Mobbin MCP errored twice — do it in the
  design block, do not block the plan on it.)
- **Postiz**: their HOME is the calendar (W1 walk, s89 — banked). Their
  calendar-as-home is REJECTED for us (Schedule owns the calendar; Dashboard
  owns triage) and that ruling stands. The one Postiz item worth a re-look in
  the design block: their per-post calendar cards' media treatment, as one
  more thumb-in-cell datapoint. No API/pipeline take here — scheduling
  mechanics (queue, cadence, slots) are already ours and shipped.

## Dependencies (rule 12 — existing verbatim, future marked)

- Sheet: `docs/research/mock-sheets/Schedule.dc.html` (amend) ·
  `docs/research/mock-sheets/archive/Calendar.dc.html` (the S4 archive move,
  done s95).
- Surface: `apps/web/src/components/schedule/schedule-surface.tsx` ·
  `apps/web/src/components/schedule/schedule-model.ts` ·
  `apps/web/src/components/schedule/schedule.css` ·
  `apps/web/src/app/app/schedule/page.tsx`.
- Media seam: `apps/web/src/lib/media/resolve.ts` ·
  `apps/web/src/components/media/source-thumb.tsx` (five states, three
  sizes — S1 must not flatten the `.thumb-sm` per-surface override rule,
  mock-sheets README rule 6).
- Reads: `apps/web/src/lib/workspace/client.ts` (`fetchPlan` ·
  `fetchQueueRows`) · `apps/web/src/app/api/schedule/slots/route.ts`; the
  event-media widening is `(new)` on those reads' serializers, no table
  change.
- Tests: the schedule suites under
  `apps/web/src/components/schedule/` extend with S1–S3 pins; the render
  gate re-baselines the week + month screenshots.

## Ordering (inside the s95 plan)

The Schedule amendment is DRAWN in the same Phase-1 design block as the three
video sheets and rides the same single W3 verdict ask; its build lands as
Phase-3 item 3 (after the editor p1 and the Overview/Dossier deltas — it is
the least-blocked and most self-contained, so it flexes last without cost).
Zero credit spend; no founder hands beyond the one texted verdict.

## Out of scope

Publishing mechanics (queue consumer, cadence engine — shipped, untouched) ·
any second calendar route · platform-colour legends (rejected, recorded) ·
month-density media if the fresh pull can't find an honest treatment.
