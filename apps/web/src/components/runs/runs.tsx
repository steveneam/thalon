"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  filterRows,
  groupByDay,
  rowsFor,
  runsThisWeek,
  type PlanReadStatus,
  type RunFilter,
  type RunRow,
} from "@/components/runs/runs-model";
import { fetchRunsFeed } from "@/lib/approve-queue/client";
import { fetchPlan } from "@/lib/workspace/client";
import { useListKeys } from "@/lib/workspace/keyboard";
import type { FeedRun } from "@/lib/approve-queue/types";
import type { PlanPayload } from "@/lib/workspace/types";

type ReadStatus = "loading" | "error" | "success";

const FILTERS: { key: RunFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "failed", label: "Failed" },
  { key: "published", label: "Published" },
];

/** The sheet's row stamp — 24h local time inside its day group ("09:00"). */
function timeOfDay(at: Date): string {
  return at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** Empty views name WHY they are empty — an unresolved read never reads as "nothing here". */
function emptyLine(total: number, filter: RunFilter, planStatus: PlanReadStatus): string {
  if (total === 0) return "No runs yet — your first generation lands here with full provenance.";
  if (filter === "failed") return "No failed runs — nothing needs triage.";
  if (planStatus === "loading") return "Reading what published…";
  return "Nothing published yet — approved work ships from the queue.";
}

/**
 * Runs, rebuilt exactly from Runs.dc.html (DOCTRINE 0 — the sheet is the
 * blueprint): the headline band with the week/failed pills and the
 * All/Failed/Published segmented control, one `.day-hd` + `.card` per day,
 * and the receipts footer. Step 2 wires the EXISTING clients — the
 * `/api/runs` feed plus the plan read for what each run's drafts actually
 * did — and weaves the old surface's keepers back in behind byte-true
 * chrome: lastError renders VERBATIM in the row's error channel (B4.5
 * triage evidence), partial fan-outs wear the Incomplete pill, the `?run=`
 * deep link still lands on its row, and the one list keyboard grammar
 * (j/k move · ↵ open) drives the sheet's own `.row.sel`.
 *
 * Honest states throughout: a failed read is an alert with retry, never an
 * empty shelf; counts read "–" until they resolve; a run the plan window
 * doesn't cover shows what the feed knows instead of invented draft counts.
 */
export function Runs() {
  const router = useRouter();

  const [runsStatus, setRunsStatus] = useState<ReadStatus>("loading");
  const [runs, setRuns] = useState<FeedRun[]>([]);
  const [planStatus, setPlanStatus] = useState<PlanReadStatus>("loading");
  const [plan, setPlan] = useState<PlanPayload | null>(null);
  const [filter, setFilter] = useState<RunFilter>("all");
  // null = the operator hasn't moved yet, so the deep-linked row (or the
  // newest run) is the selected one — derived, never an effect that writes
  // state back during render.
  const [selected, setSelected] = useState<number | null>(null);

  // ?run= deep link (the dashboard-provenance keeper: activity rows and
  // pipeline steps land on the ENTITY). Read from location once at mount,
  // router-free so the surface stays test-mountable.
  const [targetRunId] = useState<string | null>(() =>
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("run") : null,
  );
  const selectedRef = useRef<HTMLDivElement | null>(null);

  const loadRuns = useCallback(
    () =>
      fetchRunsFeed()
        .then((data) => {
          setRuns(data);
          setRunsStatus("success");
        })
        .catch(() => {
          setRunsStatus("error");
        }),
    [],
  );

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
    void loadRuns();
    void loadPlan();
  }, [loadRuns, loadPlan]);

  // Mount-time clock: the day headings and "this week" count stay stable
  // across renders (and injectable-free in tests, like the dashboard's).
  const [now] = useState(() => new Date());
  const rows = useMemo(
    () => rowsFor(runs, plan?.assets ?? [], planStatus),
    [runs, plan, planStatus],
  );
  const days = useMemo(
    () => groupByDay(filterRows(rows, filter), now),
    [rows, filter, now],
  );
  // Rendered order, flattened — what j/k walks and what ↵ opens.
  const ordered = useMemo(() => days.flatMap((day) => day.rows), [days]);
  const failedCount = rows.filter((row) => row.failed).length;
  // The deep-linked run is selected until the operator moves (keeper: the
  // dashboard-provenance ?run= link lands ON the entity).
  const deepIndex = targetRunId ? ordered.findIndex((row) => row.id === targetRunId) : -1;
  const active = Math.min(
    selected ?? (deepIndex >= 0 ? deepIndex : 0),
    Math.max(0, ordered.length - 1),
  );

  useEffect(() => {
    if (deepIndex >= 0 && selected === null) {
      selectedRef.current?.scrollIntoView?.({ block: "center" });
    }
  }, [deepIndex, selected]);

  useListKeys({
    enabled: runsStatus === "success" && ordered.length > 0,
    bindings: {
      j: (event) => {
        event.preventDefault();
        setSelected(Math.min(active + 1, ordered.length - 1));
      },
      k: (event) => {
        event.preventDefault();
        setSelected(Math.max(active - 1, 0));
      },
      Enter: (event) => {
        if (ordered[active]) {
          event.preventDefault();
          router.push(ordered[active].href);
        }
      },
    },
  });

  const retryReads = () => {
    if (runsStatus === "error") {
      setRunsStatus("loading");
      void loadRuns();
    }
    if (planStatus === "error") {
      setPlanStatus("loading");
      void loadPlan();
    }
  };

  return (
    <div className="content" style={{ gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h1 className="t-headline">Runs</h1>
        <span className="pill pill-idle">
          {runsStatus === "success" ? `${runsThisWeek(rows, now)} this week` : "– this week"}
        </span>
        {/* The error channel only ever carries a real failure count. */}
        {runsStatus === "success" && failedCount > 0 && (
          <span className="pill pill-err">{failedCount} failed</span>
        )}
        <div style={{ flex: 1 }} />
        <div className="seg">
          {FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={filter === option.key ? "seg-opt on" : "seg-opt"}
              aria-pressed={filter === option.key}
              onClick={() => {
                setFilter(option.key);
                setSelected(null);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {runsStatus === "error" && (
        <section
          className="card"
          style={{
            padding: "14px 16px",
            borderColor: "color-mix(in oklab, var(--err) 40%, var(--n-400))",
          }}
          role="alert"
        >
          <p className="t-title">Couldn’t read the runs</p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
            <span className="t-label">
              The feed couldn’t be read — this is a read failure, not an empty history.
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={retryReads}>
              Try again
            </button>
          </div>
        </section>
      )}

      {/* The Published view rides the plan read; when that read fails it says
          so instead of showing an empty (and quietly false) list. */}
      {filter === "published" && planStatus === "error" && (
        <section className="card" style={{ padding: "11px 16px" }} role="alert">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="t-label" style={{ color: "var(--err)" }}>
              Publish state couldn’t be read — this filter is unresolved, not empty.
            </span>
            <div style={{ flex: 1 }} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={retryReads}>
              Try again
            </button>
          </div>
        </section>
      )}

      {runsStatus === "loading" && (
        <div className="card">
          <div className="row">
            <span className="t-label">Reading the runs…</span>
          </div>
        </div>
      )}

      {runsStatus === "success" && ordered.length === 0 && (
        <div className="card">
          <div className="row">
            <span className="t-label">{emptyLine(rows.length, filter, planStatus)}</span>
          </div>
        </div>
      )}

      {days.map((day) => (
        <div key={day.key}>
          <div className="day-hd">{day.heading}</div>
          <div className="card" style={{ marginTop: 14 }}>
            {day.rows.map((row) => {
              const position = ordered.indexOf(row);
              return (
                <RunRowView
                  key={row.id}
                  row={row}
                  selected={position === active}
                  ref={position === active ? selectedRef : undefined}
                  onSelect={() => setSelected(position)}
                  onOpen={() => router.push(row.href)}
                />
              );
            })}
          </div>
        </div>
      ))}

      {/* The sheet's footer is ONE label — unlike the Dashboard sheet, this
          one draws no j/k chips, so the keyboard grammar stays invisible
          chrome here rather than growing the band. */}
      <div style={{ display: "flex" }}>
        <span className="t-label">
          Every run keeps its receipts — prompt, sources, judge verdicts, model seats, cost — one
          click deep.
        </span>
      </div>
    </div>
  );
}

/** One feed run in the sheet's row grammar: thumb → lead/excerpt → pill → time → door. */
function RunRowView({
  row,
  selected,
  onSelect,
  onOpen,
  ref,
}: {
  row: RunRow;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  ref?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      className={selected ? "row sel" : "row"}
      style={{ cursor: "pointer" }}
      aria-label={`${row.lead} — ${row.pill.label}`}
      onClick={onOpen}
      onFocus={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen();
      }}
    >
      {row.thumb && (
        <div className="thumb-sm">
          <span>{row.thumb}</span>
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="run-lead">{row.lead}</div>
        <div className="excerpt" style={row.excerptError ? { color: "var(--err)" } : undefined}>
          {row.excerpt}
          {row.liveHref && (
            <>
              {" · "}
              <a
                href={row.liveHref}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
              >
                {row.liveHref} ↗
              </a>
            </>
          )}
        </div>
      </div>
      <span className={`pill pill-${row.pill.tone}`}>{row.pill.label}</span>
      <span className="t-data">{timeOfDay(row.at)}</span>
      {row.retryable ? (
        // The sheet draws Retry on a failed run; replaying a fan-out has no
        // armed door yet, so it rests UNARMED and says why (the dashboard's
        // disabled-Board precedent) rather than pretending to act.
        <span
          className="btn btn-ghost btn-sm"
          aria-disabled
          style={{ cursor: "default" }}
          title="Replaying a fan-out isn’t wired yet — the run kept its receipts; open it to see what survived."
        >
          Retry
        </span>
      ) : (
        <Link
          className="card-link"
          href={row.href}
          tabIndex={-1}
          onClick={(event: React.MouseEvent<HTMLAnchorElement>) => event.stopPropagation()}
        >
          Open →
        </Link>
      )}
    </div>
  );
}
