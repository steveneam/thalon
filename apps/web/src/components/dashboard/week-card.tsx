"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { platformLabel, slotsInWeek } from "@/components/dashboard/dashboard-model";
// The day view borrows the CALENDAR's geometry and event builders rather than
// growing a second time grammar on the dashboard (founder s76: "same as the
// main calendar"). calendar-model is pure — no React, no surface coupling.
import {
  gutterHours,
  planEvents,
  sweepEvents,
  waitingEvents,
  windowHeight,
  yOf,
  DAY_WINDOW,
  FULL_WINDOW,
} from "@/components/calendar/calendar-model";
import { timeAgo } from "@/lib/workspace/format";
import {
  dayKey,
  groupByDay,
  projectSweepTicks,
  sweepOverdue,
  waitingEntries,
  weekDays,
} from "@/lib/workspace/week";
import type { PlanPayload } from "@/lib/workspace/types";

export type WeekCardStatus = "loading" | "error" | "success";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** The per-day mark bound (the sheet draws 1–2 marks; a real queue folds): 3 marks, then "+N more". */
const DAY_MARK_BOUND = 3;

function clock(date: Date): string {
  return `${date.getHours()}:${`${date.getMinutes()}`.padStart(2, "0")}`;
}

interface Mark {
  key: string;
  kind: "engine" | "you" | "plan";
  text: React.ReactNode;
  title?: string;
  href?: string;
}

const MARK_CLASS: Record<Mark["kind"], string> = {
  engine: "mark",
  you: "mark mark-you",
  plan: "mark mark-plan",
};

/**
 * The week card, rebuilt exactly from the Dashboard sheet: one row per day
 * (today tinted), marks in the honest three-kind grammar — what the engine
 * WILL do (sweep ticks projected from the live pointer), what WAITS on you
 * (amber, carried into today when older than the week), and planned slots
 * (dashed: plans, not uploads — the publish door is unarmed). Quiet days
 * say "—". All times local; the footer states the cadence allowances.
 */
export function WeekCard({
  status,
  plan,
  onRetry,
  now,
}: {
  status: WeekCardStatus;
  plan: PlanPayload | null;
  onRetry?: () => void;
  /** Injectable clock for tests; renders default to the real one. */
  now?: Date;
}) {
  const [view, setView] = useState<"today" | "week">("week");
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
  const slotsByDay = new Map<string, PlanPayload["plannedSlots"]>();
  for (const slot of slotsInWeek(plan?.plannedSlots ?? [], days)) {
    const key = dayKey(new Date(slot.scheduledFor));
    slotsByDay.set(key, [...(slotsByDay.get(key) ?? []), slot]);
  }

  function marksFor(key: string): Mark[] {
    const engine: Mark[] = (ticksByDay.get(key) ?? []).map((tick) => ({
      key: tick.toISOString(),
      kind: "engine",
      text: (
        <>
          Sweep{" "}
          <span className="t-data" style={{ color: "inherit" }}>
            {clock(tick)}
          </span>
        </>
      ),
      title: `Trend sweep the engine will run at ${clock(tick)}`,
    }));
    const you: Mark[] = (waiting.get(key) ?? []).map(({ asset, carried, at }) => ({
      key: asset.draftId,
      kind: "you",
      text: `${platformLabel(asset.platform)} · ${asset.status === "blocked" ? "needs edit" : "your review"}`,
      title: carried ? `waiting since ${timeAgo(at.toISOString(), today.getTime())}` : undefined,
      href: `/app/approve?run=${encodeURIComponent(asset.runId)}&draft=${encodeURIComponent(asset.draftId)}`,
    }));
    const planned: Mark[] = (slotsByDay.get(key) ?? []).map((slot) => ({
      key: `slot-${slot.draftId}`,
      kind: "plan",
      text: `Planned · ${platformLabel(slot.platform)} ${clock(new Date(slot.scheduledFor))}`,
      title: slot.note ?? undefined,
    }));
    return [...engine, ...you, ...planned];
  }

  const visibleDays = view === "today" ? days.filter((d) => d.isToday) : days;

  // The day view's events. Built from the CALENDAR's own model rather than
  // from marksFor(), because a time axis needs timestamps and marksFor()
  // returns rendered text. Every one of these carries a real time: sweep
  // ticks are projected, planned slots have scheduledFor, and a waiting
  // draft is placed at waitingSince — the same honest placement the main
  // calendar makes. Nothing is invented onto the clock.
  const todayDays = days.filter((d) => d.isToday);
  const todayDayKey = todayDays[0]?.key;
  // planEvents() is not day-scoped (the calendar filters it downstream), so
  // today's key does that here. Breaches are deliberately NOT passed: this
  // strip does not compute cadence, so it shows no breach flags rather than
  // an empty-map flag that would read as "no breaches".
  const allDayEvents =
    view === "today" && plan && todayDayKey
      ? [
          ...sweepEvents(plan.sweep, today, todayDays),
          ...planEvents(plan.plannedSlots, plan.assets, new Map()),
          ...waitingEvents(plan.assets, todayDays, today),
        ].filter((e) => e.day === todayDayKey)
      : [];
  // The window widens to the full day when "now" falls outside the resting
  // one, so the red line is ALWAYS on screen. A day view of the current day
  // that cannot show the current time fails its own promise — and at 04:00
  // the resting 06:00–21:00 window would hide it.
  const nowHour = today.getHours() + today.getMinutes() / 60;
  const win = nowHour >= DAY_WINDOW.start && nowHour < DAY_WINDOW.end ? DAY_WINDOW : FULL_WINDOW;
  const dayEvents = allDayEvents
    .filter((e) => {
      const h = e.at.getHours() + e.at.getMinutes() / 60;
      return h >= win.start && h < win.end;
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  // Anything outside the drawn window is COUNTED, never silently dropped.
  const outsideCount = allDayEvents.length - dayEvents.length;

  // A 24-hour axis is taller than the card, so the day view opens scrolled to
  // the top — showing midnight, with the now-line and the day's events below
  // the fold. It then reads as empty when it is not. Bring now into view
  // instead, a third down so there is context on both sides of the line.
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const nowTop = yOf(nowHour, win);
  useEffect(() => {
    if (view !== "today") return;
    const body = bodyRef.current;
    if (!body) return;
    body.scrollTop = Math.max(0, nowTop - body.clientHeight / 3);
  }, [view, nowTop]);

  // Density. The calendar's own placeColumn() splits colliding events into
  // side-by-side columns, which is right across seven wide day columns and
  // WRONG here: this strip is one ~340px column, so 21 collisions became 21
  // ten-pixel slivers showing a single digit each. Instead the chips stay
  // full width at their true time, and a run that collides collapses into the
  // leading chip with a "+N" — the sheet's own "+N more" grammar, and the
  // same trade the week rows already make with DAY_MARK_BOUND.
  const CHIP_PX = 22;
  const stacked: { event: (typeof dayEvents)[number]; top: number; hidden: number }[] = [];
  for (const event of dayEvents) {
    const top = yOf(event.at.getHours() + event.at.getMinutes() / 60, win);
    const last = stacked[stacked.length - 1];
    if (last && top < last.top + CHIP_PX) last.hidden += 1;
    else stacked.push({ event, top, hidden: 0 });
  }

  return (
    <section className="card" style={{ display: "flex", flexDirection: "column" }} aria-label="This week">
      <div className="card-head">
        <div className="seg">
          <button
            type="button"
            className={view === "today" ? "seg-opt on" : "seg-opt"}
            onClick={() => setView("today")}
          >
            Today
          </button>
          <button
            type="button"
            className={view === "week" ? "seg-opt on" : "seg-opt"}
            onClick={() => setView("week")}
          >
            This week
          </button>
        </div>
        <div style={{ flex: 1 }} />
        <span className="t-label">all times local</span>
      </div>
      {status === "loading" && (
        <div className="week-day">
          <span className="t-label">Reading the week…</span>
        </div>
      )}
      {status === "error" && (
        <div className="week-day">
          <span className="t-label" style={{ color: "var(--err)" }} role="alert">
            Couldn’t load the week.
          </span>
          <div style={{ flex: 1 }} />
          {onRetry && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
              Try again
            </button>
          )}
        </div>
      )}
      {status === "success" && plan && (
        <>
          <div className="week-body" ref={bodyRef}>
            {view === "today" ? (
              <div className="wd-grid" style={{ height: windowHeight(win) }}>
                <div className="wd-gut">
                  {gutterHours(win).map((hour) => (
                    <span key={hour} style={{ top: yOf(hour, win) }}>
                      {`${hour}`.padStart(2, "0")}:00
                    </span>
                  ))}
                </div>
                <div className="wd-col">
                  {gutterHours(win).map((hour) => (
                    <div key={hour} className="wd-hourline" style={{ top: yOf(hour, win) }} />
                  ))}
                  {/* placeColumn is the calendar's own overlap solver: events
                      whose boxes collide split the column side by side rather
                      than stacking on top of each other. Two drafts 20 minutes
                      apart are ~15px apart at HOUR_PX, so without it they
                      overlap illegibly. */}
                  {stacked.map(({ event, top, hidden }) => {
                    const cls =
                      event.kind === "plan" ? "wd-ev wd-plan" : event.kind === "you" ? "wd-ev wd-you" : "wd-ev";
                    const body = (
                      <>
                        <span className="t-data" style={{ marginRight: 6 }}>
                          {clock(event.at)}
                        </span>
                        {event.lead}
                        {hidden > 0 && <span className="mark-quiet"> +{hidden}</span>}
                      </>
                    );
                    const title = hidden > 0 ? `${event.lead} · +${hidden} more at this time` : event.lead;
                    return event.href ? (
                      <Link key={event.id} href={event.href} className={cls} style={{ top }} title={title}>
                        {body}
                      </Link>
                    ) : (
                      <span key={event.id} className={cls} style={{ top }} title={title}>
                        {body}
                      </span>
                    );
                  })}
                  {dayEvents.length === 0 && (
                    <span className="mark-quiet" style={{ position: "absolute", top: 8, left: 10 }}>
                      Nothing on the clock today.
                    </span>
                  )}
                </div>
                {/* The same red line the calendar draws — and only when now is
                    actually inside the drawn window, never pinned to an edge. */}
                {/* Always drawn: `win` is chosen so now is inside it. */}
                <div className="wd-now" style={{ top: yOf(nowHour, win) }} aria-hidden />
                {outsideCount > 0 && (
                  <span className="mark-quiet" style={{ position: "absolute", bottom: 6, left: 10 }}>
                    {outsideCount} outside the drawn hours — not shown, not lost
                  </span>
                )}
              </div>
            ) : (
              visibleDays.map((day) => {
              const marks = marksFor(day.key);
              const shown = marks.slice(0, DAY_MARK_BOUND);
              const overflow = marks.length - shown.length;
              return (
                <div
                  key={day.key}
                  className={day.isToday ? "week-day today" : "week-day"}
                  aria-current={day.isToday ? "date" : undefined}
                >
                  <div className="day-chip">
                    <span className="day-name">{DAY_NAMES[days.indexOf(day)]}</span>
                    <span className="day-num">
                      {day.date.getDate()}
                      {day.isToday && " · today"}
                    </span>
                  </div>
                  <div className="marks">
                    {marks.length === 0 && <span className="mark-quiet">—</span>}
                    {shown.map((mark) =>
                      mark.href ? (
                        <Link key={mark.key} href={mark.href} className={MARK_CLASS[mark.kind]} title={mark.title}>
                          {mark.text}
                        </Link>
                      ) : (
                        <span key={mark.key} className={MARK_CLASS[mark.kind]} title={mark.title}>
                          {mark.text}
                        </span>
                      ),
                    )}
                    {overflow > 0 && (
                      <span
                        className="mark-quiet"
                        title={marks
                          .slice(DAY_MARK_BOUND)
                          .map((m) => (typeof m.text === "string" ? m.text : "sweep"))
                          .join(" · ")}
                      >
                        +{overflow} more
                      </span>
                    )}
                  </div>
                </div>
              );
              })
            )}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "10px 16px",
              borderTop: "1px solid var(--n-400)",
            }}
          >
            <span className="t-label">
              {plan.sweep && sweepOverdue(plan.sweep, today)
                ? `Sweeps overdue — the last pointer expected one ${timeAgo(plan.sweep.nextSweepAt, today.getTime())}`
                : plan.cadence.length > 0
                  ? `Cadence — ${plan.cadence
                      .map((rule) =>
                        [
                          platformLabel(rule.platform),
                          rule.maxPerDay !== undefined ? `≤ ${rule.maxPerDay}/day` : null,
                          rule.maxPerWeek !== undefined ? `≤ ${rule.maxPerWeek}/wk` : null,
                          rule.minGapMinutes !== undefined ? `≥ ${rule.minGapMinutes}m gap` : null,
                        ]
                          .filter(Boolean)
                          .join(" "),
                      )
                      .join(" · ")}`
                  : "No cadence rules configured — every platform drafts unconstrained."}
            </span>
            <div style={{ flex: 1 }} />
            <Link className="card-link" href="/app/calendar">
              Open calendar →
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
