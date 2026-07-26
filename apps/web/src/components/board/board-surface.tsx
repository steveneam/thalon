"use client";

import "@/components/board/board.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  boardColumns,
  boardPlatformOptions,
  type BoardCard,
  type BoardColumn,
  type BoardSort,
} from "@/components/board/board-model";
import { heatBand } from "@/components/intel/heat-grade";
import { usePulseSafe } from "@/components/workspace/pulse-context";
import { fetchTrends } from "@/lib/intel/client";
import type { TrendCard } from "@/lib/intel/types";
import { fetchPlan } from "@/lib/workspace/client";
import { platformLabel } from "@/lib/workspace/format";
import type { PlanPayload } from "@/lib/workspace/types";

type ReadState = "loading" | "error" | "success";

const HEAT_WORD: Record<ReturnType<typeof heatBand>, string> = {
  hot: "Hot",
  rising: "Rising",
  warm: "Warm",
  cool: "Cool",
};

/** The founder's named knob. "Oldest first" IS today's board — see BoardSort. */
const SORTS: { key: BoardSort; label: string }[] = [
  { key: "oldest", label: "Oldest first" },
  { key: "newest", label: "Newest first" },
];

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
  // The view knobs the founder asked to re-introduce, board-wide rather than
  // per-column: one platform, one order, applied to every column that HAS one.
  const [platform, setPlatform] = useState<string | null>(null);
  const [sort, setSort] = useState<BoardSort>("oldest");

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

  /*
   * ONE NUMBER FOR ONE FACT. The shell topbar and the rail badge both render
   * `needsYou` from the pulse (queued + blocked over a 50-run window); this
   * column counted the plan read's assets instead (a 20-run window, 40-asset
   * cap), so the same screen said "Needs you · 25" and "Waiting on you 21" and
   * explained neither. The column now reports the pulse's total — the same
   * number as the two controls beside it — and the bounded-list note below says
   * how many of them are on screen (s77 finding, board-model.ts:46).
   *
   * Two guards keep it honest: with a platform filter applied the pulse's
   * unfiltered total would be the wrong fact, so the column falls back to its
   * own count; and the total can never read BELOW the cards actually rendered.
   */
  const pulse = usePulseSafe();
  const needsYou =
    platform === null && pulse?.status === "success" ? (pulse.pulse?.needsYou ?? null) : null;
  const columns = boardColumns({
    assets: plan?.assets ?? [],
    slots: plan?.plannedSlots ?? [],
    trends,
    now: now ?? new Date(0),
    platform,
    sort,
  }).map((column) =>
    column.id === "waiting" && needsYou !== null
      ? { ...column, count: Math.max(needsYou, column.count) }
      : column,
  );
  const platforms = boardPlatformOptions(plan?.assets ?? [], plan?.plannedSlots ?? []);

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
        {/* The view knobs (founder s77), in Approve's own `.sel-ctl` grammar.
            Each states its current value AT the control, so an applied filter
            is visible and clearable without a banner. */}
        <div className="btn btn-ghost btn-sm sel-ctl">
          {platform === null ? "All platforms" : platformLabel(platform)}
          <span className="chev" />
          <select
            className="sel-native"
            aria-label="Platform filter"
            value={platform ?? ""}
            onChange={(event) => setPlatform(event.target.value === "" ? null : event.target.value)}
          >
            <option value="">All platforms</option>
            {platforms.map((key) => (
              <option key={key} value={key}>
                {platformLabel(key)}
              </option>
            ))}
          </select>
        </div>
        <div className="btn btn-ghost btn-sm sel-ctl">
          {SORTS.find((option) => option.key === sort)?.label ?? ""}
          <span className="chev" />
          <select
            className="sel-native"
            aria-label="Sort order"
            value={sort}
            onChange={(event) => setSort(event.target.value as BoardSort)}
          >
            {SORTS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
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
            narrowedBy={platform === null ? null : platformLabel(platform)}
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
  narrowedBy,
  onRetry,
}: {
  column: BoardColumn;
  status: ReadState;
  /** The platform label the board is filtered to, so an emptied column says which knob did it. */
  narrowedBy: string | null;
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
          <span className="col-note">
            {/* "Nothing composing" and "nothing composing ON LINKEDIN" are
                different facts — a filtered-empty column must not claim the
                first one. */}
            {narrowedBy !== null && !column.unfiltered
              ? `Nothing here on ${narrowedBy} — clear the platform filter to see the rest.`
              : column.empty}
          </span>
        )}
        {status === "success" && column.unfiltered && (
          <span className="col-note">
            not narrowed — a sweep card has no platform until it’s promoted
          </span>
        )}
        {status === "success" && column.cards.map((card) => <Card key={card.id} card={card} />)}
        {status === "success" && column.count > column.cards.length && (
          // N-OF-M, WITH A DOOR. This said "column scrolls — all N counted
          // above", which explained the gap away: the column does scroll, but
          // only over the cards that exist, and the rest are not in the DOM at
          // all. The repo's own precedent is the week card's "+N more" /
          // "not shown, not lost" — state what is on screen, then point at the
          // place that holds the whole set (s77 finding, board-surface.tsx:183).
          <span className="col-note">
            {column.cards.length} of {column.count} shown —{" "}
            <Link href="/app/approve">open the queue for the rest →</Link>
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
