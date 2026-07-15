"use client";

import Link from "next/link";
import { Check, Radar } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorNotice } from "@/components/workspace/error-notice";
import { cn } from "@/lib/utils";
import {
  dayKey,
  decidedEntries,
  groupByDay,
  projectSweepTicks,
  sweepOverdue,
  waitingEntries,
  weekDays,
} from "@/lib/workspace/week";
import { timeAgo } from "@/lib/workspace/format";
import type { PipelineAsset, PlanPayload } from "@/lib/workspace/types";

export type CalendarStatus = "loading" | "error" | "success";

interface WeekCalendarProps {
  status: CalendarStatus;
  plan: PlanPayload | null;
  onRetry?: () => void;
  /** Injectable clock for tests; renders default to the real one. */
  now?: Date;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function clock(date: Date): string {
  return `${date.getHours()}:${`${date.getMinutes()}`.padStart(2, "0")}`;
}

function assetHref(asset: PipelineAsset): string {
  return `/app/approve?run=${encodeURIComponent(asset.runId)}&draft=${encodeURIComponent(asset.draftId)}`;
}

/**
 * The work calendar (§10 item 2): one week of intended work. HONEST STATES
 * ONLY — future rows are things the engine WILL do (projected sweeps) or
 * things that WAIT on the operator; nothing renders as a scheduled upload
 * because no publish scheduler exists. Grows into the scheduling surface
 * when that bucket lands.
 */
export function WeekCalendar({ status, plan, onRetry, now }: WeekCalendarProps) {
  const today = now ?? new Date();
  const days = weekDays(today);
  const windowStart = days[0].date;
  const windowEnd = new Date(days[6].date);
  windowEnd.setDate(windowEnd.getDate() + 1);

  const ticksByDay = new Map<string, Date[]>();
  if (plan?.sweep) {
    for (const tick of projectSweepTicks(plan.sweep, today, windowStart, windowEnd)) {
      const key = dayKey(tick);
      ticksByDay.set(key, [...(ticksByDay.get(key) ?? []), tick]);
    }
  }
  // Waiting is a present state: drafts that started waiting before Monday
  // carry into today's cell instead of vanishing (critique P1, s39).
  const todayKey = days.find((d) => d.isToday)?.key ?? days[0].key;
  const waiting = groupByDay(plan ? waitingEntries(plan.assets) : [], days, {
    carryEarlierInto: todayKey,
  });
  const decided = groupByDay(plan ? decidedEntries(plan.assets) : [], days);

  return (
    <Card>
      <CardHeader>
        <CardTitle>This week</CardTitle>
        <CardDescription>
          What the engine will do, what waits on you, and what you decided — publish scheduling
          joins this view when the publisher lands.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {status === "loading" && (
          <div className="grid grid-cols-7 gap-2" aria-label="Loading calendar">
            {DAY_NAMES.map((name) => (
              <Skeleton key={name} className="h-24" />
            ))}
          </div>
        )}
        {status === "error" && <ErrorNotice message="Couldn’t load the week." onRetry={onRetry} />}
        {status === "success" && plan && (
          <>
            <div className="overflow-x-auto">
              <ol className="grid min-w-[640px] grid-cols-7 gap-2">
                {days.map((day, i) => (
                  <li
                    key={day.key}
                    aria-current={day.isToday ? "date" : undefined}
                    className={cn(
                      "flex min-h-24 flex-col gap-1.5 rounded-lg border p-2",
                      day.isToday ? "border-ring/50 bg-muted/40" : "border-border/60",
                    )}
                  >
                    <p className="u-eyebrow text-muted-foreground">
                      {DAY_NAMES[i]} {day.date.getDate()}
                      {day.isToday && <span className="ml-1 text-primary">· today</span>}
                    </p>
                    {(ticksByDay.get(day.key) ?? []).map((tick) => (
                      <p
                        key={tick.toISOString()}
                        className="flex items-center gap-1 text-2xs text-muted-foreground"
                        title={`Trend sweep the engine will run at ${clock(tick)}`}
                      >
                        <Radar aria-hidden className="size-3 shrink-0 text-muted-foreground" />
                        sweep <span className="u-tabular ml-auto">{clock(tick)}</span>
                      </p>
                    ))}
                    {(waiting.get(day.key) ?? []).map(({ asset, carried, at }) => (
                      <Link
                        key={asset.draftId}
                        href={assetHref(asset)}
                        className="rounded text-2xs font-medium text-signal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        {asset.platform} · {asset.status === "blocked" ? "needs edit" : "your review"}
                        {carried && (
                          <span className="block font-normal">
                            waiting since {timeAgo(at.toISOString(), today.getTime())}
                          </span>
                        )}
                      </Link>
                    ))}
                    {(decided.get(day.key) ?? []).map(({ asset }) => (
                      <Link
                        key={asset.draftId}
                        href={assetHref(asset)}
                        className="flex items-center gap-1 rounded text-2xs text-muted-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        <Check aria-hidden className="size-3 shrink-0" />
                        {asset.platform} · {asset.status}
                      </Link>
                    ))}
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {!plan.sweep && (
                <span>No live sweeps armed yet — projected sweeps appear once a poller runs.</span>
              )}
              {plan.sweep && sweepOverdue(plan.sweep, today) && (
                <span>
                  Sweeps overdue — the last pointer expected one{" "}
                  {timeAgo(plan.sweep.nextSweepAt, today.getTime())}; nothing is projected until a
                  sweep runs again.
                </span>
              )}
              {plan.cadence.length > 0 ? (
                <>
                  <span className="u-eyebrow">Cadence</span>
                  {plan.cadence.map((rule) => (
                    <span key={rule.platform} className="u-tabular">
                      {rule.platform}
                      {rule.maxPerDay !== undefined && ` ≤${rule.maxPerDay}/day`}
                      {rule.maxPerWeek !== undefined && ` ≤${rule.maxPerWeek}/wk`}
                      {rule.minGapMinutes !== undefined && ` ≥${rule.minGapMinutes}m gap`}
                    </span>
                  ))}
                </>
              ) : (
                <span>No cadence rules configured — every platform drafts unconstrained.</span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
