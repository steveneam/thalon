"use client";

import Link from "next/link";
import { Activity, CircleAlert, User, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorNotice } from "@/components/workspace/error-notice";
import { cn } from "@/lib/utils";
import { describeActivity } from "@/lib/workspace/activity";
import { timeAgo } from "@/lib/workspace/format";
import type { ActivityItem } from "@/lib/workspace/types";

export type ActivityStatus = "loading" | "error" | "success";

interface ActivityFeedProps {
  status: ActivityStatus;
  items: ActivityItem[];
  /** Reload the feed after a failed read (the shared ErrorNotice contract). */
  onRetry?: () => void;
}

const TONE_ICON = { engine: Zap, operator: User, alert: CircleAlert } as const;

/**
 * The live activity feed: work attributed to the engine, each row linking to
 * the surface where its entity lives (event → run → draft provenance).
 */
export function ActivityFeed({ status, items, onRetry }: ActivityFeedProps) {
  return (
    <Card className="min-h-64">
      <CardHeader className="flex-row items-center gap-2">
        <Activity aria-hidden className="size-4 text-primary" />
        <CardTitle>Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {status === "loading" && (
          <div className="flex flex-col gap-3" aria-label="Loading activity">
            <Skeleton className="h-4" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        )}
        {status === "error" && <ErrorNotice message="Couldn’t load activity." onRetry={onRetry} />}
        {status === "success" && items.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nothing yet — every ingest, judge verdict, and approval will show up here as it
            happens.
          </p>
        )}
        {status === "success" && items.length > 0 && (
          <ol className="flex flex-col">
            {items.map((item) => {
              const view = describeActivity(item);
              const Icon = TONE_ICON[view.tone];
              const body = (
                <>
                  <Icon
                    aria-hidden
                    className={cn(
                      "mt-0.5 size-3.5 shrink-0",
                      view.tone === "alert" ? "text-destructive" : "text-primary/80",
                    )}
                  />
                  <span className="min-w-0 flex-1 text-sm leading-snug">{view.summary}</span>
                  <time dateTime={item.at} className="u-tabular shrink-0 text-xs text-muted-foreground">
                    {timeAgo(item.at)}
                  </time>
                </>
              );
              return (
                <li key={item.id} className="border-b border-border/60 py-2 last:border-b-0">
                  {view.href ? (
                    <Link
                      href={view.href}
                      className="flex items-start gap-2 rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {body}
                    </Link>
                  ) : (
                    <span className="flex items-start gap-2">{body}</span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
