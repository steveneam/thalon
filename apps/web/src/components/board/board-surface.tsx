"use client";

import "@/components/board/board.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { boardColumns, type BoardCard, type BoardColumn } from "@/components/board/board-model";
import { heatBand } from "@/components/intel/heat-grade";
import { fetchTrends } from "@/lib/intel/client";
import type { TrendCard } from "@/lib/intel/types";
import { fetchPlan } from "@/lib/workspace/client";
import type { PlanPayload } from "@/lib/workspace/types";

type ReadState = "loading" | "error" | "success";

const HEAT_WORD: Record<ReturnType<typeof heatBand>, string> = {
  hot: "Hot",
  rising: "Rising",
  warm: "Warm",
  cool: "Cool",
};

/**
 * Pipeline board — STEP 2 of the two-step rebuild: the byte-true port of
 * Board.dc.html with the real pipeline behind it. The sheet owns every band,
 * class and copy grammar; this layer only decides what is TRUE to put in them:
 *
 *  - each column is a real lifecycle slice of the plan read (composing · at
 *    the judge · waiting on you · approved) plus the two ends the engine owns
 *    (the sweep's rising cards, the tenant's planned slots), so a draft sits
 *    in exactly one column and that column is the state actually recorded;
 *  - a card's title is the draft's own EXCERPT wherever it has one, and a
 *    blocked card leads with the judge's reason, in the error channel;
 *  - the two reads are independent: intel failing does not blank the
 *    pipeline, and each says so where it happened;
 *  - counts are TOTALS — a long column scrolls inside itself, and the header
 *    count never shrinks to what happens to fit (the Bounded-List Rule).
 *
 * The sheet draws this as HOME's second tab, so it lives at /app/board and
 * the Dashboard's Board option is its door.
 */
export function BoardSurface() {
  const router = useRouter();
  const [status, setStatus] = useState<ReadState>("loading");
  const [plan, setPlan] = useState<PlanPayload | null>(null);
  const [trendStatus, setTrendStatus] = useState<ReadState>("loading");
  const [trends, setTrends] = useState<TrendCard[]>([]);
  const [now, setNow] = useState<Date | null>(null);

  const loadPlan = useCallback(
    () =>
      fetchPlan()
        .then((payload) => {
          setPlan(payload);
          setNow(new Date());
          setStatus("success");
        })
        .catch(() => {
          // A read failure is never an empty pipeline — it says so, with retry.
          setNow((current) => current ?? new Date());
          setStatus("error");
        }),
    [],
  );

  const loadTrends = useCallback(
    () =>
      fetchTrends()
        .then((payload) => {
          setTrends(payload.cards);
          setTrendStatus("success");
        })
        .catch(() => setTrendStatus("error")),
    [],
  );

  useEffect(() => {
    void loadPlan();
    void loadTrends();
  }, [loadPlan, loadTrends]);

  const columns = boardColumns({
    assets: plan?.assets ?? [],
    slots: plan?.plannedSlots ?? [],
    trends,
    now: now ?? new Date(0),
  });

  return (
    <div className="content board-surface" style={{ gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 className="t-headline">Today</h1>
        <div className="seg">
          {/* A button, not a Link: `.screen a` paints anchors accent-blue and
              workspace.css is the shell contract (the week card's control sets
              the same precedent). */}
          <button type="button" className="seg-opt" onClick={() => router.push("/app")}>
            Overview
          </button>
          <span className="seg-opt on">Board</span>
        </div>
        <div style={{ flex: 1 }} />
        <span className="t-label">the pipeline as columns — cards move when the work moves</span>
      </div>

      {status === "error" && (
        <div
          className="card read-error"
          role="alert"
          style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px" }}
        >
          <span className="t-label">
            Couldn’t read the pipeline — this is a read failure, not an empty board.
          </span>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setStatus("loading");
              void loadPlan();
            }}
          >
            Try again
          </button>
        </div>
      )}

      <div className="cols">
        {columns.map((column) => (
          <Column
            key={column.id}
            column={column}
            status={column.id === "intel" ? trendStatus : status}
            onRetry={
              column.id === "intel"
                ? () => {
                    setTrendStatus("loading");
                    void loadTrends();
                  }
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}

function Column({
  column,
  status,
  onRetry,
}: {
  column: BoardColumn;
  status: ReadState;
  onRetry?: () => void;
}) {
  return (
    <div className={column.signal ? "col col-signal" : "col"}>
      <div className="col-hd">
        {column.label}
        <span className={column.signal ? "col-ct col-ct-signal" : "col-ct"}>
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
        {status === "success" && column.cards.length === 0 && (
          <span className="col-note">{column.empty}</span>
        )}
        {status === "success" && column.cards.map((card) => <Card key={card.id} card={card} />)}
        {status === "success" && column.count > column.cards.length && (
          <span className="col-note">
            column scrolls — all {column.count} counted above
          </span>
        )}
      </div>
    </div>
  );
}

function Card({ card }: { card: BoardCard }) {
  const band = card.score === undefined ? null : heatBand(card.score);
  return (
    <Link className="k-card" href={card.href}>
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
      <div className={card.error ? "k-title k-title-err" : "k-title"}>{card.title}</div>
      <div className="k-meta">
        {band && (
          <span className={`pill pill-heat-${band}`} style={{ height: 17, fontSize: 10 }}>
            {HEAT_WORD[band]}
          </span>
        )}
        <span>{card.meta}</span>
      </div>
    </Link>
  );
}
