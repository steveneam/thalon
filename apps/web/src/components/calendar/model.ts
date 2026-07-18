import type { PipelineAsset } from "@/lib/workspace/types";
import { dayKey } from "@/lib/workspace/week";

/**
 * Pure math + derivation for the Fan-out calendar (Phase I, design of record:
 * "Content Calendar.dc.html" + "Calendar Week.dc.html"). The calendar is a
 * VIEW over the same plan payload the dashboard reads — no second query, no
 * second truth. HONEST STATES ONLY (the week-strip doctrine): no planned-slot
 * store or publish scheduler exists yet, so every item sits at its latest
 * REACHED pipeline instant — a record of what happened, never a fake
 * "scheduled upload". Drag-to-reschedule waits for the slot store; facts
 * don't drag.
 */

/** One draft placed on the calendar at its latest reached pipeline instant. */
export interface CalendarItem {
  id: string;
  /** format ?? platform — the assetLabel convention (no titles exist on the wire). */
  title: string;
  platform: string;
  /** Raw draft status, verbatim — the tooltip/aria channel. */
  status: string;
  at: Date;
  /** Approve-queue deep link (the week-strip convention). */
  href: string;
  /** One-line honest meta for the day panel. */
  detail: string;
  /**
   * Recurrence marker (design: word + icon "↻ wk", never color alone).
   * v1 schedules nothing recurring — the grammar ships, no live item wears
   * it until the slot store lands (checkpoint-flagged Q9).
   */
  recurring: boolean;
}

/**
 * The chip's ONE status word (design: time + title + one status word).
 * Live data carries the full draft lifecycle, so the vocabulary is an honest
 * superset of the mock's plan-slot three (approved/gated/draft): `gated` is
 * the only bronze element (signal channel); everything else stays neutral.
 */
export type StatusDress = "approved" | "gated" | "draft";

export interface StatusWord {
  word: string;
  dress: StatusDress;
}

const STATUS_WORDS: Record<string, StatusWord> = {
  generated: { word: "draft", dress: "draft" },
  judging: { word: "draft", dress: "draft" },
  queued: { word: "queued", dress: "draft" },
  blocked: { word: "gated", dress: "gated" },
  approved: { word: "approved", dress: "approved" },
  scheduled: { word: "approved", dress: "approved" },
  published: { word: "published", dress: "approved" },
  rejected: { word: "rejected", dress: "draft" },
};

/** Unknown statuses keep their own word (never lie), dressed neutral. */
export function statusWord(status: string): StatusWord {
  return STATUS_WORDS[status] ?? { word: status, dress: "draft" };
}

function statusDetail(asset: PipelineAsset): string {
  switch (asset.status) {
    case "blocked":
      return asset.reasons[0] ?? "judge gate failed — needs an edit";
    case "queued":
      return "judge-passed — awaiting your decision";
    case "generated":
      return "composing";
    case "judging":
      return "with the judge";
    case "published":
      return asset.deployRef ? `live · ${asset.deployRef}` : "published";
    case "approved":
    case "scheduled":
      return "approved — publish door unarmed";
    case "rejected":
      return "rejected";
    default:
      return asset.status;
  }
}

/** The latest REACHED stage instant — where the draft honestly sits in time. */
export function placedAt(asset: PipelineAsset): Date {
  return new Date(
    asset.publishedAt ?? asset.decidedAt ?? asset.judgedAt ?? asset.generatedAt,
  );
}

export function deriveItems(assets: PipelineAsset[]): CalendarItem[] {
  return assets
    .map((asset) => ({
      id: asset.draftId,
      title: asset.format ?? asset.platform,
      platform: asset.platform,
      status: asset.status,
      at: placedAt(asset),
      href: `/app/approve?run=${encodeURIComponent(asset.runId)}&draft=${encodeURIComponent(asset.draftId)}`,
      detail: statusDetail(asset),
      recurring: false,
    }))
    .filter((item) => !Number.isNaN(item.at.getTime()))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

// ---------------------------------------------------------------------------
// Month grid

export interface MonthCell {
  date: Date;
  /** Local YYYY-MM-DD — grouping and React keys (the week-strip convention). */
  key: string;
  inMonth: boolean;
  isToday: boolean;
}

/**
 * Monday-start cells covering the anchor's month in FULL weeks (35 or 42 —
 * whatever the month spans; the grid is bounded by construction, cells cap
 * their chips at 3 + "+N more").
 */
export function monthCells(anchor: Date, now: Date = new Date()): MonthCell[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const end = new Date(last);
  end.setDate(last.getDate() + (6 - ((last.getDay() + 6) % 7)));
  const todayKey = dayKey(now);
  const cells: MonthCell[] = [];
  for (let d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
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

export function groupItemsByDay(items: CalendarItem[]): Map<string, CalendarItem[]> {
  const grouped = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const key = dayKey(item.at);
    const bucket = grouped.get(key) ?? [];
    bucket.push(item);
    grouped.set(key, bucket);
  }
  return grouped;
}

/** Items within the anchor's month (the header count + agenda source). */
export function monthItems(items: CalendarItem[], anchor: Date): CalendarItem[] {
  return items.filter(
    (i) => i.at.getFullYear() === anchor.getFullYear() && i.at.getMonth() === anchor.getMonth(),
  );
}

// ---------------------------------------------------------------------------
// Week grid — ONE shared time→position mapping (design invariant: a label may
// never drift from the slot it names; labels, cells, now-line, and slots all
// go through hourPct).

export interface TimeWindow {
  start: number;
  end: number;
}

/** The bounded default window; quiet hours (20:00–06:00) collapse with an honest count. */
export const DAY_WINDOW: TimeWindow = { start: 6, end: 20 };
export const FULL_WINDOW: TimeWindow = { start: 0, end: 24 };

export function hourPct(hour: number, win: TimeWindow): number {
  return ((hour - win.start) / (win.end - win.start)) * 100;
}

export function itemHour(item: CalendarItem): number {
  return item.at.getHours() + item.at.getMinutes() / 60;
}

/** Split a day's items into the visible window vs the collapsed quiet hours. */
export function quietSplit(
  items: CalendarItem[],
  win: TimeWindow,
): { inWindow: CalendarItem[]; quiet: CalendarItem[] } {
  const inWindow: CalendarItem[] = [];
  const quiet: CalendarItem[] = [];
  for (const item of items) {
    const h = itemHour(item);
    (h >= win.start && h < win.end ? inWindow : quiet).push(item);
  }
  return { inWindow, quiet };
}

/**
 * Overlap rule (design): two items in one hour split the cell side-by-side;
 * a third becomes "+N" opening the day panel — the month's overflow grammar.
 */
export interface HourGroup {
  hour: number;
  shown: CalendarItem[];
  more: number;
}

export function overlapGroups(items: CalendarItem[]): HourGroup[] {
  const byHour = new Map<number, CalendarItem[]>();
  for (const item of items) {
    const hour = Math.floor(itemHour(item));
    const bucket = byHour.get(hour) ?? [];
    bucket.push(item);
    byHour.set(hour, bucket);
  }
  return [...byHour.entries()]
    .sort(([a], [b]) => a - b)
    .map(([hour, bucket]) => ({
      hour,
      shown: bucket.slice(0, 2),
      more: Math.max(0, bucket.length - 2),
    }));
}

// ---------------------------------------------------------------------------
// Filters — exclusion is FIRST-CLASS (survey lesson: filters need "not X"
// from day one). Each chip cycles off → only → not → off; "only" is
// single-select (the design's chip row), "not" accumulates.

export interface ChipFilter {
  only: string | null;
  not: ReadonlySet<string>;
}

export const EMPTY_FILTER: ChipFilter = { only: null, not: new Set() };

export type ChipState = "off" | "only" | "not";

export function chipState(filter: ChipFilter, value: string): ChipState {
  if (filter.not.has(value)) return "not";
  if (filter.only === value) return "only";
  return "off";
}

export function cycleFilter(filter: ChipFilter, value: string): ChipFilter {
  const state = chipState(filter, value);
  const not = new Set(filter.not);
  if (state === "off") return { only: value, not };
  if (state === "only") {
    not.add(value);
    return { only: null, not };
  }
  not.delete(value);
  return { only: filter.only, not };
}

export function passesFilter(filter: ChipFilter, value: string): boolean {
  if (filter.not.has(value)) return false;
  return filter.only === null || filter.only === value;
}

export function applyFilters(
  items: CalendarItem[],
  channel: ChipFilter,
  status: ChipFilter,
): CalendarItem[] {
  return items.filter(
    (i) => passesFilter(channel, i.platform) && passesFilter(status, statusWord(i.status).word),
  );
}

/** Observed values, first-seen order — the chip rows derive from data, never a hard-coded brand list. */
export function observedValues(items: CalendarItem[], pick: (i: CalendarItem) => string): string[] {
  const seen: string[] = [];
  for (const item of items) {
    const v = pick(item);
    if (!seen.includes(v)) seen.push(v);
  }
  return seen;
}

// ---------------------------------------------------------------------------
// Display helpers

/** "9:00" / "15:30" — the design's compact 24h clock. */
export function clockLabel(d: Date): string {
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** The always-visible zone chip's label — operator-local, from the runtime. */
export function operatorZoneLabel(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" }).formatToParts(now);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? "local";
}
