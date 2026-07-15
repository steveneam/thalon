"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CircleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyArt } from "@/components/ui/empty-art";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorNotice } from "@/components/workspace/error-notice";
import { fetchRunsFeed } from "@/lib/approve-queue/client";
import type { FeedRun } from "@/lib/approve-queue/types";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/workspace/format";

type ListStatus = "loading" | "error" | "success";

/**
 * Runs: history + status + lastError triage (B4.5's operator surface).
 * lastError renders VERBATIM — the recorded message is the triage evidence,
 * cleared automatically when a later pass backfills the run.
 */
export function RunsList() {
  const [status, setStatus] = useState<ListStatus>("loading");
  const [runs, setRuns] = useState<FeedRun[]>([]);

  // ?run= deep link (dashboard v3 provenance: activity rows and pipeline
  // steps land on the ENTITY): highlight + scroll to the named run. Read
  // from location once at mount (lazy state init) like the approve queue's
  // deep link — router-free, test-mountable.
  const [targetRunId] = useState<string | null>(() =>
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("run")
      : null,
  );
  const targetRef = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    if (status === "success" && targetRef.current) {
      targetRef.current.scrollIntoView({ block: "center" });
    }
  }, [status]);

  const load = useCallback(
    () =>
      fetchRunsFeed()
        .then((data) => {
          setRuns(data);
          setStatus("success");
        })
        .catch(() => {
          setStatus("error");
        }),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Run history</CardTitle>
          <CardDescription>
            Every fan-out run, newest first. A run with a recorded failure shows the exact error —
            replaying the fan-out backfills only what&rsquo;s missing and clears it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "loading" && (
            <div className="flex flex-col gap-2" aria-label="Loading runs">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          )}
          {status === "error" && (
            <ErrorNotice
              message="Couldn’t load runs."
              onRetry={() => {
                setStatus("loading");
                void load();
              }}
            />
          )}
          {status === "success" && runs.length === 0 && (
            <div className="flex flex-col items-center gap-1 py-4 text-center">
              <EmptyArt asset="emptyRuns" />
              <p className="text-sm text-muted-foreground">
                No runs yet — your first generation lands here with full provenance.
              </p>
            </div>
          )}
          {status === "success" && runs.length > 0 && (
            <ul className="flex flex-col gap-2">
              {runs.map((run) => (
                <li
                  key={run.id}
                  ref={run.id === targetRunId ? targetRef : undefined}
                  className={cn(
                    "rounded-lg border border-border p-3",
                    run.id === targetRunId && "border-ring/50 bg-muted/40",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Recognition over recall: the run reads as WHAT it did;
                        the id demotes to a mono aside for correlation. */}
                    <span className="text-sm font-medium">
                      {Array.isArray(run.platforms) && run.platforms.length > 0
                        ? `Fan-out to ${(run.platforms as string[]).join(" · ")}`
                        : "Fan-out run"}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {run.id.slice(0, 8)}
                    </span>
                    <Badge variant="outline">{run.status}</Badge>
                    {!run.draftsComplete && (
                      <Badge
                        variant="destructive"
                        title="Fewer drafts than requested platforms — an aborted or partial fan-out."
                      >
                        incomplete
                      </Badge>
                    )}
                    <time dateTime={run.createdAt} className="ml-auto text-xs text-muted-foreground">
                      {timeAgo(run.createdAt)}
                    </time>
                    <Link
                      href={`/app/approve?run=${encodeURIComponent(run.id)}`}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      open queue <ArrowRight aria-hidden className="size-3" />
                    </Link>
                  </div>
                  {run.lastError && (
                    <p
                      role="alert"
                      className="mt-2 flex items-start gap-1.5 rounded-md bg-destructive/10 px-2.5 py-1.5 font-mono text-xs text-destructive"
                    >
                      <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                      {run.lastError}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
