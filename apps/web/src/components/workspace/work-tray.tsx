"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Popover } from "@astryxdesign/core/Popover";
import { Spinner } from "@astryxdesign/core/Spinner";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import type { FeedRun } from "@/lib/approve-queue/types";

/**
 * The async-work tray (founder round 8, wave-0 kickoff step 3): a neutral
 * "N working" chip with a spinner while any run is in flight, a green
 * completion dot when work finished since the tray was last opened, and a
 * dropdown tray with one honest row per job. Honest by construction:
 * everything renders from the REAL run states the /api/runs feed serves —
 * stage words where a percent would be a lie, the started-time where an
 * ETA would be one. Completion raises the dot, never a modal.
 *
 * Wave 0 ships the chip+tray shell on the fan-out feed; per-pipeline
 * progress (render/mint stages) rides the same rows once those pipelines
 * report stages.
 */

const POLL_MS = 20_000;

/** Honest stage words per lifecycle state (FANOUT_RUN_STATUSES). */
const STAGE_WORDS: Record<string, string> = {
  pending: "queued",
  running: "composing · judging",
  complete: "done",
  failed: "failed",
};

interface TrayJob {
  id: string;
  label: string;
  stage: string;
  href: string;
  working: boolean;
  failed: boolean;
  waiting: number;
  createdAt: string;
}

function jobFromRun(run: FeedRun): TrayJob {
  const platforms = Array.isArray(run.platforms)
    ? run.platforms.filter((p): p is string => typeof p === "string")
    : [];
  const done = run.status === "complete";
  return {
    id: run.id,
    label: platforms.length > 0 ? `Fan-out · ${platforms.join(" · ")}` : "Fan-out",
    stage: STAGE_WORDS[run.status] ?? run.status,
    // Every row is a door: finished work with drafts waiting opens the
    // approve queue (the batch unit); everything else opens run triage.
    href: done && run.waiting > 0 ? "/app/approve" : "/app/runs",
    working: run.status === "pending" || run.status === "running",
    failed: run.status === "failed",
    waiting: run.waiting,
    createdAt: run.createdAt,
  };
}

/** Fetch + parse only — state application stays with the component. */
async function fetchTrayJobs(): Promise<TrayJob[] | null> {
  const res = await fetch("/api/runs");
  if (!res.ok) return null;
  const data = (await res.json()) as { runs: FeedRun[] };
  return data.runs.map(jobFromRun);
}

function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function WorkTray() {
  const [jobs, setJobs] = useState<TrayJob[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unseenDone, setUnseenDone] = useState(0);
  /** Runs this session saw in a working state — the honest "finished while
   * you were here" set; a run that was already complete on first load never
   * raises the dot. */
  const watchedRef = useRef<Set<string>>(new Set());

  const applyJobs = useCallback((next: TrayJob[]) => {
    const watched = watchedRef.current;
    let finished = 0;
    for (const job of next) {
      if (job.working) watched.add(job.id);
      else if (watched.has(job.id)) {
        watched.delete(job.id);
        finished += 1;
      }
    }
    if (finished > 0) setUnseenDone((n) => n + finished);
    setJobs(next);
  }, []);

  useEffect(() => {
    // Promise-chain form so no setState is syntactically inside the effect
    // body (react-hooks/set-state-in-effect — the B1.4 lesson); a failed
    // poll keeps the last honest state and the next tick retries.
    let cancelled = false;
    const poll = () => {
      fetchTrayJobs()
        .then((next) => {
          if (!cancelled && next) applyJobs(next);
        })
        .catch(() => {});
    };
    poll();
    const timer = setInterval(poll, POLL_MS);
    window.addEventListener("focus", poll);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("focus", poll);
    };
  }, [applyJobs]);

  const working = jobs.filter((j) => j.working);
  // The tray lists in-flight work first, then the most recent settled runs
  // so a raised dot always has its finished row visible in the list.
  const settled = jobs.filter((j) => !j.working).slice(0, 5);

  // Quiet chrome when idle: no chip at all until something runs or finishes.
  if (working.length === 0 && unseenDone === 0) return null;

  const chipLabel =
    working.length > 0
      ? `${working.length} working`
      : `${unseenDone} finished`;

  return (
    <Popover
      label="Background work"
      placement="below"
      alignment="end"
      // Astryx 0.1.8 types mark className/style as required picks — empty
      // values satisfy them without styling anything.
      className=""
      style={{}}
      isOpen={isOpen}
      onOpenChange={(open: boolean) => {
        setIsOpen(open);
        if (open) {
          setUnseenDone(0);
          fetchTrayJobs()
            .then((next) => next && applyJobs(next))
            .catch(() => {});
        }
      }}
      content={
        <div className="w-80 p-1" data-testid="work-tray">
          <p className="px-2 pb-1 pt-1.5 text-xs text-muted-foreground">Background work</p>
          <ul className="flex flex-col">
            {[...working, ...settled].map((job) => (
              <li key={job.id}>
                <Link
                  href={job.href}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 rounded-md px-2 py-2 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {job.working ? (
                    <Spinner size="sm" label="In progress" />
                  ) : (
                    <StatusDot
                      variant={job.failed ? "error" : "success"}
                      label={job.failed ? "Failed" : "Done"}
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{job.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {job.stage}
                      {job.working && ` · started ${ago(job.createdAt)}`}
                      {!job.working && job.waiting > 0 && ` · ${job.waiting} waiting review`}
                    </span>
                  </span>
                  {!job.working && (
                    <span aria-hidden className="text-xs text-muted-foreground">
                      View →
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      }
    >
      <button
        type="button"
        aria-label={
          working.length > 0
            ? `${working.length} background jobs working — open the work tray`
            : `${unseenDone} background jobs finished — open the work tray`
        }
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {working.length > 0 ? (
          <Spinner size="sm" label="Work in progress" />
        ) : (
          <StatusDot variant="success" label="Work finished" />
        )}
        {chipLabel}
      </button>
    </Popover>
  );
}
