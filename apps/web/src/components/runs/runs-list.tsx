"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CircleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchRunsFeed } from "@/lib/approve-queue/client";
import type { FeedRun } from "@/lib/approve-queue/types";
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

  useEffect(() => {
    let cancelled = false;
    fetchRunsFeed()
      .then((data) => {
        if (cancelled) return;
        setRuns(data);
        setStatus("success");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
          {status === "loading" && <p className="text-sm text-muted-foreground">Loading runs…</p>}
          {status === "error" && <p className="text-sm text-destructive">Couldn&rsquo;t load runs.</p>}
          {status === "success" && runs.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No runs yet — your first generation lands here with full provenance.
            </p>
          )}
          {status === "success" && runs.length > 0 && (
            <ul className="flex flex-col gap-2">
              {runs.map((run) => (
                <li key={run.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs">{run.id.slice(0, 8)}</span>
                    <Badge variant="outline">{run.status}</Badge>
                    {!run.draftsComplete && (
                      <Badge
                        variant="destructive"
                        title="Fewer drafts than requested platforms — an aborted or partial fan-out."
                      >
                        incomplete
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {Array.isArray(run.platforms) ? (run.platforms as string[]).join(" · ") : ""}
                    </span>
                    <time dateTime={run.createdAt} className="ml-auto text-xs text-muted-foreground">
                      {timeAgo(run.createdAt)}
                    </time>
                    <Link
                      href="/app/approve"
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
