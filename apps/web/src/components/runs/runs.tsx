"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyItemView,
  createParents,
  groupItemsByDay,
  itemAt,
  liveRows,
  platformOptions,
  rowsFor,
  runsThisWeek,
  type CreateParentBlock,
  type DayItem,
  type LiveRow,
  type PlanReadStatus,
  type RunFilter,
  type RunRow,
  type RunSort,
} from "@/components/runs/runs-model";
import { PlatMark } from "@/components/approve/plat-mark";
import { fetchRunsFeed } from "@/lib/approve-queue/client";
import { fetchCreateRunsFeed, type CreateRunsFeed } from "@/lib/create/client";
import { fetchPlan } from "@/lib/workspace/client";
import { platformLabel } from "@/lib/workspace/format";
import { useListKeys } from "@/lib/workspace/keyboard";
import type { FeedRun } from "@/lib/approve-queue/types";
import type { PlanPayload } from "@/lib/workspace/types";
import { dayKey } from "@/lib/workspace/week";

type ReadStatus = "loading" | "error" | "success";

/** The W1 sheet's seg — the two live states joined the original three. */
const FILTERS: { key: RunFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "waiting", label: "Waiting" },
  { key: "failed", label: "Failed" },
  { key: "published", label: "Published" },
];

const SORTS: { key: RunSort; label: string }[] = [
  { key: "newest", label: "Newest first" },
  { key: "oldest", label: "Oldest first" },
];

/** The sheet's row stamp — 24h local time inside its day group ("09:00"). */
function timeOfDay(at: Date): string {
  return at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Empty views name WHY they are empty — an unresolved read never reads as
 * "nothing here", and neither does a view the OPERATOR narrowed: a filter or a
 * find box that empties the list must say it was the knob, or the surface
 * reports "no failed runs" when the truth is "none on this platform".
 */
function emptyLine(
  total: number,
  filter: RunFilter,
  planStatus: PlanReadStatus,
  narrowed: boolean,
): string {
  if (total === 0) return "No runs yet — your first generation lands here with full provenance.";
  if (narrowed) return "No runs match this view — clear the platform or the find box to widen it.";
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
  // The W1 re-shape's read: create-run parents + the day's usage total.
  // Best-effort — a failed read degrades the history to flat rows with a
  // stated note, never a blank surface.
  const [createStatus, setCreateStatus] = useState<ReadStatus>("loading");
  const [createFeed, setCreateFeed] = useState<CreateRunsFeed | null>(null);
  const [filter, setFilter] = useState<RunFilter>("all");
  // The view knobs the founder asked to re-introduce. Presentation state only:
  // every derivation below reads them, none of them reaches a client.
  const [platform, setPlatform] = useState<string | null>(null);
  const [find, setFind] = useState("");
  const [sort, setSort] = useState<RunSort>("newest");
  // null = the operator hasn't moved yet, so the deep-linked row (or the
  // newest run) is the selected one — derived, never an effect that writes
  // state back during render.
  //
  // The selection is a RUN, not a position: Try again re-reads the feed
  // while the old rows are still on screen, and a newly-finished run
  // arrives at the top, so an index would slide the selection onto a
  // neighbour and ↵ would open a run the operator never chose. Not in the
  // s77 fan-out — found by the sweep looking for the same class
  // (keyed-by-entity sweep, s78).
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const loadCreateFeed = useCallback(
    () =>
      fetchCreateRunsFeed()
        .then((data) => {
          setCreateFeed(data);
          setCreateStatus("success");
        })
        .catch(() => {
          setCreateStatus("error");
        }),
    [],
  );

  useEffect(() => {
    void loadRuns();
    void loadPlan();
    void loadCreateFeed();
  }, [loadRuns, loadPlan, loadCreateFeed]);

  // Mount-time clock: the day headings and "this week" count stay stable
  // across renders (and injectable-free in tests, like the dashboard's).
  const [now] = useState(() => new Date());
  const rows = useMemo(
    () => rowsFor(runs, plan?.assets ?? [], planStatus),
    [runs, plan, planStatus],
  );
  // The W1 re-shape: create-run parents absorb their family fanout rows;
  // orphans (pre-create history) stay flat — never a fake parent.
  const { blocks, absorbedRunIds } = useMemo(
    () => createParents(createFeed?.runs ?? [], plan?.assets ?? []),
    [createFeed, plan],
  );
  const items = useMemo<DayItem[]>(
    () => [
      ...rows
        .filter((row) => !absorbedRunIds.has(row.id))
        .map((row): DayItem => ({ type: "run", row })),
      ...blocks.map((block): DayItem => ({ type: "create", block })),
    ],
    [rows, blocks, absorbedRunIds],
  );
  const live = useMemo(() => liveRows(rows, createFeed?.runs ?? [], now), [rows, createFeed, now]);
  const days = useMemo(
    () => groupItemsByDay(applyItemView(items, { filter, platform, find, sort }), now, sort),
    [items, filter, platform, find, sort, now],
  );
  const platforms = useMemo(() => platformOptions(rows), [rows]);
  /** The operator narrowed the view themselves — an empty result must say so. */
  const narrowed = platform !== null || find.trim() !== "";
  // Rendered order, flattened — what j/k walks and what ↵ opens.
  const ordered = useMemo(() => days.flatMap((day) => day.items), [days]);
  const failedCount =
    rows.filter((row) => row.failed && !absorbedRunIds.has(row.id)).length +
    blocks.filter((block) => block.failed).length;
  const itemId = (item: DayItem) => (item.type === "run" ? item.row.id : item.block.id);
  const itemHref = (item: DayItem) => (item.type === "run" ? item.row.href : item.block.href);
  // The deep-linked run is selected until the operator moves (keeper: the
  // dashboard-provenance ?run= link lands ON the entity).
  const deepIndex = targetRunId ? ordered.findIndex((item) => itemId(item) === targetRunId) : -1;
  const selectedIndex = selectedId ? ordered.findIndex((item) => itemId(item) === selectedId) : -1;
  const active =
    selectedIndex >= 0
      ? selectedIndex
      : Math.min(deepIndex >= 0 ? deepIndex : 0, Math.max(0, ordered.length - 1));
  const moveTo = (index: number) => {
    const item = ordered[Math.max(0, Math.min(index, ordered.length - 1))];
    if (item) setSelectedId(itemId(item));
  };

  useEffect(() => {
    if (deepIndex >= 0 && selectedId === null) {
      selectedRef.current?.scrollIntoView?.({ block: "center" });
    }
  }, [deepIndex, selectedId]);

  useListKeys({
    enabled: runsStatus === "success" && ordered.length > 0,
    bindings: {
      j: (event) => {
        event.preventDefault();
        moveTo(active + 1);
      },
      k: (event) => {
        event.preventDefault();
        moveTo(active - 1);
      },
      Enter: (event) => {
        // A FOCUSED CONTROL OWNS ITS OWN ENTER. `useListKeys` listens on
        // window and only skips typing targets, so without this the j/k
        // grammar swallowed Enter from every button and link on screen —
        // the surface's own seg could not be operated by keyboard (its
        // onClick never ran: preventDefault here cancels the keydown's
        // activation default), and even the shell's side-nav links navigated
        // to the selected RUN instead. Verified live, s78. `[role=button]`
        // covers this surface's own rows, which are divs carrying their own
        // Enter handler. Same guard, same words, as sites.tsx, intel.tsx,
        // videos.tsx and calendar-surface.tsx — Runs was the outlier (s77
        // finding, runs.tsx:149).
        if ((event.target as HTMLElement | null)?.closest("button, a, [role=button]")) return;
        const href = ordered[active] ? itemHref(ordered[active]) : null;
        if (href) {
          event.preventDefault();
          router.push(href);
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
    if (createStatus === "error") {
      setCreateStatus("loading");
      void loadCreateFeed();
    }
  };

  return (
    <div className="content runs-surface" style={{ gap: 14 }}>
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
        {/* The view knobs (founder s77). They sit LEFT of the seg so the sheet's
            own All/Failed/Published control keeps the rightmost slot it is
            drawn in. Each states its current value at the control, so an
            applied knob is visible and clearable without a banner. */}
        <input
          className="find-input"
          type="search"
          aria-label="Find a run"
          placeholder="Find a run…"
          value={find}
          onChange={(event) => setFind(event.target.value)}
        />
        <div className="btn btn-ghost btn-sm sel-ctl">
          {platform === null ? "All platforms" : platformLabel(platform)}
          <span className="chev" />
          <select
            className="sel-native"
            aria-label="Platform filter"
            value={platform ?? ""}
            onChange={(event) => {
              setPlatform(event.target.value === "" ? null : event.target.value);
              setSelectedId(null);
            }}
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
            onChange={(event) => setSort(event.target.value as RunSort)}
          >
            {SORTS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="seg">
          {FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={filter === option.key ? "seg-opt on" : "seg-opt"}
              aria-pressed={filter === option.key}
              onClick={() => {
                setFilter(option.key);
                setSelectedId(null);
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

      {/* The create-run read failing must not silently flatten the history —
          the grouping is a claim about lineage, so its absence is stated.
          Only beside a history that rendered: when the runs read itself
          failed, its alert owns the moment (one failure, one message). */}
      {createStatus === "error" && runsStatus === "success" && (
        <section className="card" style={{ padding: "11px 16px" }} role="status">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="t-label">
              Create-run grouping couldn’t be read — the history shows flat rows meanwhile.
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

      {/* The RUNNING-NOW band (Cloudflare) — in-flight work spotlighted above
          the history it will join when it finishes. */}
      {runsStatus === "success" && live.length > 0 && (
        <div className="card live-band" aria-label="Running now">
          {live.map((row) => (
            <LiveRowView key={row.id} row={row} />
          ))}
        </div>
      )}

      {runsStatus === "success" && ordered.length === 0 && (
        <div className="card">
          <div className="row">
            <span className="t-label">
              {emptyLine(items.length, filter, planStatus, narrowed)}
            </span>
          </div>
        </div>
      )}

      {days.map((day) => (
        <div key={day.key}>
          <div className="day-hd">{day.heading}</div>
          <div className="card" style={{ marginTop: 14 }}>
            {day.items.map((item) => {
              const position = ordered.indexOf(item);
              return item.type === "run" ? (
                <RunRowView
                  key={item.row.id}
                  row={item.row}
                  selected={position === active}
                  ref={position === active ? selectedRef : undefined}
                  onSelect={() => setSelectedId(item.row.id)}
                  onOpen={() => router.push(item.row.href)}
                />
              ) : (
                <ParentBlockView
                  key={item.block.id}
                  block={item.block}
                  selected={position === active}
                  ref={position === active ? selectedRef : undefined}
                  onSelect={() => setSelectedId(item.block.id)}
                  onOpen={() => item.block.href && router.push(item.block.href)}
                />
              );
            })}
          </div>
        </div>
      ))}

      {/* The footer gained the day's roll-up (Clay, from usage_ledger): the
          COST truth that is actually on the wire — per-run cost has no read
          yet, so the sheet's per-row "$0.09" deliberately isn't drawn. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="t-label">
          Every run keeps its receipts — prompt, sources, judge verdicts, model seats, cost — one
          click deep.
        </span>
        <div style={{ flex: 1 }} />
        {createFeed?.usageToday && (
          <span className="dur">
            {`Today — ${
              ordered.filter((item) => dayKey(itemAt(item)) === dayKey(now) && !(item.type === "run" ? item.row.live : item.block.live)).length
            } finished · `}
            <b style={{ color: "var(--n-1000)" }}>{`$${createFeed.usageToday.costEstimate.toFixed(2)} total`}</b>
            {live.length > 0 ? ` · ${live.length} live` : ""}
          </span>
        )}
      </div>
    </div>
  );
}

/** One running-now row: spinner · lead/state · elapsed · the receipts door when one exists. */
function LiveRowView({ row }: { row: LiveRow }) {
  return (
    <div className="row">
      <span className="work-spin" aria-hidden />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="run-lead">{row.lead}</div>
        {row.sub && <div className="excerpt">{row.sub}</div>}
      </div>
      <span className="dur">{row.elapsed}</span>
      {row.href && (
        <Link className="card-link" href={row.href}>
          Watch →
        </Link>
      )}
    </div>
  );
}

/** A create-run parent with its family nested under it — the sheet's `.child` grammar. */
function ParentBlockView({
  block,
  selected,
  onSelect,
  onOpen,
  ref,
}: {
  block: CreateParentBlock;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  ref?: React.Ref<HTMLDivElement>;
}) {
  return (
    <>
      <div
        ref={ref}
        role={block.href ? "button" : undefined}
        tabIndex={0}
        className={selected ? "row sel" : "row"}
        style={block.href ? { cursor: "pointer" } : undefined}
        aria-label={`${block.lead} — ${block.pill.label}`}
        onClick={block.href ? onOpen : onSelect}
        onFocus={onSelect}
        onKeyDown={(event) => {
          if (event.key === "Enter" && event.target === event.currentTarget && block.href) onOpen();
        }}
      >
        {block.thumb && (
          <div className="thumb-sm">
            <span>{block.thumb}</span>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="run-lead">{block.lead}</div>
          <div className="excerpt" style={block.excerptError ? { color: "var(--err)" } : undefined}>
            {block.excerpt}
          </div>
        </div>
        {block.judgeTotal > 0 && (
          <span className={block.judgePassed === block.judgeTotal ? "jchip" : "jchip wait"}>
            {`judge ✓ ${block.judgePassed} of ${block.judgeTotal}`}
          </span>
        )}
        <span className={`pill pill-${block.pill.tone}`}>{block.pill.label}</span>
        <span className="t-data">
          {block.at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </span>
        {block.href && (
          <Link
            className="card-link"
            href={block.href}
            tabIndex={-1}
            onClick={(event: React.MouseEvent<HTMLAnchorElement>) => event.stopPropagation()}
          >
            Open →
          </Link>
        )}
      </div>
      {block.children.map((child) => (
        <div key={child.draftId} className="row child">
          <PlatMark platform={child.platform} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="run-lead">
              {child.word}
              {child.quote && (
                <>
                  {" · "}
                  <em style={{ color: "var(--n-900)" }}>“{child.quote}”</em>
                </>
              )}
            </div>
          </div>
          {child.judge && (
            <span className={child.judge === "passed" ? "jchip" : "jchip wait"}>
              {child.judge === "passed" ? "✓ passed" : "✗ blocked"}
            </span>
          )}
          <span className={`pill pill-${child.pill.tone}`}>{child.pill.label}</span>
          <Link className="card-link" href={child.href}>
            In Approve →
          </Link>
        </div>
      ))}
    </>
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
        // Only when the ROW itself is focused: the excerpt's live-page anchor
        // is inside this row, and without the target check Enter on that link
        // both opened the page and threw the surface to Approve. (Logged as a
        // medium for s80; it is fixed here because the R1 Enter guard lands in
        // this exact code path and half a fix is worse than none.)
        if (event.key === "Enter" && event.target === event.currentTarget) onOpen();
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
