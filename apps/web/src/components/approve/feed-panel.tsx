"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FeedRun } from "@/lib/approve-queue/types";

export type FeedStatus = "loading" | "error" | "success";

interface FeedPanelProps {
  status: FeedStatus;
  runs: FeedRun[];
  selectedRunId: string | null;
  onSelect: (runId: string) => void;
}

/** Zone 1: fan-out runs, newest first. */
export function FeedPanel({ status, runs, selectedRunId, onSelect }: FeedPanelProps) {
  return (
    <section
      aria-label="Fan-out run feed"
      className="flex w-full flex-col gap-2 border-b border-border p-3 md:w-64 md:border-b-0 md:border-r"
    >
      <h2 className="text-sm font-semibold text-foreground">Runs</h2>
      {status === "loading" && <p className="text-sm text-muted-foreground">Loading runs…</p>}
      {status === "error" && <p className="text-sm text-destructive">Couldn&rsquo;t load runs.</p>}
      {status === "success" && runs.length === 0 && (
        <p className="text-sm text-muted-foreground">No fan-out runs yet.</p>
      )}
      {status === "success" && runs.length > 0 && (
        <ul className="flex flex-col gap-1">
          {runs.map((run) => (
            <li key={run.id}>
              <button
                type="button"
                aria-label={`Select run ${run.id}`}
                aria-pressed={run.id === selectedRunId}
                onClick={() => onSelect(run.id)}
                className={cn(
                  "w-full rounded-lg border border-transparent px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  run.id === selectedRunId && "border-border bg-muted",
                )}
              >
                <span className="flex items-center gap-1.5">
                  <span className="min-w-0 truncate font-medium">{run.id.slice(0, 8)}</span>
                  {/* WHICH runs hold the waiting work (critique P1, s39) — the signal channel, word carried. */}
                  {run.waiting > 0 && <Badge variant="signal">{run.waiting} wait</Badge>}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {new Date(run.createdAt).toLocaleString()}
                  <Badge variant="outline">{run.status}</Badge>
                  {!run.draftsComplete && (
                    <Badge variant="destructive" title="This run has fewer drafts than the platforms it requested — an aborted or partial fan-out.">
                      Incomplete
                    </Badge>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
