import type { SweepStamp } from "./types";

/**
 * B-arm.1: the schedule-aware half of the Intel cadence stamp. The sweep
 * bundle's `nextSweepAtMs` was always ADVISORY arithmetic ("real scheduling
 * infra is B6.7 cron" — sweep.ts); now that the scheduler exists, the stamp
 * tells the schedule's truth instead: an enabled schedule shows the real
 * next-sweep time (`lastSweepAt + cadence`, or due-now when that has
 * arrived / it has never swept); disabled or absent keeps the honest
 * null — there IS no next sweep, exactly the pre-scheduler wording. Pure:
 * the clock is an argument, never read here.
 */

/** The schedule fields the stamp reads — structurally the `sweep_schedules` row the config door serves. */
export interface ScheduleStampInput {
  enabled: boolean;
  cadenceMinutes: number;
  lastSweepAt: Date | null;
}

export function applyScheduleToStamp(
  stamp: SweepStamp,
  schedule: ScheduleStampInput | null,
  nowMs: number,
): SweepStamp {
  if (!schedule?.enabled) {
    return { ...stamp, nextSweepAt: null };
  }
  const nextMs =
    schedule.lastSweepAt === null
      ? null
      : schedule.lastSweepAt.getTime() + schedule.cadenceMinutes * 60_000;
  return {
    ...stamp,
    intervalHours: Math.round(schedule.cadenceMinutes / 60),
    // Never-swept has no time to show — dueNow carries the honesty instead
    // of a fabricated timestamp.
    nextSweepAt: nextMs === null ? null : new Date(nextMs).toISOString(),
    dueNow: nextMs === null || nextMs <= nowMs,
  };
}
