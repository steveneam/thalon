import { platformLabel } from "@/lib/workspace/format";
import type { PipelineAsset, PlanCadenceRule, PlannedSlotWire, PlanPayload } from "@/lib/workspace/types";
import { dayKey, projectSweepTicks, waitingSince, type WeekDay } from "@/lib/workspace/week";

/**
 * Pure derivations behind the Calendar sheet's bands (DOCTRINE 0 rebuild).
 * Every position, word and count the surface renders comes from here, so the
 * honesty rules stay unit-testable: nothing is placed at a time the backend
 * did not record, and nothing claims a door the engine does not have.
 *
 * The sheet's ONE time mapping: 06:00 sits at y=0 and every hour is 44px
 * (a 15-hour day = the sheet's 660px column). Hour labels, events, the
 * now-line and the day columns all go through `yOf` — a label may never
 * drift from the slot it names.
 */

export const HOUR_PX = 44;
/** The sheet's resting window: 06:00–21:00, quiet hours collapsed at both ends. */
export const DAY_WINDOW = { start: 6, end: 21 } as const;
export const FULL_WINDOW = { start: 0, end: 24 } as const;

export interface TimeWindow {
  start: number;
  end: number;
}

export function windowHeight(win: TimeWindow): number {
  return (win.end - win.start) * HOUR_PX;
}

/** Local-hours-since-window-start → pixels. The single source of vertical truth. */
export function yOf(hour: number, win: TimeWindow = DAY_WINDOW): number {
  return (hour - win.start) * HOUR_PX;
}

export function hourOf(date: Date): number {
  return date.getHours() + date.getMinutes() / 60;
}

/** The sheet's compact clock — "06:30", "18:00". */
export function clockLabel(date: Date): string {
  return `${`${date.getHours()}`.padStart(2, "0")}:${`${date.getMinutes()}`.padStart(2, "0")}`;
}

/** Even-numbered hour labels inside the window — the sheet's gutter. */
export function gutterHours(win: TimeWindow = DAY_WINDOW): number[] {
  const hours: number[] = [];
  for (let h = Math.ceil(win.start / 2) * 2; h < win.end; h += 2) hours.push(h);
  return hours;
}

// ---------------------------------------------------------------------------
// Events

/**
 * The sheet's whole event vocabulary:
 *  - `plan`   — a planned slot (dashed, gripped): a PLAN, never an upload;
 *  - `done`   — work that completed successfully (dimmed green: published);
 *  - `closed` — work that reached a decided end without publishing
 *               (dimmed, neutral — approved/rejected are not successes to brag about);
 *  - `engine` — what the engine will do, projected from the live sweep pointer;
 *  - `you`    — work WAITING on the operator. The sheet gives it its own lane
 *               (the all-day row), never the time grid: waiting is a present
 *               state, not something that happens at 14:30.
 */
export type EventKind = "plan" | "done" | "closed" | "engine" | "you";

export interface CalEvent {
  id: string;
  kind: EventKind;
  at: Date;
  /** Local day key — which column the event belongs to. */
  day: string;
  /** The event's bold lead line ("Planned · LinkedIn", "Blog · published ✓"). */
  lead: string;
  /** The line under it ("18:00 · launch film post"). */
  meta: string;
  /** Approve-queue deep link — every fact is a door. Engine ticks have none. */
  href: string | null;
  /** Draft body excerpt for the detail popover; engine ticks carry none. */
  excerpt: string;
  /** A plan that breaks the tenant's own cadence rules (see cadenceBreaches). */
  flagged: boolean;
  /** Why it is flagged — verbatim in the popover; empty when it is not. */
  flagReason: string;
  /** Waiting events only: whole hours waited so far. */
  hours?: number;
  /** Waiting events only: true when it started waiting before the visible week. */
  carried?: boolean;
}

/** The sheet's own heights: a gripped plan is 42px, everything else 38px. */
export function eventHeight(kind: EventKind): number {
  return kind === "plan" ? 42 : 38;
}

const WAITING = new Set(["queued", "blocked"]);

function approveHref(asset: Pick<PipelineAsset, "runId" | "draftId">): string {
  return `/app/approve?run=${encodeURIComponent(asset.runId)}&draft=${encodeURIComponent(asset.draftId)}`;
}

/**
 * Planned slots as events. A slot's own draft supplies the excerpt and the
 * door; a slot whose draft has aged out of the feed window still renders (the
 * plan is the fact) with an honest, empty excerpt.
 */
export function planEvents(
  slots: PlannedSlotWire[],
  assets: PipelineAsset[],
  breaches: Map<string, string>,
): CalEvent[] {
  const byDraft = new Map(assets.map((a) => [a.draftId, a]));
  return slots.map((slot) => {
    const at = new Date(slot.scheduledFor);
    const asset = byDraft.get(slot.draftId);
    const reason = breaches.get(slot.draftId) ?? "";
    return {
      id: `plan-${slot.draftId}`,
      kind: "plan" as const,
      at,
      day: dayKey(at),
      lead: `Planned · ${platformLabel(slot.platform)}`,
      meta: `${clockLabel(at)} · ${slot.note ?? asset?.excerpt ?? "no note"}`,
      href: asset ? approveHref(asset) : null,
      excerpt: asset?.excerpt ?? "",
      flagged: reason !== "",
      flagReason: reason,
    };
  });
}

/**
 * Decided drafts as events, at the instant they were decided. Waiting drafts
 * are NOT here — they belong to the all-day waiting lane (the sheet's own
 * split), and composing drafts have no completed instant to place.
 */
export function assetEvents(assets: PipelineAsset[]): CalEvent[] {
  return assets
    .filter((a) => !WAITING.has(a.status) && (a.publishedAt ?? a.decidedAt) !== null)
    .map((asset) => {
      const published = asset.publishedAt !== null;
      const at = new Date((asset.publishedAt ?? asset.decidedAt) as string);
      const platform = platformLabel(asset.platform);
      const ending = published
        ? "published ✓"
        : asset.status === "rejected"
          ? "rejected"
          : "approved";
      return {
        id: `asset-${asset.draftId}`,
        kind: (published ? "done" : "closed") as EventKind,
        at,
        day: dayKey(at),
        lead: `${platform} · ${ending}`,
        meta: `${clockLabel(at)} · ${
          published
            ? (asset.deployRef ?? (asset.excerpt || "published"))
            : asset.status === "rejected"
              ? "rejected — not published"
              : "approved — publish door unarmed"
        }`,
        href: approveHref(asset),
        excerpt: asset.excerpt,
        flagged: false,
        flagReason: "",
      };
    });
}

/**
 * Sweep events: the one that RAN (the pointer's last sweep, when it falls in
 * the visible week) and the ones the engine WILL run, projected from the live
 * pointer. An overdue pointer projects nothing at all — projecting from a
 * stalled poller is fiction (lib/workspace/week.ts, caught live at s39).
 */
export function sweepEvents(
  sweep: PlanPayload["sweep"],
  now: Date,
  days: WeekDay[],
): CalEvent[] {
  if (!sweep || days.length === 0) return [];
  const windowStart = days[0].date;
  const windowEnd = new Date(days[days.length - 1].date);
  windowEnd.setDate(windowEnd.getDate() + 1);

  const events: CalEvent[] = [];
  const last = new Date(sweep.lastSweptAt);
  if (
    !Number.isNaN(last.getTime()) &&
    last.getTime() >= windowStart.getTime() &&
    last.getTime() < windowEnd.getTime()
  ) {
    events.push({
      id: `sweep-ran-${last.toISOString()}`,
      kind: "done",
      at: last,
      day: dayKey(last),
      lead: "Sweep · ran ✓",
      meta: `${clockLabel(last)} · ${sweep.source}`,
      href: "/app/intel",
      excerpt: "",
      flagged: false,
      flagReason: "",
    });
  }
  for (const tick of projectSweepTicks(sweep, now, windowStart, windowEnd)) {
    events.push({
      id: `sweep-next-${tick.toISOString()}`,
      kind: "engine",
      at: tick,
      day: dayKey(tick),
      lead: "Sweep · engine",
      meta: `${clockLabel(tick)} · ${sweep.source}`,
      href: "/app/intel",
      excerpt: "",
      flagged: false,
      flagReason: "",
    });
  }
  return events;
}

// ---------------------------------------------------------------------------
// The waiting lane (the sheet's all-day row)

/**
 * Everything waiting on the operator, on the day it STARTED waiting. Waiting
 * is a PRESENT state, so anything older than the visible week carries into
 * today instead of vanishing from a lane labelled "waiting" (critique P1).
 */
export function waitingEvents(assets: PipelineAsset[], days: WeekDay[], now: Date): CalEvent[] {
  if (days.length === 0) return [];
  const keys = new Set(days.map((d) => d.key));
  const todayKey = days.find((d) => d.isToday)?.key ?? days[0].key;
  const windowStart = days[0].date.getTime();

  return assets
    .filter((a) => WAITING.has(a.status))
    .flatMap((asset): CalEvent[] => {
      const at = waitingSince(asset);
      const key = dayKey(at);
      const inWeek = keys.has(key);
      const carried = !inWeek && at.getTime() < windowStart;
      // Later than the visible week (a clock skew or a future stamp): out of view.
      if (!inWeek && !carried) return [];
      const hours = Math.max(0, Math.floor((now.getTime() - at.getTime()) / 3_600_000));
      return [
        {
          id: `wait-${asset.draftId}`,
          kind: "you",
          at,
          day: inWeek ? key : todayKey,
          lead: `${platformLabel(asset.platform)} · ${asset.status === "blocked" ? "needs edit" : "your review"}`,
          meta: `waiting ${hours}h`,
          href: approveHref(asset),
          excerpt: asset.excerpt,
          flagged: false,
          flagReason: "",
          hours,
          carried,
        },
      ];
    })
    .sort((a, b) => (b.hours ?? 0) - (a.hours ?? 0));
}

// ---------------------------------------------------------------------------
// Cadence — the sheet's own claim ("snaps to cadence-legal slots") checked
// against the tenant's real rules. This is the ⚑ flag's meaning: a PLAN that
// breaks the operator's own cadence, named with its reason.

/** draftId → the rule it breaks, in the operator's words. Empty when legal. */
export function cadenceBreaches(
  slots: PlannedSlotWire[],
  cadence: PlanCadenceRule[],
): Map<string, string> {
  const breaches = new Map<string, string>();
  const rules = new Map(cadence.map((rule) => [rule.platform.toLowerCase(), rule]));

  const byPlatform = new Map<string, PlannedSlotWire[]>();
  for (const slot of slots) {
    const key = slot.platform.toLowerCase();
    byPlatform.set(key, [...(byPlatform.get(key) ?? []), slot]);
  }

  for (const [platform, platformSlots] of byPlatform) {
    const rule = rules.get(platform);
    if (!rule) continue;
    const sorted = [...platformSlots].sort(
      (a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime(),
    );
    const label = platformLabel(platform);

    if (rule.maxPerDay !== undefined) {
      const perDay = new Map<string, PlannedSlotWire[]>();
      for (const slot of sorted) {
        const key = dayKey(new Date(slot.scheduledFor));
        perDay.set(key, [...(perDay.get(key) ?? []), slot]);
      }
      for (const daySlots of perDay.values()) {
        // The rule allows N a day: the slots beyond the Nth are the breach.
        for (const slot of daySlots.slice(rule.maxPerDay)) {
          breaches.set(
            slot.draftId,
            `${label} is planned ${daySlots.length}× that day — your cadence allows ${rule.maxPerDay}`,
          );
        }
      }
    }

    if (rule.minGapMinutes !== undefined) {
      for (let i = 1; i < sorted.length; i += 1) {
        const gapMs =
          new Date(sorted[i].scheduledFor).getTime() - new Date(sorted[i - 1].scheduledFor).getTime();
        const gapMinutes = Math.round(gapMs / 60_000);
        if (gapMinutes < rule.minGapMinutes && !breaches.has(sorted[i].draftId)) {
          breaches.set(
            sorted[i].draftId,
            `${gapMinutes}m after the previous ${label} plan — your cadence asks for ${rule.minGapMinutes}m`,
          );
        }
      }
    }
  }
  return breaches;
}

/** The footer's cadence line — the week card's wording, one home for the phrasing. */
export function cadenceLine(cadence: PlanCadenceRule[]): string {
  if (cadence.length === 0) {
    return "No cadence rules configured — every platform plans unconstrained.";
  }
  return `Cadence — ${cadence
    .map((rule) =>
      [
        platformLabel(rule.platform),
        rule.maxPerDay !== undefined ? `≤ ${rule.maxPerDay}/day` : null,
        rule.maxPerWeek !== undefined ? `≤ ${rule.maxPerWeek}/wk` : null,
        rule.minGapMinutes !== undefined ? `${rule.minGapMinutes}m gap` : null,
      ]
        .filter(Boolean)
        .join(" "),
    )
    .join(" · ")}`;
}

// ---------------------------------------------------------------------------
// Scope filter (the sheet's second segmented control)

export type Scope = "all" | "plans" | "needs" | "flagged";

export const SCOPES: Array<{ id: Scope; label: string }> = [
  { id: "all", label: "All" },
  { id: "plans", label: "Plans" },
  { id: "needs", label: "Needs you" },
  { id: "flagged", label: "⚑ Flagged" },
];

export function eventsInScope(events: CalEvent[], scope: Scope): CalEvent[] {
  switch (scope) {
    case "plans":
      return events.filter((e) => e.kind === "plan");
    case "flagged":
      return events.filter((e) => e.flagged);
    case "needs":
      return events.filter((e) => e.kind === "you");
    default:
      return events;
  }
}

// ---------------------------------------------------------------------------
// Column layout
//
// APP ADAPTATION (the named kind): the sheet's fixture never puts two events
// in the same hour; real days do. Concurrent events split the column evenly —
// the standard time-grid rule — so nothing is hidden and nothing overlaps.

export interface PlacedEvent {
  event: CalEvent;
  top: number;
  height: number;
  /** Percent offsets within the day column. */
  leftPct: number;
  widthPct: number;
}

export function placeColumn(events: CalEvent[], win: TimeWindow = DAY_WINDOW): PlacedEvent[] {
  const sorted = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
  const spans = sorted.map((event) => {
    const start = hourOf(event.at);
    return { event, start, end: start + eventHeight(event.kind) / HOUR_PX };
  });

  // Group into runs of mutually overlapping events, then split each run.
  const placed: PlacedEvent[] = [];
  let run: typeof spans = [];
  let runEnd = -Infinity;
  const flush = () => {
    run.forEach((span, index) => {
      placed.push({
        event: span.event,
        top: yOf(span.start, win),
        height: eventHeight(span.event.kind),
        leftPct: (index / run.length) * 100,
        widthPct: 100 / run.length,
      });
    });
    run = [];
    runEnd = -Infinity;
  };
  for (const span of spans) {
    if (run.length > 0 && span.start >= runEnd) flush();
    run.push(span);
    runEnd = Math.max(runEnd, span.end);
  }
  if (run.length > 0) flush();
  return placed;
}

/** Events outside the visible window — the quiet-hours bands' honest count. */
export function outsideWindow(events: CalEvent[], win: TimeWindow): CalEvent[] {
  return events.filter((e) => {
    const h = hourOf(e.at);
    return h < win.start || h >= win.end;
  });
}

// ---------------------------------------------------------------------------
// Labels

/** "21 – 27 July" — the sheet's week label, month named once when it can be. */
export function weekRangeLabel(days: WeekDay[]): string {
  if (days.length === 0) return "";
  const first = days[0].date;
  const last = days[days.length - 1].date;
  const month = new Intl.DateTimeFormat(undefined, { month: "long" });
  return first.getMonth() === last.getMonth()
    ? `${first.getDate()} – ${last.getDate()} ${month.format(last)}`
    : `${first.getDate()} ${month.format(first)} – ${last.getDate()} ${month.format(last)}`;
}

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ---------------------------------------------------------------------------
// Month cells (the keeper engine's other density)

export interface MonthCell {
  date: Date;
  key: string;
  inMonth: boolean;
  isToday: boolean;
}

/** Monday-start cells covering the anchor's month in FULL weeks (35 or 42). */
export function monthCells(anchor: Date, now: Date): MonthCell[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const end = new Date(last);
  end.setDate(last.getDate() + (6 - ((last.getDay() + 6) % 7)));
  const todayKey = dayKey(now);
  const cells: MonthCell[] = [];
  for (const d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
    const date = new Date(d);
    cells.push({
      date,
      key: dayKey(date),
      inMonth: date.getMonth() === anchor.getMonth(),
      isToday: dayKey(date) === todayKey,
    });
  }
  return cells;
}

export function groupByKey<T extends { day: string }>(items: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    grouped.set(item.day, [...(grouped.get(item.day) ?? []), item]);
  }
  return grouped;
}
