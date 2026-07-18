"use client";

import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorNotice } from "@/components/workspace/error-notice";
import { cn } from "@/lib/utils";
import {
  dayKey,
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
/** The per-day mark bound (Phase D calendar rule): 3 marks, then "+N more". */
const DAY_MARK_BOUND = 3;

function clock(date: Date): string {
  return `${date.getHours()}:${`${date.getMinutes()}`.padStart(2, "0")}`;
}

function assetHref(asset: PipelineAsset): string {
  return `/app/approve?run=${encodeURIComponent(asset.runId)}&draft=${encodeURIComponent(asset.draftId)}`;
}

/** One mark in the strip's three-kind grammar. */
interface DayMark {
  key: string;
  kind: "engine" | "you" | "plan";
  text: string;
  title?: string;
  href?: string;
}

const MARK_CLASSES: Record<DayMark["kind"], string> = {
  engine: "bg-signal/12 text-foreground",
  you: "bg-muted font-medium text-foreground",
  plan: "border border-dashed border-border bg-card text-muted-foreground",
};

function LegendDot({ className }: { className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2 rounded-[0.125rem]", className)} />;
}

/**
 * The week strip (Phase D spine design): one week of intended work in the
 * honest three-mark grammar — what the engine will do, what waits on you,
 * and planned slots (dashed: plans, not uploads — the publish door is
 * unarmed). Each day shows 3 marks then "+N more" (the calendar design's
 * cell bound). HONEST STATES ONLY: planned marks appear only when drafts
 * are genuinely scheduled; nothing renders as an upload.
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

  function marksFor(key: string): DayMark[] {
    const engine: DayMark[] = (ticksByDay.get(key) ?? []).map((tick) => ({
      key: tick.toISOString(),
      kind: "engine",
      text: `sweep ${clock(tick)}`,
      title: `Trend sweep the engine will run at ${clock(tick)}`,
    }));
    const you: DayMark[] = (waiting.get(key) ?? []).map(({ asset, carried, at }) => ({
      key: asset.draftId,
      kind: "you",
      text: `${asset.platform} · ${asset.status === "blocked" ? "needs edit" : "your review"}`,
      title: carried ? `waiting since ${timeAgo(at.toISOString(), today.getTime())}` : undefined,
      href: assetHref(asset),
    }));
    return [...engine, ...you];
  }

  return (
    <section
      aria-label="This week"
      className="flex min-w-0 flex-col rounded-xl border border-border bg-card"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-2 pt-3.5">
        <h2 className="text-base font-semibold">This week</h2>
        <div className="ml-auto flex items-center gap-3">
          <span className="u-eyebrow flex items-center gap-1.5 text-muted-foreground">
            <LegendDot className="bg-signal/30" />
            engine
          </span>
          <span className="u-eyebrow flex items-center gap-1.5 text-muted-foreground">
            <LegendDot className="border border-border bg-muted" />
            waits on you
          </span>
          <span className="u-eyebrow flex items-center gap-1.5 text-muted-foreground">
            <LegendDot className="border border-dashed border-border bg-card" />
            planned slot
          </span>
        </div>
      </div>
      {status === "loading" && (
        <div className="grid grid-cols-7 gap-2 border-t border-border p-3" aria-label="Loading calendar">
          {DAY_NAMES.map((name) => (
            <Skeleton key={name} className="h-24" />
          ))}
        </div>
      )}
      {status === "error" && (
        <div className="border-t border-border p-3">
          <ErrorNotice message="Couldn’t load the week." onRetry={onRetry} />
        </div>
      )}
      {status === "success" && plan && (
        <>
          <div className="overflow-x-auto border-t border-border">
            <ol className="grid min-w-[640px] grid-cols-7">
              {days.map((day, i) => {
                const marks = marksFor(day.key);
                const shown = marks.slice(0, DAY_MARK_BOUND);
                const overflow = marks.length - shown.length;
                return (
                  <li
                    key={day.key}
                    aria-current={day.isToday ? "date" : undefined}
                    className={cn(
                      "flex min-h-[7.5rem] min-w-0 flex-col gap-1.5 p-2",
                      i > 0 && "border-l border-border",
                      day.isToday && "bg-accent/45",
                    )}
                  >
                    <p
                      className={cn(
                        "u-eyebrow",
                        day.isToday ? "font-semibold text-accent-foreground" : "text-muted-foreground",
                      )}
                    >
                      {DAY_NAMES[i]} {day.date.getDate()}
                      {day.isToday && <span className="sr-only"> — today</span>}
                    </p>
                    {shown.map((mark) =>
                      mark.href ? (
                        <Link
                          key={mark.key}
                          href={mark.href}
                          title={mark.title}
                          className={cn(
                            "truncate rounded-md px-1.5 py-1 text-2xs hover:underline",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                            MARK_CLASSES[mark.kind],
                          )}
                        >
                          {mark.text}
                        </Link>
                      ) : (
                        <p
                          key={mark.key}
                          title={mark.title}
                          className={cn("truncate rounded-md px-1.5 py-1 text-2xs", MARK_CLASSES[mark.kind])}
                        >
                          {mark.text}
                        </p>
                      ),
                    )}
                    {overflow > 0 && (
                      <p
                        className="text-2xs text-muted-foreground"
                        title={marks.slice(DAY_MARK_BOUND).map((m) => m.text).join(" · ")}
                      >
                        +{overflow} more
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-4 py-2 text-xs text-muted-foreground">
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
    </section>
  );
}
