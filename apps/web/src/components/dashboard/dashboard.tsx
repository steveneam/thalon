"use client";

import { useEffect, useState } from "react";
import { ActivityFeed, type ActivityStatus } from "@/components/dashboard/activity-feed";
import { FirstRunCard } from "@/components/dashboard/first-run-card";
import { NeedsYouCard } from "@/components/dashboard/needs-you-card";
import { Omnibox } from "@/components/dashboard/omnibox";
import { PulseRow } from "@/components/dashboard/pulse-row";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { SeamStatusCard, type StatusCardStatus } from "@/components/dashboard/seam-status-card";
import { usePulse } from "@/components/workspace/pulse-context";
import { fetchActivity, fetchStatus } from "@/lib/workspace/client";
import { EMPTY_COUNTS } from "@/lib/workspace/pulse";
import type { ActivityItem, WorkspaceStatus } from "@/lib/workspace/types";

/**
 * The dashboard (docs/FRONTEND.md §3): one screen answering what needs me ·
 * what is the engine doing · what can I do next — the 10-second rule's
 * workspace test.
 */
export function Dashboard() {
  const { pulse, status: pulseStatus } = usePulse();

  const [activityStatus, setActivityStatus] = useState<ActivityStatus>("loading");
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [seamStatus, setSeamStatus] = useState<StatusCardStatus>("loading");
  const [seams, setSeams] = useState<WorkspaceStatus | null>(null);

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
    fetchStatus()
      .then((data) => {
        if (cancelled) return;
        setSeams(data);
        setSeamStatus("success");
      })
      .catch(() => {
        if (!cancelled) setSeamStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = pulse?.counts ?? EMPTY_COUNTS;
  const needsYou = pulse?.needsYou ?? 0;
  const firstRun = pulseStatus === "success" && pulse?.tenant === null;

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <Omnibox />
      <PulseRow counts={counts} needsYou={needsYou} loading={pulseStatus === "loading"} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {firstRun ? <FirstRunCard /> : <NeedsYouCard counts={counts} needsYou={needsYou} />}
          <QuickActions />
          <SeamStatusCard status={seamStatus} data={seams} />
        </div>
        <ActivityFeed status={activityStatus} items={activity} />
      </div>
    </div>
  );
}
