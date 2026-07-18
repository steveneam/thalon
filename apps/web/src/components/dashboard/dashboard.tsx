"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { FirstRunCard } from "@/components/dashboard/first-run-card";
import { JourneySpine } from "@/components/dashboard/journey-spine";
import { NeedsYouList, type NeedsYouStatus } from "@/components/dashboard/needs-you-list";
import { WeekCalendar, type CalendarStatus } from "@/components/dashboard/week-calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePulse } from "@/components/workspace/pulse-context";
import { fetchTrends } from "@/lib/intel/client";
import { fetchPlan, fetchStatus } from "@/lib/workspace/client";
import { EMPTY_COUNTS, type PlanPayload, type WorkspaceStatus } from "@/lib/workspace/types";
import type { TrendsPayload } from "@/lib/intel/types";

/**
 * A failed pulse read gets its own honest card: "does anything need me?"
 * must never be answered by a real-looking empty state (critique P0,
 * 2026-07-14). Retry goes through the shared pulse context.
 */
function EngineUnreachableCard({ onRetry }: { onRetry: () => void }) {
  return (
    <Card role="alert" className="border-destructive/40">
      <CardHeader className="flex-row items-center gap-2">
        <TriangleAlert aria-hidden className="size-5 text-destructive" />
        <CardTitle>Couldn&rsquo;t reach the engine</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <span>
          The queue couldn&rsquo;t be read — this is a read failure, not a quiet day.
        </span>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * The dashboard (Phase D spine design): the five journey stations ARE the
 * page — every asset walks the line left to right — then the week strip
 * (what will happen) and the bounded needs-you list (what waits on you).
 * Seam/driver configuration lives in Settings; only degraded health
 * surfaces here.
 */
export function Dashboard() {
  const { pulse, status: pulseStatus, refresh } = usePulse();

  const [health, setHealth] = useState<WorkspaceStatus | null>(null);
  // One status for both plan-backed views (week strip + needs-you) — they share the read.
  const [planStatus, setPlanStatus] = useState<CalendarStatus>("loading");
  const [plan, setPlan] = useState<PlanPayload | null>(null);
  const [trends, setTrends] = useState<TrendsPayload | null>(null);

  const loadPlan = useCallback(
    () =>
      fetchPlan()
        .then((data) => {
          setPlan(data);
          setPlanStatus("success");
        })
        .catch(() => {
          setPlanStatus("error");
        }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void loadPlan();
    // The intel station's peek rides the surface's own trends read; a failed
    // read leaves the station at "–" (never a real-looking zero).
    fetchTrends()
      .then((data) => {
        if (!cancelled) setTrends(data);
      })
      .catch(() => {
        /* the station renders its unresolved state */
      });
    // Best-effort health read: only a degraded gateway surfaces here — the
    // full seam/driver readout is Settings' job, not the dashboard's.
    fetchStatus()
      .then((data) => {
        if (!cancelled) setHealth(data);
      })
      .catch(() => {
        /* the pulse error card covers engine-down; nothing extra to say */
      });
    return () => {
      cancelled = true;
    };
  }, [loadPlan]);

  const counts = pulse?.counts ?? EMPTY_COUNTS;
  const firstRun = pulseStatus === "success" && pulse?.tenant === null;
  const pulseError = pulseStatus === "error";

  const retryPlan = () => {
    setPlanStatus("loading");
    void loadPlan();
  };
  // The needs-you list draws rows from the plan read but its counts from the
  // pulse — it resolves only when both have answered.
  const needsYouStatus: NeedsYouStatus =
    pulseError || planStatus === "error"
      ? "error"
      : pulseStatus === "success" && planStatus === "success"
        ? "success"
        : "loading";

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      {firstRun && <FirstRunCard />}
      {pulseError && <EngineUnreachableCard onRetry={() => void refresh()} />}

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold tracking-tight">The pipeline, left to right</h2>
        <p className="text-sm text-muted-foreground">
          every asset walks this line — click a station to work it
        </p>
      </div>

      <JourneySpine
        counts={counts}
        plan={planStatus === "success" ? plan : null}
        trends={trends}
        unknown={pulseStatus === "loading" || pulseError}
      />

      {health?.seams.gateway === "unconfigured" && (
        <p
          role="status"
          className="rounded-lg border border-signal/40 bg-signal/10 px-3 py-2 text-xs text-foreground"
        >
          The AI gateway key isn&rsquo;t configured — generation and judging can&rsquo;t run
          until it is.{" "}
          <Link href="/app/settings" className="font-medium text-primary hover:underline">
            Check Settings
          </Link>
        </p>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[1.5fr_1fr]">
        <WeekCalendar
          status={planStatus}
          plan={planStatus === "success" ? plan : null}
          onRetry={retryPlan}
        />
        <NeedsYouList
          counts={counts}
          status={needsYouStatus}
          plan={planStatus === "success" ? plan : null}
          onRetry={retryPlan}
        />
      </div>
    </div>
  );
}
