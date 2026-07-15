import type { PipelineAsset, PlanSweep } from "./types";

/**
 * Pure week math for the dashboard work calendar (§10 item 2). The grid is
 * built CLIENT-side in the operator's local timezone — the API ships raw
 * instants, never a pre-bucketed grid, so day boundaries are always the
 * operator's own. HONEST STATES ONLY: the calendar shows what the engine
 * WILL do (sweep ticks projected from the live pointer), what WAITS on the
 * operator (queued/blocked drafts at the day they started waiting), and what
 * was DECIDED — nothing ever renders as a "scheduled upload" because no
 * publish scheduler exists.
 */
export interface WeekDay {
  /** Local midnight for the day. */
  date: Date;
  /** Local day key, YYYY-MM-DD — grouping and React keys. */
  key: string;
  isToday: boolean;
}

export function dayKey(date: Date): string {
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

/** Monday-start local week containing `now` — the calendar's 7 columns. */
export function weekDays(now: Date): WeekDay[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return { date, key: dayKey(date), isToday: date.getTime() === today.getTime() };
  });
}

/** Guard against a degenerate pointer flooding the grid (interval must be ≥ 1h to project). */
const MIN_PROJECTION_INTERVAL_MS = 3_600_000;
const MAX_TICKS = 64;

/**
 * A pointer more than one interval past due means the poller is NOT keeping
 * cadence — projecting future ticks from it would be fiction (caught live,
 * s39: an 8-day-old pointer painted the whole week with sweeps that would
 * never run). Within one interval it's merely "due" and still trustworthy.
 */
export function sweepOverdue(sweep: PlanSweep, now: Date): boolean {
  const next = new Date(sweep.nextSweepAt).getTime();
  return !Number.isNaN(next) && now.getTime() > next + sweep.intervalMs;
}

/**
 * Project the sweep pointer forward across the grid window: the next sweep
 * plus every interval after it, clipped to [windowStart, windowEnd). Ticks
 * before `now` are dropped — a missed past sweep is not an upcoming one —
 * and an OVERDUE pointer projects nothing at all (see sweepOverdue).
 */
export function projectSweepTicks(
  sweep: PlanSweep,
  now: Date,
  windowStart: Date,
  windowEnd: Date,
): Date[] {
  if (sweep.intervalMs < MIN_PROJECTION_INTERVAL_MS) return [];
  if (sweepOverdue(sweep, now)) return [];
  const first = new Date(sweep.nextSweepAt).getTime();
  if (Number.isNaN(first)) return [];
  const ticks: Date[] = [];
  for (let t = first; t < windowEnd.getTime() && ticks.length < MAX_TICKS; t += sweep.intervalMs) {
    if (t < now.getTime() || t < windowStart.getTime()) continue;
    ticks.push(new Date(t));
  }
  return ticks;
}

export interface WeekEntry {
  asset: PipelineAsset;
  /** The instant that places the entry on its day. */
  at: Date;
  /** True when the entry predates the visible week and was carried into today (waiting lane only). */
  carried?: boolean;
}

const WAITING_STATUSES = new Set(["queued", "blocked"]);
const DECIDED_STATUSES = new Set(["approved", "rejected", "published"]);

/** A waiting draft sits on the day it STARTED waiting — the judge verdict's instant (generation as the honest fallback). */
export function waitingSince(asset: PipelineAsset): Date {
  return new Date(asset.judgedAt ?? asset.generatedAt);
}

export function waitingEntries(assets: PipelineAsset[]): WeekEntry[] {
  return assets
    .filter((a) => WAITING_STATUSES.has(a.status))
    .map((asset) => ({ asset, at: waitingSince(asset) }));
}

export function decidedEntries(assets: PipelineAsset[]): WeekEntry[] {
  return assets
    .filter((a) => DECIDED_STATUSES.has(a.status) && a.decidedAt !== null)
    .map((asset) => ({ asset, at: new Date(asset.decidedAt as string) }));
}

/**
 * Bucket entries by local day key. Entries outside the grid are dropped
 * (the window is the view, not the data) — EXCEPT when `carryEarlierInto`
 * names a day: waiting is a PRESENT state, not a past event, so a draft
 * that started waiting before Monday must not vanish from a band subtitled
 * "what waits on you" (critique P1, s39). Carried entries keep their true
 * instant and are flagged so the view can say "waiting since …" honestly.
 */
export function groupByDay(
  entries: WeekEntry[],
  days: WeekDay[],
  opts: { carryEarlierInto?: string } = {},
): Map<string, WeekEntry[]> {
  const keys = new Set(days.map((d) => d.key));
  const windowStart = days[0]?.date.getTime() ?? 0;
  const grouped = new Map<string, WeekEntry[]>();
  for (const entry of entries) {
    let key = dayKey(entry.at);
    let carried = false;
    if (!keys.has(key)) {
      if (!opts.carryEarlierInto || entry.at.getTime() >= windowStart) continue;
      key = opts.carryEarlierInto;
      carried = true;
    }
    const bucket = grouped.get(key) ?? [];
    bucket.push(carried ? { ...entry, carried } : entry);
    grouped.set(key, bucket);
  }
  for (const bucket of grouped.values()) bucket.sort((a, b) => a.at.getTime() - b.at.getTime());
  return grouped;
}
