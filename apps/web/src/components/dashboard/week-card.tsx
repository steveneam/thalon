"use client";

import { useState } from "react";
import Link from "next/link";
import { platformLabel, slotsInWeek } from "@/components/dashboard/dashboard-model";
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
          <div>
            {visibleDays.map((day) => {
              const marks = marksFor(day.key);
              const shown = view === "today" ? marks : marks.slice(0, DAY_MARK_BOUND);
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
            })}
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
