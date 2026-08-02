"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  boardColumns,
  footText,
  type BoardCard,
  type BoardColumn,
} from "@/components/dashboard/board-view-model";
import { heatBand } from "@/components/intel/heat-grade";
import { rowsFor, type PlanReadStatus, type RunRow } from "@/components/runs/runs-model";
import { usePulseSafe } from "@/components/workspace/pulse-context";
import { fetchRunsFeed } from "@/lib/approve-queue/client";
import type { FeedRun } from "@/lib/approve-queue/types";
import { fetchCreateRunsFeed, type CreateRunWire } from "@/lib/create/client";
import { fetchIntelPicks } from "@/lib/intel/client";
import type { IntelPickWire } from "@/lib/intel/types";
import type { PlanPayload } from "@/lib/workspace/types";

type ReadState = "loading" | "error" | "success";

const HEAT_WORD: Record<ReturnType<typeof heatBand>, string> = {
  hot: "Hot",
  rising: "Rising",
  warm: "Warm",
  cool: "Cool",
};

/**
 * The Dashboard's BOARD state — the s91 pipeline-board redraw of
 * Board.dc.html, wired in place of the retired /app/board route (spec §5.9:
 * the kanban lens is a VIEW of the same spine, Jira's Summary/Board tabs the
 * drawn precedent). The sheet owns every band, class and copy grammar; this
 * layer decides what is TRUE to put in them:
 *
 *  - the plan read arrives from the Dashboard (one read serves both states);
 *    the board's own three reads (picks, the runs feed, create runs) load
 *    when the state first mounts, and each failure says so where it happened
 *    — intel failing never blanks the pipeline;
 *  - counts are TOTALS — a long column scrolls inside itself (Bounded-List
 *    Rule), and In Approve reports the pulse's needs-you number, never a
 *    smaller count of the same fact on one screen;
 *  - the feet are the day's recorded stage crossings, "–" where no read
 *    carries the instant (board-view-model.ts states the math).
 */
export function BoardView({
  plan,
  planStatus,
  onRetryPlan,
  now,
}: {
  plan: PlanPayload | null;
  planStatus: PlanReadStatus;
  onRetryPlan: () => void;
  now: Date;
}) {
  const [picksStatus, setPicksStatus] = useState<ReadState>("loading");
  const [picks, setPicks] = useState<IntelPickWire[] | null>(null);
  const [runsStatus, setRunsStatus] = useState<ReadState>("loading");
  const [createStatus, setCreateStatus] = useState<ReadState>("loading");
  const [createRuns, setCreateRuns] = useState<CreateRunWire[] | null>(null);
  const [feed, setFeed] = useState<FeedRun[] | null>(null);

  const loadPicks = useCallback(
    () =>
      fetchIntelPicks()
        .then((rows) => {
          setPicks(rows);
          setPicksStatus("success");
        })
        .catch(() => setPicksStatus("error")),
    [],
  );
  const loadRuns = useCallback(
    () =>
      fetchRunsFeed()
        .then((rows) => {
          setFeed(rows);
          setRunsStatus("success");
        })
        .catch(() => setRunsStatus("error")),
    [],
  );
  const loadCreateRuns = useCallback(
    () =>
      fetchCreateRunsFeed()
        .then((payload) => {
          setCreateRuns(payload.runs);
          setCreateStatus("success");
        })
        .catch(() => setCreateStatus("error")),
    [],
  );

  useEffect(() => {
    void loadPicks();
    void loadRuns();
    void loadCreateRuns();
  }, [loadPicks, loadRuns, loadCreateRuns]);

  // RunRow derivation needs the plan's assets (the run's drafts); a pure pass
  // per render, honest at "loading"/"error" — runRow degrades to what the
  // feed itself knows.
  const runs: RunRow[] | null =
    feed !== null ? rowsFor(feed, plan?.assets ?? [], planStatus) : null;

  /*
   * ONE NUMBER FOR ONE FACT (s77 finding, carried from the route era): the
   * shell topbar renders `needsYou` from the pulse; the In Approve column
   * reports the same total, and can never read BELOW the cards it renders.
   */
  const pulse = usePulseSafe();
  const needsYou = pulse?.status === "success" ? (pulse.pulse?.needsYou ?? null) : null;

  const columns = boardColumns({
    picks: picksStatus === "success" ? picks : null,
    runs: runsStatus === "success" ? runs : null,
    createRuns: createStatus === "success" ? createRuns : null,
    assets: planStatus === "success" ? (plan?.assets ?? []) : null,
    slots: planStatus === "success" ? (plan?.plannedSlots ?? []) : null,
    now,
  }).map((column) =>
    column.id === "approve" && needsYou !== null
      ? { ...column, count: Math.max(needsYou, column.count) }
      : column,
  );

  const statusFor = (column: BoardColumn): ReadState => {
    if (column.id === "picks") return picksStatus;
    if (column.id === "generating") {
      // Three reads feed this column; it renders what answered and the note
      // below names what didn't — a partial answer is recorded partially.
      const all = [runsStatus, createStatus, planStatus];
      if (all.every((s) => s === "error")) return "error";
      if (all.some((s) => s === "success")) return "success";
      return all.some((s) => s === "error") ? "error" : "loading";
    }
    return planStatus;
  };

  const retryFor = (column: BoardColumn): (() => void) | undefined => {
    if (column.id === "picks")
      return () => {
        setPicksStatus("loading");
        void loadPicks();
      };
    if (column.id === "generating")
      return () => {
        if (runsStatus === "error") {
          setRunsStatus("loading");
          void loadRuns();
        }
        if (createStatus === "error") {
          setCreateStatus("loading");
          void loadCreateRuns();
        }
        if (planStatus === "error") onRetryPlan();
      };
    return onRetryPlan;
  };

  return (
    <>
      {planStatus === "error" && (
        <div
          className="card read-error"
          role="alert"
          style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px" }}
        >
          <span className="t-label">
            Couldn’t read the pipeline — this is a read failure, not an empty board.
          </span>
          <div style={{ flex: 1 }} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={onRetryPlan}>
            Try again
          </button>
        </div>
      )}
      <div className="cols">
        {columns.map((column) => (
          <Column
            key={column.id}
            column={column}
            status={statusFor(column)}
            partialNote={
              column.id === "generating" &&
              statusFor(column) === "success" &&
              (runsStatus === "error" || createStatus === "error")
                ? "couldn’t read the runs feed — showing what answered"
                : null
            }
            onRetry={retryFor(column)}
          />
        ))}
      </div>
    </>
  );
}

function Column({
  column,
  status,
  partialNote,
  onRetry,
}: {
  column: BoardColumn;
  status: ReadState;
  /** One of this column's reads failed while another answered — named, not hidden. */
  partialNote: string | null;
  onRetry?: () => void;
}) {
  return (
    <div className={column.warn ? "col col-warn" : "col"}>
      <div className="col-hd">
        {column.label}
        <span className={column.warn ? "col-ct col-ct-warn" : "col-ct"}>
          {status === "success" ? column.count : "–"}
        </span>
      </div>
      <div className="col-bd">
        {status === "loading" && <span className="col-note">reading…</span>}
        {status === "error" && (
          <span className="col-note col-note-err" role="alert">
            couldn’t read this column.{" "}
            {onRetry && (
              <button type="button" className="bare col-retry" onClick={onRetry}>
                try again
              </button>
            )}
          </span>
        )}
        {status === "success" && partialNote !== null && (
          <span className="col-note col-note-err" role="alert">
            {partialNote}.{" "}
            {onRetry && (
              <button type="button" className="bare col-retry" onClick={onRetry}>
                try again
              </button>
            )}
          </span>
        )}
        {status === "success" && column.cards.length === 0 && (
          <span className="col-note">{column.empty}</span>
        )}
        {status === "success" && column.cards.map((card) => <Card key={card.id} card={card} />)}
        {status === "success" && column.count > column.cards.length && (
          // N-of-M, with a door — the week card's "not shown, not lost" grammar.
          <span className="col-note">
            {column.cards.length} of {column.count} shown —{" "}
            <Link href="/app/approve">open the queue for the rest →</Link>
          </span>
        )}
      </div>
      <div className="col-ft">
        <span>today</span>
        <span className="t-data">{status === "success" ? footText(column.foot) : "–"}</span>
      </div>
    </div>
  );
}

function Card({ card }: { card: BoardCard }) {
  const band = card.score === undefined ? null : heatBand(card.score);
  const body = (
    <>
      {card.thumbUrl ? (
        <div className="k-thumb k-thumb-live">
          {/* eslint-disable-next-line @next/next/no-img-element -- a third-party
              source thumbnail: no loader owns these hosts (the Source-Link Rule). */}
          <img src={card.thumbUrl} alt="" loading="lazy" />
        </div>
      ) : (
        card.thumb && (
          <div className="k-thumb">
            <span>{card.thumb}</span>
          </div>
        )
      )}
      <div className={card.titleError ? "k-title k-title-err" : "k-title"}>{card.title}</div>
      {card.reason && <div className="k-reason">{card.reason}</div>}
      <div className="k-meta">
        {card.pill && <span className={`pill pill-${card.pill.tone}`}>{card.pill.label}</span>}
        {band && <span className={`pill pill-heat-${band}`}>{HEAT_WORD[band]}</span>}
        {card.meta.map((span, index) => (
          <span key={index} className={span.data ? "t-data" : undefined}>
            {span.text}
          </span>
        ))}
      </div>
    </>
  );
  // A create run has no detail surface yet — the card renders doorless rather
  // than as a dead link (the Runs surface's own no-dead-Watch rule).
  if (card.href === null) return <div className="k-card k-card-still">{body}</div>;
  return (
    <Link className="k-card" href={card.href}>
      {body}
    </Link>
  );
}
