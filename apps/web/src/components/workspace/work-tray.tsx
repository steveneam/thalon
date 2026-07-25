"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FeedRun } from "@/lib/approve-queue/types";

/**
 * The async-work tray, rebuilt exactly from the Dashboard sheet (DOCTRINE
 * 0): the `.work-chip` "N working" pill with the completion `.notif-dot`,
 * and the `.tray` dropdown with one honest row per job. Honest by
 * construction: everything renders from the REAL run states the /api/runs
 * feed serves — stage words where a percent would be a lie, the
 * started-time where an ETA would be one. Completion raises the dot, never
 * a modal. Quiet chrome when idle: no chip at all until something runs or
 * finishes (the sheet draws the active state).
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
  const rootRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!isOpen) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [isOpen]);

  const working = jobs.filter((j) => j.working);
  // The tray lists in-flight work first, then the most recent settled runs
  // so a raised dot always has its finished row visible in the list.
  const settled = jobs.filter((j) => !j.working).slice(0, 5);

  // Quiet chrome when idle: no chip at all until something runs or finishes.
  if (working.length === 0 && unseenDone === 0) return null;

  const chipLabel = working.length > 0 ? `${working.length} working` : `${unseenDone} finished`;

  return (
    <div ref={rootRef} style={{ display: "contents" }}>
      <button
        type="button"
        className="work-chip"
        aria-expanded={isOpen}
        aria-label={
          working.length > 0
            ? `${working.length} background jobs working — open the work tray`
            : `${unseenDone} background jobs finished — open the work tray`
        }
        onClick={() => {
          const opening = !isOpen;
          setIsOpen(opening);
          if (opening) {
            setUnseenDone(0);
            fetchTrayJobs()
              .then((next) => next && applyJobs(next))
              .catch(() => {});
          }
        }}
      >
        {working.length > 0 ? (
          <span className="work-spin" />
        ) : (
          <span style={{ color: "var(--ok)", fontWeight: 600 }}>✓</span>
        )}
        {chipLabel}
        {unseenDone > 0 && !isOpen && <span className="notif-dot" />}
      </button>
      {isOpen && (
        <div className="tray" data-testid="work-tray" role="region" aria-label="Background work">
          <div className="tray-row">
            <span className="t-title" style={{ fontSize: 13 }}>
              Working
            </span>
            <div style={{ flex: 1 }} />
            <span className="t-label">the engine keeps going — you get pinged here</span>
          </div>
          {[...working, ...settled].map((job) => (
            <div key={job.id} className="tray-row">
              {job.working ? (
                <span className="work-spin" />
              ) : (
                <span
                  style={{ color: job.failed ? "var(--err)" : "var(--ok)", fontWeight: 600 }}
                  aria-label={job.failed ? "Failed" : "Done"}
                >
                  {job.failed ? "✕" : "✓"}
                </span>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500 }}>
                  {job.label}
                  {!job.working && ` — ${job.stage}`}
                </div>
                <div className="excerpt">
                  {job.working && `${job.stage} · started ${ago(job.createdAt)}`}
                  {!job.working &&
                    (job.waiting > 0 ? `${job.waiting} waiting review` : ago(job.createdAt))}
                </div>
              </div>
              {job.working ? (
                <span className="t-data">{ago(job.createdAt)}</span>
              ) : (
                <Link className="card-link" href={job.href} onClick={() => setIsOpen(false)}>
                  View →
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
