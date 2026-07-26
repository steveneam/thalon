"use client";

import "@/components/calendar/calendar.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  assetEvents,
  byMarkPriority,
  cadenceBreaches,
  cadenceLine,
  clockLabel,
  eventsInScope,
  groupByKey,
  gutterHours,
  monthCells,
  outsideWindow,
  placeColumn,
  planEvents,
  sweepEvents,
  waitingEvents,
  weekRangeLabel,
  windowHeight,
  yOf,
  DAY_NAMES,
  DAY_WINDOW,
  FULL_WINDOW,
  SCOPES,
  type CalEvent,
  type Scope,
} from "@/components/calendar/calendar-model";
import { fetchViews, putView } from "@/lib/views/client";
import { useListKeys } from "@/lib/workspace/keyboard";
import { fetchPlan, planSlot, removeSlot } from "@/lib/workspace/client";
import type { PlanPayload } from "@/lib/workspace/types";
import { dayKey, weekDays } from "@/lib/workspace/week";

type Density = "week" | "month" | "agenda";
type ReadState = "loading" | "error" | "success";

/** The tenant-wide saved view this surface owns (Phase-I views store, /api/views). */
const VIEW_SURFACE = "calendar";
const VIEW_NAME = "Default";
/** The sheet bounds a day cell at what it can show; the rest counts honestly. */
const LANE_CHIP_BOUND = 2;
const MONTH_MARK_BOUND = 3;

interface SavedConfig {
  density: Density;
  scope: Scope;
  expanded: boolean;
}

const DEFAULT_VIEW: SavedConfig = { density: "week", scope: "all", expanded: false };

function sameView(a: SavedConfig, b: SavedConfig): boolean {
  return a.density === b.density && a.scope === b.scope && a.expanded === b.expanded;
}

function coerceView(config: Record<string, unknown>): SavedConfig {
  const { density, scope } = config;
  return {
    density:
      density === "week" || density === "month" || density === "agenda"
        ? density
        : DEFAULT_VIEW.density,
    scope:
      scope === "all" || scope === "plans" || scope === "needs" || scope === "flagged"
        ? scope
        : DEFAULT_VIEW.scope,
    expanded: config.expanded === true,
  };
}

/**
 * Calendar — STEP 2 of the two-step rebuild: the byte-true port of
 * Calendar.dc.html with the real plan read behind it. The sheet owns every
 * band, class and copy grammar; this layer only decides what is TRUE to put
 * in them:
 *
 *  - the grid places PLANS (the tenant's planned slots), work that COMPLETED
 *    at the instant it completed, and the sweeps the engine WILL run —
 *    projected from the live pointer, and nothing at all when that pointer is
 *    overdue (projecting from a stalled poller is fiction);
 *  - the all-day lane is what waits on YOU, on the day it started waiting,
 *    carried into today when it is older than the week;
 *  - the ⚑ flag is the sheet's own claim made checkable: a plan that breaks
 *    the tenant's real cadence rules, with the broken rule named;
 *  - the keeper engine returns as the two other densities (month · agenda)
 *    and the keeper saved view (tenant-wide, /api/views) restores the
 *    operator's density/scope without adding a band the sheet does not draw;
 *  - HONEST STATES: a failed read says so and offers retry, an empty week says
 *    it is empty, and a failed write says nothing changed;
 *  - s78: the slot store's WRITE route (`/api/calendar/slots`) is armed, so
 *    Reschedule and Remove move and delete real plans from the detail
 *    popover. Drag is still not wired, which is why no event box advertises
 *    one any more (no grab cursor, no grip).
 */
export function CalendarSurface() {
  const router = useRouter();
  const [status, setStatus] = useState<ReadState>("loading");
  const [plan, setPlan] = useState<PlanPayload | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [anchor, setAnchor] = useState<Date | null>(null);
  const [density, setDensity] = useState<Density>(DEFAULT_VIEW.density);
  const [scope, setScope] = useState<Scope>(DEFAULT_VIEW.scope);
  const [expanded, setExpanded] = useState(DEFAULT_VIEW.expanded);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** The slot write door's in-flight state — one plan is moved or removed at a time. */
  const [slotBusy, setSlotBusy] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);
  /** The saved view is loaded before it is written back — never clobber it with defaults. */
  const [viewLoaded, setViewLoaded] = useState(false);
  /** What the views store already holds — a write only follows a real change. */
  const persistedRef = useRef<SavedConfig>(DEFAULT_VIEW);

  const load = useCallback(
    () =>
      fetchPlan()
      .then((payload) => {
        const loaded = new Date();
        setPlan(payload);
        setNow(loaded);
        setAnchor(
          (current) => current ?? new Date(loaded.getFullYear(), loaded.getMonth(), loaded.getDate()),
        );
        setStatus("success");
      })
      .catch(() => {
        // A read failure is never a quiet week — it says so, and offers retry.
        const loaded = new Date();
        setNow((current) => current ?? loaded);
        setAnchor(
          (current) => current ?? new Date(loaded.getFullYear(), loaded.getMonth(), loaded.getDate()),
        );
        setStatus("error");
      }),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // The saved view is TENANT-WIDE (the storage-story rule: the server is the
  // record, the browser only ever holds a copy). It restores the operator's
  // density/scope silently — the sheet draws no "save view" band, and a keeper
  // re-enters as state behind the resting chrome, never as new chrome.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const views = await fetchViews(VIEW_SURFACE);
        const stored = views.find((v) => v.name === VIEW_NAME);
        if (stored && !cancelled) {
          const config = coerceView(stored.config);
          persistedRef.current = config;
          setDensity(config.density);
          setScope(config.scope);
          setExpanded(config.expanded);
        }
      } catch {
        // Views store unreachable: the surface keeps the sheet's own defaults.
      } finally {
        if (!cancelled) setViewLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!viewLoaded) return;
    const config: SavedConfig = { density, scope, expanded };
    // Only an actual CHANGE is worth a write — opening the calendar must not
    // PUT the view back at the server on every visit.
    if (sameView(config, persistedRef.current)) return;
    const timer = setTimeout(() => {
      const before = persistedRef.current;
      persistedRef.current = config;
      // Best-effort: a view preference must never surface an error over the
      // plan — a failed write just leaves the store's own value in place.
      void putView(VIEW_SURFACE, VIEW_NAME, { ...config }).catch(() => {
        persistedRef.current = before;
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [viewLoaded, density, scope, expanded]);

  const win = expanded ? FULL_WINDOW : DAY_WINDOW;
  /**
   * THE CLOCK DECIDES WHICH DAY IS TODAY, never the navigation anchor.
   * `weekDays` flags today against its OWN argument (it is documented as "the
   * week containing now"), so feeding it the anchor marked one day of EVERY
   * paged week as today: the "· today" label and the tinted column moved with
   * the pager, `NowLine`'s only gate (`days.some(d => d.isToday)`) never went
   * false so a line meaning "now" drew on weeks that do not contain now, and
   * `waitingEvents` piled every carried draft onto that fake day. Re-flagging
   * here against `now` is exactly what `monthCells(anchor, now)` already does
   * — the week grid was the one place that contradicted the rest of the
   * surface. Kept local: `weekDays` is shared with Dashboard and Runs, which
   * correctly pass the real clock.
   */
  const days = useMemo(() => {
    if (!anchor) return [];
    const week = weekDays(anchor);
    if (!now) return week.map((day) => ({ ...day, isToday: false }));
    const key = dayKey(now);
    return week.map((day) => ({ ...day, isToday: day.key === key }));
  }, [anchor, now]);

  const breaches = useMemo(
    () => cadenceBreaches(plan?.plannedSlots ?? [], plan?.cadence ?? []),
    [plan],
  );

  // The derived events (sweep projections, the waiting carry) are computed for
  // the RANGE ON SCREEN — a month view that only projected the anchor week
  // would show its other three weeks as quieter than they are.
  const monthDays = useMemo(
    () =>
      anchor && now
        ? monthCells(anchor, now).map((cell) => ({
            date: cell.date,
            key: cell.key,
            isToday: cell.isToday,
          }))
        : [],
    [anchor, now],
  );
  const rangeDays = density === "month" ? monthDays : days;

  const allEvents = useMemo(() => {
    if (!plan || !now || rangeDays.length === 0) return [];
    return [
      ...planEvents(plan.plannedSlots, plan.assets, breaches),
      ...assetEvents(plan.assets),
      ...sweepEvents(plan.sweep, now, rangeDays),
      ...waitingEvents(plan.assets, rangeDays, now),
    ];
  }, [plan, now, rangeDays, breaches]);

  const rangeKeys = useMemo(() => new Set(rangeDays.map((d) => d.key)), [rangeDays]);
  const visible = useMemo(
    () => eventsInScope(allEvents, scope).filter((e) => rangeKeys.has(e.day)),
    [allEvents, scope, rangeKeys],
  );
  /** The time grid holds everything except waiting work — that has its own lane. */
  const gridByDay = useMemo(
    () => groupByKey(visible.filter((e) => e.kind !== "you")),
    [visible],
  );
  const laneByDay = useMemo(() => groupByKey(visible.filter((e) => e.kind === "you")), [visible]);
  const monthByDay = useMemo(() => groupByKey(visible), [visible]);

  const plannedInView = visible.filter((e) => e.kind === "plan").length;
  const hidden = outsideWindow(
    visible.filter((e) => e.kind !== "you"),
    win,
  );
  const quietTop = hidden.filter((e) => e.at.getHours() < win.start);
  const quietBottom = hidden.filter((e) => e.at.getHours() >= win.end);

  // The one list keyboard grammar (keeper): j/k walk the week's events in time
  // order, ↵ opens the focused draft. Selection wears the sheet's own `.sel`
  // and opens the sheet's own detail popover.
  const ordered = useMemo(
    () => [...visible].sort((a, b) => a.at.getTime() - b.at.getTime()),
    [visible],
  );
  const selected = ordered.find((e) => e.id === selectedId) ?? null;

  function moveCursor(delta: number) {
    if (ordered.length === 0) return;
    const index = ordered.findIndex((e) => e.id === selectedId);
    const next = index === -1 ? (delta > 0 ? 0 : ordered.length - 1) : index + delta;
    setSelectedId(ordered[Math.max(0, Math.min(ordered.length - 1, next))].id);
  }

  useListKeys({
    enabled: status !== "loading" && density === "week",
    bindings: {
      j: (event) => {
        event.preventDefault();
        moveCursor(1);
      },
      k: (event) => {
        event.preventDefault();
        moveCursor(-1);
      },
      Enter: (event) => {
        // A focused control activates itself — the list grammar only owns ↵
        // when nothing on the surface has the keyboard.
        if (event.target instanceof HTMLElement && event.target.closest("button, a")) return;
        if (!selected?.href) return;
        event.preventDefault();
        router.push(selected.href);
      },
      Escape: () => setSelectedId(null),
    },
  });

  /**
   * The slot write door (s78, /api/calendar/slots). A plan is an intention:
   * moving or removing one publishes nothing and arms nothing. Both re-read
   * the plan afterwards so the grid shows the stored truth, not an optimistic
   * guess — the write is the record, the surface only ever holds a copy.
   */
  async function reschedule(draftId: string, at: Date) {
    setSlotBusy(true);
    setSlotError(null);
    try {
      await planSlot({ draftId, scheduledFor: at.toISOString() });
      setSelectedId(null);
      await load();
    } catch (err) {
      setSlotError(err instanceof Error ? err.message : "Couldn’t move the plan — nothing changed.");
    } finally {
      setSlotBusy(false);
    }
  }

  async function removePlan(draftId: string) {
    setSlotBusy(true);
    setSlotError(null);
    try {
      await removeSlot(draftId);
      setSelectedId(null);
      await load();
    } catch (err) {
      setSlotError(
        err instanceof Error ? err.message : "Couldn’t remove the plan — nothing changed.",
      );
    } finally {
      setSlotBusy(false);
    }
  }

  function navigate(direction: 1 | -1) {
    setSelectedId(null);
    setAnchor((current) => {
      if (!current) return current;
      const next = new Date(current);
      if (density === "month") next.setMonth(current.getMonth() + direction, 1);
      else next.setDate(current.getDate() + 7 * direction);
      return next;
    });
  }

  const rangeLabel =
    !anchor || days.length === 0
      ? "…"
      : density === "month"
        ? new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(anchor)
        : weekRangeLabel(days);

  const headerNote =
    density === "month"
      ? "the plan read covers ±2 weeks — a month shows what it carries"
      : "drag isn’t wired — open a plan to reschedule or remove it";

  const toggleQuiet = (
    <button type="button" className="bare quiet-toggle" onClick={() => setExpanded((v) => !v)}>
      {expanded ? "collapse" : "expand"}
    </button>
  );

  return (
    <div className="content calendar-surface" style={{ gap: 12 }}>
      {/* j/k selection is a silent context change for screen readers without this. */}
      <p aria-live="polite" className="sr-only">
        {selected ? `${selected.lead} — ${selected.meta}` : ""}
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h1 className="t-headline">Calendar</h1>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ padding: "0 8px" }}
          aria-label={density === "month" ? "Previous month" : "Previous week"}
          disabled={!anchor}
          onClick={() => navigate(-1)}
        >
          ‹
        </button>
        <span className="t-title">{rangeLabel}</span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ padding: "0 8px" }}
          aria-label={density === "month" ? "Next month" : "Next week"}
          disabled={!anchor}
          onClick={() => navigate(1)}
        >
          ›
        </button>
        <div
          className="seg"
          role="group"
          aria-label="Density"
          title="Your density and scope are saved for the whole workspace"
        >
          {(["week", "month", "agenda"] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={density === d}
              className={density === d ? "seg-opt on" : "seg-opt"}
              onClick={() => {
                setDensity(d);
                setSelectedId(null);
              }}
            >
              {d === "week" ? "Week" : d === "month" ? "Month" : "Agenda"}
            </button>
          ))}
        </div>
        <div className="seg" role="group" aria-label="Scope">
          {SCOPES.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={scope === s.id}
              className={scope === s.id ? "seg-opt on" : "seg-opt"}
              title={
                s.id === "flagged"
                  ? "Plans that break your own cadence rules — the flag names the rule"
                  : undefined
              }
              onClick={() => {
                setScope(s.id);
                setSelectedId(null);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <span className="pill pill-idle">
          {status === "success" ? `${plannedInView} planned` : "– planned"}
        </span>
        <span className="t-label">{headerNote}</span>
      </div>

      {status === "error" && (
        <div
          className="card read-error"
          role="alert"
          style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px" }}
        >
          <span className="t-label">
            Couldn’t read the plan — this is a read failure, not an empty calendar.
          </span>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setStatus("loading");
              void load();
            }}
          >
            Try again
          </button>
        </div>
      )}

      {density === "week" && (
        <div className="cal">
          <div className="cal-days">
            <div />
            {days.map((day, index) => (
              <div key={day.key} className={day.isToday ? "cal-dh today" : "cal-dh"}>
                <b>{DAY_NAMES[index]}</b>
                <span>
                  {day.date.getDate()}
                  {day.isToday && " · today"}
                </span>
              </div>
            ))}
          </div>

          <div className="allday">
            <div className="allday-gut">waiting</div>
            {days.map((day) => {
              const lane = laneByDay.get(day.key) ?? [];
              const shown = lane.slice(0, LANE_CHIP_BOUND);
              const overflow = lane.length - shown.length;
              return (
                <div key={day.key} className="allday-cell">
                  {shown.map((event) => (
                    <Link
                      key={event.id}
                      href={event.href ?? "/app/approve"}
                      className="amber-chip"
                      title={
                        event.carried
                          ? `started waiting before this week — ${event.hours}h`
                          : event.meta
                      }
                    >
                      {event.lead} · {event.hours}h →
                    </Link>
                  ))}
                  {overflow > 0 && (
                    // A count is not a door. The remainder used to be
                    // reachable only through a mouse-only `title`, so
                    // keyboard and touch had no route to it at all. Agenda
                    // at "Needs you" scope is the density that lists every
                    // waiting item untruncated, each with its own Approve
                    // link — the surface's own vocabulary, no new grammar.
                    <button
                      type="button"
                      className="bare lane-more"
                      aria-label={`Open all ${lane.length} waiting this week in the agenda`}
                      title={lane
                        .slice(shown.length)
                        .map((e) => e.lead)
                        .join(" · ")}
                      onClick={() => {
                        setDensity("agenda");
                        setScope("needs");
                        setSelectedId(null);
                      }}
                    >
                      +{overflow} more
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="quiet">
            <div className="allday-gut">00–06</div>
            <div className="quiet-band">
              {expanded
                ? "quiet hours · shown"
                : quietTop.length === 0
                  ? "quiet hours · collapsed — nothing scheduled"
                  : `quiet hours · collapsed — ${quietTop.length} hidden`}{" "}
              · {toggleQuiet}
            </div>
          </div>

          <div className="grid-wrap">
            <NowLine now={now} days={days} win={win} />
            <div className="gut" style={expanded ? { height: windowHeight(win) } : undefined}>
              {gutterHours(win).map((hour) => (
                <span key={hour} style={{ top: yOf(hour, win) }}>
                  {`${hour}`.padStart(2, "0")}:00
                </span>
              ))}
            </div>
            {days.map((day) => {
              const inWindow = (gridByDay.get(day.key) ?? []).filter((e) => {
                const h = e.at.getHours() + e.at.getMinutes() / 60;
                return h >= win.start && h < win.end;
              });
              return (
                <div
                  key={day.key}
                  className={day.isToday ? "dcol today" : "dcol"}
                  style={expanded ? { height: windowHeight(win) } : undefined}
                >
                  {placeColumn(inWindow, win).map(({ event, top, height, leftPct, widthPct }) => (
                    <EventBox
                      key={event.id}
                      event={event}
                      top={top}
                      height={height}
                      leftPct={leftPct}
                      widthPct={widthPct}
                      selected={event.id === selectedId}
                      onSelect={() => setSelectedId(event.id === selectedId ? null : event.id)}
                    />
                  ))}
                </div>
              );
            })}

            {selected && (
              <DetailCard
                // Keyed by the event: the card holds a mode and a typed
                // instant, and neither may survive into a different plan.
                key={selected.id}
                event={selected}
                anchorTop={yOf(selected.at.getHours() + selected.at.getMinutes() / 60, win)}
                windowPx={windowHeight(win)}
                onClose={() => setSelectedId(null)}
                onReschedule={reschedule}
                onRemove={removePlan}
                busy={slotBusy}
                error={slotError}
              />
            )}
          </div>

          <div className="quiet quiet-foot">
            <div className="allday-gut">21–24</div>
            <div className="quiet-band">
              {expanded
                ? "quiet hours · shown"
                : quietBottom.length === 0
                  ? "quiet hours · collapsed"
                  : `quiet hours · collapsed — ${quietBottom.length} hidden`}{" "}
              · {toggleQuiet}
            </div>
          </div>
        </div>
      )}

      {density === "month" && anchor && now && (
        <div className="cal">
          <div className="cal-month cal-month-head">
            {DAY_NAMES.map((name) => (
              <div key={name} className="cal-dh">
                <b>{name}</b>
              </div>
            ))}
          </div>
          <div className="cal-month">
            {monthCells(anchor, now).map((cell) => {
              const marks = [...(monthByDay.get(cell.key) ?? [])].sort(byMarkPriority);
              const shown = marks.slice(0, MONTH_MARK_BOUND);
              return (
                <div
                  key={cell.key}
                  className={`mcell${cell.inMonth ? "" : " out"}${cell.isToday ? " today" : ""}`}
                >
                  <span className="mday">{cell.date.getDate()}</span>
                  <div className="marks">
                    {marks.length === 0 && <span className="mark-quiet">—</span>}
                    {shown.map((event) => (
                      <MonthMark key={event.id} event={event} />
                    ))}
                    {marks.length > shown.length && (
                      // The same dead count as the week lane. Here the
                      // honest destination is the day itself: open the week
                      // that holds it, where every mark is a placed box.
                      <button
                        type="button"
                        className="bare mark-quiet"
                        aria-label={`Open the week of ${cell.date.getDate()} to see all ${marks.length}`}
                        title={marks
                          .slice(MONTH_MARK_BOUND)
                          .map((e) => `${e.lead} · ${e.meta}`)
                          .join(" · ")}
                        onClick={() => {
                          setAnchor(cell.date);
                          setDensity("week");
                          setSelectedId(null);
                        }}
                      >
                        +{marks.length - shown.length} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {density === "agenda" && (
        <div className="card">
          <div className="card-head">
            <span className="t-title">Agenda</span>
            <div style={{ flex: 1 }} />
            <span className="t-label">{rangeLabel} · in time order</span>
          </div>
          {status === "loading" ? (
            <div className="row">
              <span className="t-label">Reading the plan…</span>
            </div>
          ) : ordered.length === 0 ? (
            <div className="row">
              <span className="t-label">
                Nothing in this week{scope === "all" ? "" : " for this scope"} — plans, completed
                work, engine sweeps and what waits on you all land here.
              </span>
            </div>
          ) : (
            ordered.map((event) => <AgendaRow key={event.id} event={event} />)
          )}
        </div>
      )}

      {density === "week" && status === "loading" && (
        <span className="t-label">Reading the plan…</span>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span className="t-label">{plan ? cadenceLine(plan.cadence) : "Cadence — reading…"}</span>
        <div style={{ flex: 1 }} />
        <span className="t-label">Plans, not uploads — each platform’s door arms on your GO.</span>
      </div>
    </div>
  );
}

function NowLine({
  now,
  days,
  win,
}: {
  now: Date | null;
  days: ReturnType<typeof weekDays>;
  win: { start: number; end: number };
}) {
  if (!now || !days.some((d) => d.isToday)) return null;
  const hour = now.getHours() + now.getMinutes() / 60;
  if (hour < win.start || hour >= win.end) return null;
  return <div className="nowline" style={{ top: yOf(hour, win) }} aria-hidden />;
}

const EVENT_CLASS: Record<CalEvent["kind"], string> = {
  plan: "ev ev-plan",
  done: "ev done ev-ok",
  closed: "ev done",
  engine: "ev",
  you: "ev",
};

function EventBox({
  event,
  top,
  height,
  leftPct,
  widthPct,
  selected,
  onSelect,
}: {
  event: CalEvent;
  top: number;
  height: number;
  leftPct: number;
  widthPct: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`${EVENT_CLASS[event.kind]}${selected ? " sel" : ""}`}
      style={{
        top,
        height,
        // App adaptation (named): concurrent events split the column — the
        // sheet's fixture never puts two in one hour, real days do.
        left: `calc(4px + ${leftPct}%)`,
        right: "auto",
        width: `calc(${widthPct}% - 8px)`,
      }}
      aria-pressed={selected}
      onClick={onSelect}
    >
      {/* The ⋮⋮ grip is the sheet's drag handle; drag is not wired, so it is
          not drawn (see the cursor note in calendar.css). */}
      <b>
        {event.lead} {event.flagged && <span className="flag">⚑</span>}
      </b>
      {event.meta}
    </button>
  );
}

function MonthMark({ event }: { event: CalEvent }) {
  const className =
    event.kind === "plan" ? "mark mark-plan" : event.kind === "you" ? "mark mark-you" : "mark";
  // Same carried-row gap as the agenda: a clock from another day, printed in
  // today's cell, is a time this cell never held. The hours waited is the
  // fact that IS true of a carried item.
  const text = event.carried
    ? `${event.lead} · ${event.hours}h waiting`
    : `${event.lead} ${clockLabel(event.at)}`;
  const title = event.carried
    ? `started waiting before this week — ${event.hours}h`
    : event.meta;
  return event.href ? (
    <Link href={event.href} className={className} title={title}>
      {text}
    </Link>
  ) : (
    <span className={className} title={title}>
      {text}
    </span>
  );
}

/** "14 Jul" — the carried row's true date, which its weekday alone cannot tell. */
const CARRIED_DATE = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });

function AgendaRow({ event }: { event: CalEvent }) {
  /**
   * A CARRIED waiting item keeps its true instant but is filed under today,
   * so a bare weekday stamp names a day that also exists inside the labelled
   * range — a three-week-old draft read as "Sat 09:00" under "21 – 27 July",
   * and sorted to the top as if it were the week's first item. The week lane
   * already discloses this ("started waiting before this week"); agenda did
   * not, because `excerpt || meta` suppressed the "waiting Nh" line for every
   * real draft. Both channels now carry it: a dated stamp, and the words.
   */
  const body = (
    <>
      <span className="t-data agenda-when">
        {event.carried
          ? `${CARRIED_DATE.format(event.at)} ${clockLabel(event.at)}`
          : `${DAY_NAMES[(event.at.getDay() + 6) % 7]} ${clockLabel(event.at)}`}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="agenda-lead">
          {event.lead} {event.flagged && <span className="flag">⚑</span>}
        </div>
        <div className="excerpt">
          {event.carried && `started waiting before this week · ${event.hours}h — `}
          {event.excerpt || event.meta}
        </div>
      </div>
      {event.kind === "plan" && <span className="pill pill-idle">plan</span>}
      {event.kind === "you" && <span className="pill pill-warn">needs you</span>}
    </>
  );
  return event.href ? (
    <Link className="row" href={event.href} style={{ color: "inherit" }}>
      {body}
    </Link>
  ) : (
    <div className="row">{body}</div>
  );
}

/** A Date as the value a `datetime-local` input wants — local parts, no zone. */
function toLocalInputValue(date: Date): string {
  const pad = (n: number) => `${n}`.padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * The sheet's detail popover, at the selected event's own height. Its two
 * plan doors are LIVE as of s78: `/api/calendar/slots` writes the slot store
 * (POST upserts = plan or re-plan, DELETE unplans), so Reschedule moves a
 * real plan and Remove deletes one. Both are still PLANS — neither publishes
 * nor arms anything.
 *
 * Keyed by the selected event at the call site: this component holds a mode
 * and a typed instant, and state must never outlive the entity it describes.
 */
function DetailCard({
  event,
  anchorTop,
  windowPx,
  onClose,
  onReschedule,
  onRemove,
  busy,
  error,
}: {
  event: CalEvent;
  anchorTop: number;
  windowPx: number;
  onClose: () => void;
  onReschedule: (draftId: string, at: Date) => void;
  onRemove: (draftId: string) => void;
  busy: boolean;
  error: string | null;
}) {
  const [mode, setMode] = useState<"idle" | "move" | "remove">("idle");
  const [when, setWhen] = useState(() => toLocalInputValue(event.at));
  const DETAIL_HEIGHT = 190;
  const top = Math.max(0, Math.min(anchorTop, Math.max(0, windowPx - DETAIL_HEIGHT)));
  return (
    <div
      className="detail"
      style={{ top, right: 2, width: 184, padding: "11px 12px" }}
      role="dialog"
      aria-label={event.lead}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span className="t-title detail-title">{event.lead}</span>
        <div style={{ flex: 1 }} />
        {event.flagged && (
          <span className="flag" title={event.flagReason}>
            ⚑
          </span>
        )}
        <button type="button" className="bare detail-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <span className="t-label detail-when">
        {new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric" }).format(event.at)} ·{" "}
        {clockLabel(event.at)} · {event.kind === "plan" ? "door unarmed — a plan" : event.meta}
      </span>
      {event.excerpt && (
        <div className="excerpt detail-excerpt">
          <em>“{event.excerpt}”</em>
        </div>
      )}
      {event.href && (
        <Link className="card-link" href={event.href} style={{ whiteSpace: "nowrap" }}>
          {event.kind === "you" || event.kind === "plan" || event.kind === "done" || event.kind === "closed"
            ? "Open draft →"
            : "Open Intel →"}
        </Link>
      )}
      {event.kind === "plan" && event.draftId && (
        <>
          {mode === "idle" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ flex: 1, padding: "0 6px" }}
                disabled={busy}
                onClick={() => setMode("move")}
              >
                Reschedule
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                style={{ padding: "0 7px" }}
                disabled={busy}
                onClick={() => setMode("remove")}
              >
                Remove
              </button>
            </div>
          )}

          {mode === "move" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label className="t-label" htmlFor={`move-${event.id}`}>
                Move this plan to
              </label>
              <input
                id={`move-${event.id}`}
                className="input"
                type="datetime-local"
                value={when}
                disabled={busy}
                onChange={(e) => setWhen(e.target.value)}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ flex: 1, padding: "0 6px" }}
                  disabled={busy || when === ""}
                  onClick={() => {
                    const at = new Date(when);
                    if (Number.isNaN(at.getTime())) return;
                    onReschedule(event.draftId as string, at);
                  }}
                >
                  {busy ? "Moving…" : "Move"}
                </button>
                <button
                  type="button"
                  className="btn btn-quiet btn-sm"
                  style={{ padding: "0 7px" }}
                  disabled={busy}
                  onClick={() => {
                    setWhen(toLocalInputValue(event.at));
                    setMode("idle");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {mode === "remove" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="t-label">
                Remove this plan? The draft stays — only the slot goes, and you can plan it again.
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  style={{ flex: 1, padding: "0 6px" }}
                  disabled={busy}
                  onClick={() => onRemove(event.draftId as string)}
                >
                  {busy ? "Removing…" : "Remove"}
                </button>
                <button
                  type="button"
                  className="btn btn-quiet btn-sm"
                  style={{ padding: "0 7px" }}
                  disabled={busy}
                  onClick={() => setMode("idle")}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {error && (
            <span className="t-label" role="alert" style={{ color: "var(--err)" }}>
              {error}
            </span>
          )}
        </>
      )}
      <span className="t-label detail-foot">
        {event.flagged
          ? event.flagReason
          : event.kind === "plan"
            ? "cadence-legal — checked against your own rules"
            : "a record of what happened — nothing here reschedules"}
      </span>
    </div>
  );
}
