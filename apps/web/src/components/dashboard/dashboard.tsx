"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { ActivityFeed, type ActivityStatus } from "@/components/dashboard/activity-feed";
import { FirstRunCard } from "@/components/dashboard/first-run-card";
import { NeedsYouCard } from "@/components/dashboard/needs-you-card";
import { Omnibox } from "@/components/dashboard/omnibox";
import { PulseRow } from "@/components/dashboard/pulse-row";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePulse } from "@/components/workspace/pulse-context";
import { fetchActivity, fetchStatus } from "@/lib/workspace/client";
import { EMPTY_COUNTS, type ActivityItem, type WorkspaceStatus } from "@/lib/workspace/types";

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
 * The dashboard (docs/FRONTEND.md §3): one screen answering what needs me ·
 * what is the engine doing · what can I do next — the 10-second rule's
 * workspace test. Seam/driver *configuration* lives in Settings (founder
 * direction 2026-07-14); the dashboard only surfaces degraded health.
 */
export function Dashboard() {
  const { pulse, status: pulseStatus, refresh } = usePulse();

  const [activityStatus, setActivityStatus] = useState<ActivityStatus>("loading");
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [health, setHealth] = useState<WorkspaceStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchActivity()
      .then((items) => {
        if (cancelled) return;
        setActivity(items);
        setActivityStatus("success");
      })
      .catch(() => {
        if (!cancelled) setActivityStatus("error");
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
  }, []);

  const counts = pulse?.counts ?? EMPTY_COUNTS;
  const needsYou = pulse?.needsYou ?? 0;
  const firstRun = pulseStatus === "success" && pulse?.tenant === null;
  const pulseError = pulseStatus === "error";

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <Omnibox />
      <PulseRow
        counts={counts}
        needsYou={needsYou}
        loading={pulseStatus === "loading"}
        error={pulseError}
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
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {firstRun ? (
            <FirstRunCard />
          ) : pulseError ? (
            <EngineUnreachableCard onRetry={() => void refresh()} />
          ) : (
            <NeedsYouCard counts={counts} needsYou={needsYou} />
          )}
          <QuickActions />
        </div>
        <ActivityFeed status={activityStatus} items={activity} />
      </div>
    </div>
  );
}
