"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { WeekDay } from "@/lib/workspace/week";
import { StatusWordPill } from "./slot-chip";
import {
  clockLabel,
  hourPct,
  overlapGroups,
  quietSplit,
  DAY_WINDOW,
  FULL_WINDOW,
  type CalendarItem,
  type TimeWindow,
} from "./model";

interface WeekGridProps {
  days: WeekDay[];
  itemsByDay: Map<string, CalendarItem[]>;
  now: Date;
  /** Quiet hours expanded to the full 24h window (only offered when items sit inside them). */
  expanded: boolean;
  onToggleExpanded: () => void;
  onSelectDay: (key: string) => void;
}

/**
 * The week view (design of record: "Calendar Week.dc.html"): a bounded
 * 06:00–20:00 window, quiet hours collapsed with an HONEST count, and ONE
 * shared time→position mapping — labels, cells, slots, and the now-line all
 * go through `hourPct`, so a label can never drift from the slot it names.
 * The grid is fixed-height; the page never grows with draft volume.
 */
export function WeekGrid({
  days,
  itemsByDay,
  now,
  expanded,
  onToggleExpanded,
  onSelectDay,
}: WeekGridProps) {
  const win: TimeWindow = expanded ? FULL_WINDOW : DAY_WINDOW;
  const quietCount = days.reduce(
    (n, d) => n + quietSplit(itemsByDay.get(d.key) ?? [], DAY_WINDOW).quiet.length,
    0,
  );
  const hourMarks: number[] = [];
  for (let h = win.start; h <= win.end; h += 2) hourMarks.push(h);
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const nowVisible = nowHour >= win.start && nowHour < win.end;
  const dayLabel = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric" });

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
        <span className="u-eyebrow text-muted-foreground">
          {expanded
            ? "full 24h window shown"
            : `quiet hours (20:00–06:00) collapsed · ${quietCount} draft${quietCount === 1 ? "" : "s"} inside`}
        </span>
        {(quietCount > 0 || expanded) && (
          <button
            type="button"
            onClick={onToggleExpanded}
            className="u-eyebrow text-primary hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {expanded ? "collapse quiet hours" : "expand"}
          </button>
        )}
      </div>
      <div className="grid grid-cols-[3.5rem_repeat(7,1fr)] border-b border-border">
        <span />
        {days.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => onSelectDay(d.key)}
            className={cn(
              "u-eyebrow px-2 py-1.5 text-left text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              d.isToday && "font-semibold text-primary",
            )}
          >
            {dayLabel.format(d.date)}
          </button>
        ))}
      </div>
      <div className="relative grid h-[26rem] grid-cols-[3.5rem_repeat(7,1fr)]">
        {nowVisible && (
          <div
            aria-hidden
            data-testid="now-line"
            className="pointer-events-none absolute right-0 left-[3.5rem] z-10 h-0.5 bg-primary before:absolute before:-top-[3px] before:-left-1 before:size-2 before:rounded-full before:bg-primary"
            style={{ top: `${hourPct(nowHour, win)}%` }}
            title={`now · ${clockLabel(now)}`}
          />
        )}
        <div className="relative">
          {hourMarks.map((h) => (
            <span
              key={h}
              className="absolute right-2 -translate-y-1/2 font-mono text-2xs text-muted-foreground"
              style={{ top: `${Math.min(hourPct(h, win), 98)}%` }}
            >
              {String(h % 24).padStart(2, "0")}:00
            </span>
          ))}
        </div>
        {days.map((d) => {
          const dayItems = itemsByDay.get(d.key) ?? [];
          const visible = quietSplit(dayItems, win).inWindow;
          return (
            <div
              key={d.key}
              className={cn("relative border-l border-border", d.isToday && "bg-primary/5")}
            >
              {hourMarks.slice(1).map((h) => (
                <div
                  aria-hidden
                  key={h}
                  className="absolute right-0 left-0 border-t border-border/60"
                  style={{ top: `${hourPct(h, win)}%` }}
                />
              ))}
              {overlapGroups(visible).map((group) => (
                <div
                  key={group.hour}
                  className="absolute right-0.5 left-0.5 flex gap-0.5"
                  style={{ top: `${hourPct(group.hour, win)}%`, height: "7%" }}
                >
                  {group.shown.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      data-testid={`week-slot-${item.id}`}
                      title={`${item.title} · ${clockLabel(item.at)} · ${item.status} — ${item.detail}`}
                      className="min-w-0 flex-1 overflow-hidden rounded-md border border-border bg-card px-1 py-0.5 text-2xs leading-tight hover:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span className="font-mono text-2xs text-muted-foreground">
                        {clockLabel(item.at)}
                      </span>{" "}
                      <StatusWordPill status={item.status} />
                      <span className="block truncate font-medium">{item.title}</span>
                    </Link>
                  ))}
                  {group.more > 0 && (
                    <button
                      type="button"
                      onClick={() => onSelectDay(d.key)}
                      className="u-eyebrow shrink-0 self-start text-primary hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      aria-label={`${group.more} more at ${group.hour}:00 — open the day panel`}
                    >
                      +{group.more}
                    </button>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
