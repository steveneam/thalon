"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fetchPlan } from "@/lib/workspace/client";
import type { PlanPayload } from "@/lib/workspace/types";
import { dayKey, weekDays } from "@/lib/workspace/week";
import { useListKeys } from "@/lib/workspace/keyboard";
import { cn } from "@/lib/utils";
import { AgendaList } from "./agenda-list";
import { DayPanel } from "./day-panel";
import { MonthGrid } from "./month-grid";
import { WeekGrid } from "./week-grid";
import {
  applyFilters,
  chipState,
  cycleFilter,
  deriveItems,
  groupItemsByDay,
  monthCells,
  monthItems,
  observedValues,
  operatorZoneLabel,
  statusWord,
  EMPTY_FILTER,
  type ChipFilter,
} from "./model";

type Density = "month" | "week" | "agenda";

/**
 * The Fan-out content calendar (Phase I, designs of record: "Content
 * Calendar.dc.html" + "Calendar Week.dc.html"). One read — the same plan
 * payload the dashboard uses, always scoped to the active tenant server-side.
 * Density (Month/Week/Agenda) is a view switch over the same items; agenda is
 * the narrow-screen degradation. HONEST STATES: no planned-slot store or
 * publish scheduler exists yet, so items sit at their latest reached pipeline
 * instant, "Plan slot" is disabled with the reason, and nothing drags —
 * drag-to-reschedule (with its Terminal Toast) arrives with the slot store.
 */
export function CalendarSurface() {
  const [payload, setPayload] = useState<PlanPayload | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [anchor, setAnchor] = useState<Date | null>(null);
  const [density, setDensity] = useState<Density>("month");
  const [panelOpen, setPanelOpen] = useState(false);
  const [weekExpanded, setWeekExpanded] = useState(false);
  const [channelFilter, setChannelFilter] = useState<ChipFilter>(EMPTY_FILTER);
  const [statusFilter, setStatusFilter] = useState<ChipFilter>(EMPTY_FILTER);

  useEffect(() => {
    let cancelled = false;
    fetchPlan()
      .then((data) => {
        if (cancelled) return;
        setPayload(data);
        const loaded = new Date();
        setNow(loaded);
        setAnchor(new Date(loaded.getFullYear(), loaded.getMonth(), loaded.getDate()));
      })
      .catch((err: unknown) => {
        if (!cancelled) setNotice(err instanceof Error ? err.message : "failed to load the plan");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(() => deriveItems(payload?.assets ?? []), [payload]);
  const filtered = useMemo(
    () => applyFilters(items, channelFilter, statusFilter),
    [items, channelFilter, statusFilter],
  );
  const byDay = useMemo(() => groupItemsByDay(filtered), [filtered]);
  const channels = useMemo(() => observedValues(items, (i) => i.platform), [items]);
  const words = useMemo(() => observedValues(items, (i) => statusWord(i.status).word), [items]);

  const ready = payload !== null && anchor !== null && now !== null;
  const inMonth = ready ? monthItems(filtered, anchor) : [];
  const inMonthTotal = ready ? monthItems(items, anchor).length : 0;
  const gated = inMonth.filter((i) => statusWord(i.status).word === "gated").length;
  const selectedKey = ready ? dayKey(anchor) : "";
  const selectedItems = byDay.get(selectedKey) ?? [];

  const monthLabel = ready
    ? new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(anchor)
    : "";
  const week = ready ? weekDays(anchor) : [];
  const weekLabel = ready
    ? `${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(week[0].date)} – ${new Intl.DateTimeFormat(
        undefined,
        week[0].date.getMonth() === week[6].date.getMonth()
          ? { day: "numeric" }
          : { month: "short", day: "numeric" },
      ).format(week[6].date)}`
    : "";

  function moveAnchor(deltaDays: number) {
    setAnchor((a) => {
      if (!a) return a;
      const next = new Date(a);
      next.setDate(a.getDate() + deltaDays);
      return next;
    });
  }

  function navigate(direction: 1 | -1) {
    setAnchor((a) => {
      if (!a) return a;
      if (density === "week") {
        const next = new Date(a);
        next.setDate(a.getDate() + 7 * direction);
        return next;
      }
      return new Date(a.getFullYear(), a.getMonth() + direction, 1);
    });
  }

  useListKeys({
    enabled: ready,
    bindings: {
      j: (event) => {
        event.preventDefault();
        moveAnchor(1);
      },
      k: (event) => {
        event.preventDefault();
        moveAnchor(-1);
      },
      Enter: (event) => {
        event.preventDefault();
        setPanelOpen((open) => !open);
      },
    },
  });

  function selectDay(key: string) {
    const [y, m, d] = key.split("-").map(Number);
    setAnchor(new Date(y, m - 1, d));
    setPanelOpen(true);
  }

  const selectedLabel = ready
    ? new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "long" }).format(
        anchor,
      )
    : "";

  const filterChip = (
    value: string,
    filter: ChipFilter,
    onCycle: (value: string) => void,
  ) => {
    const state = chipState(filter, value);
    return (
      <button
        key={value}
        type="button"
        aria-pressed={state !== "off"}
        title={
          state === "off"
            ? `Show only ${value} — click again to exclude`
            : state === "only"
              ? `Only ${value} — click to exclude instead`
              : `Excluding ${value} — click to clear`
        }
        onClick={() => onCycle(value)}
        className={cn(
          "rounded-full border px-2.5 py-0.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          state === "off" && "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
          state === "only" && "border-primary/50 bg-primary/10 font-medium text-foreground",
          state === "not" && "border-border bg-muted font-medium text-muted-foreground line-through",
        )}
      >
        {state === "not" ? `not: ${value} ×` : value}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      {/* j/k day moves are silent for screen readers without this (the leads live-region precedent). */}
      <p aria-live="polite" className="sr-only">
        {ready
          ? `Selected ${selectedLabel} — ${selectedItems.length} item${selectedItems.length === 1 ? "" : "s"}`
          : ""}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">Fan-out</h2>
        <Badge
          variant="outline"
          className="font-mono"
          title="Times shown in your zone. Per-tenant audience-zone lock lives in Settings."
        >
          {ready ? operatorZoneLabel(now) : "…"} · operator-local
        </Badge>
        <div role="tablist" aria-label="Calendar density" className="flex gap-1.5">
          {(["month", "week", "agenda"] as const).map((d) => (
            <button
              key={d}
              role="tab"
              aria-selected={density === d}
              onClick={() => setDensity(d)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs capitalize transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                density === d
                  ? "border-primary/50 bg-primary/10"
                  : "border-border hover:bg-muted",
              )}
            >
              {d}
            </button>
          ))}
        </div>
        <span className="flex items-center gap-0.5">
          <Button
            size="sm"
            variant="ghost"
            className="px-1.5"
            aria-label={density === "week" ? "Previous week" : "Previous month"}
            disabled={!ready}
            onClick={() => navigate(-1)}
          >
            <ChevronLeft aria-hidden className="size-3.5" />
          </Button>
          <span className="min-w-28 text-center text-sm font-semibold u-tabular">
            {density === "week" ? weekLabel : monthLabel}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="px-1.5"
            aria-label={density === "week" ? "Next week" : "Next month"}
            disabled={!ready}
            onClick={() => navigate(1)}
          >
            <ChevronRight aria-hidden className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!ready}
            onClick={() =>
              now && setAnchor(new Date(now.getFullYear(), now.getMonth(), now.getDate()))
            }
          >
            Today
          </Button>
        </span>
        <span className="ml-auto flex items-center gap-2">
          <span className="u-eyebrow hidden text-muted-foreground lg:inline">
            keys · j/k day · enter panel
          </span>
          <Button
            size="sm"
            disabled
            title="Planned slots land with the publish bucket — the calendar reads existing drafts today"
          >
            Plan slot
          </Button>
        </span>
      </div>

      {notice && (
        <p role="status" className="text-xs text-muted-foreground">
          {notice}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="u-eyebrow mr-0.5 text-muted-foreground">channel</span>
        {channels.length === 0 && <span className="text-xs text-muted-foreground">none yet</span>}
        {channels.map((c) => filterChip(c, channelFilter, (v) => setChannelFilter((f) => cycleFilter(f, v))))}
        <span aria-hidden className="mx-1.5 h-4 w-px bg-border" />
        <span className="u-eyebrow mr-0.5 text-muted-foreground">status</span>
        {words.length === 0 && <span className="text-xs text-muted-foreground">none yet</span>}
        {words.map((w) => filterChip(w, statusFilter, (v) => setStatusFilter((f) => cycleFilter(f, v))))}
        <span
          className="u-eyebrow ml-auto text-muted-foreground"
          title="Drafts sit at their latest reached pipeline instant — no planned times exist yet"
        >
          {ready
            ? `${
                inMonth.length === inMonthTotal
                  ? `${inMonthTotal} draft${inMonthTotal === 1 ? "" : "s"}`
                  : `${inMonth.length} of ${inMonthTotal} drafts`
              } this month · ${gated} gated · publish door unarmed — slots are plans`
            : "loading plan…"}
        </span>
      </div>

      <Card className="overflow-hidden p-0">
        {!ready ? (
          <div aria-label="Loading calendar" className="grid grid-cols-7 gap-2 p-4">
            {Array.from({ length: 14 }, (_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row">
            {density === "month" && (
              <MonthGrid
                cells={monthCells(anchor, now)}
                itemsByDay={byDay}
                selectedKey={selectedKey}
                onSelectDay={selectDay}
              />
            )}
            {density === "week" && (
              <WeekGrid
                days={week}
                itemsByDay={byDay}
                now={now}
                expanded={weekExpanded}
                onToggleExpanded={() => setWeekExpanded((v) => !v)}
                onSelectDay={selectDay}
              />
            )}
            {density === "agenda" && (
              <AgendaList
                items={inMonth}
                monthLabel={new Intl.DateTimeFormat(undefined, { month: "long" }).format(anchor)}
              />
            )}
            {panelOpen && (
              <DayPanel date={anchor} items={selectedItems} onClose={() => setPanelOpen(false)} />
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
