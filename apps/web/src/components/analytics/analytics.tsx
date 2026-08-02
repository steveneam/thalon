"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchPlan, fetchPulse } from "@/lib/workspace/client";
import { platformLabel } from "@/lib/workspace/format";
import type { PlanPayload, WorkspacePulse } from "@/lib/workspace/types";
import {
  applyPostView,
  chartView,
  endLine,
  fmtAsOf,
  fmtCount,
  fmtDay,
  measureTile,
  newestAsOf,
  platformOptions,
  postViews,
  publishedTile,
  sparkPaths,
  steeringTile,
  type PostSort,
  type PostView,
  type TileView,
} from "@/components/analytics/analytics-model";
import { fetchAnalytics, type AnalyticsModelWire } from "@/components/analytics/client";
import { AnalyticsPlatMark } from "@/components/analytics/plat-mark";

type ReadStatus = "loading" | "error" | "success";

const WINDOWS = [7, 28, 90];

/** The chart's fixed canvas (the sheet's viewBox) with a shared y-scale — two lines on different scales would lie about their comparison. */
function chartPaths(series: number[], max: number): { line: string; fill: string } {
  const n = series.length;
  const y = (v: number): number =>
    max === 0 ? 94 : Math.round((6 + (1 - v / max) * 88) * 10) / 10;
  const points = series.map((v, i) => `${Math.round((i / (n - 1)) * 3200) / 10},${y(v)}`);
  const line = `M${points.join(" L")}`;
  return { line, fill: `${line} L320,94 L0,94 Z` };
}

/** The account initials the sheet's `.pav` wears ("DS") — from the tenant's own name, never invented. */
function initials(name: string | undefined): string {
  if (name === undefined) return "–";
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
  return letters === "" ? "–" : letters;
}

const LINK_BUTTON: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  font: "inherit",
  color: "var(--act)",
};

/**
 * Analytics, rebuilt exactly from Analytics.dc.html (DOCTRINE 0 — the sheet
 * is the blueprint): the headline band with the Table/Cards seg and window
 * pickers, the filter-chip band with the surface-wide as-of, four fact
 * tiles, the per-post table with the POST rendered in its cell, and the
 * right column (the reach/engagement trend, the reserved engagement-by-hour
 * box, the feed-back loop card).
 *
 * The honesty rules won every conflict with "more visual", exactly as the
 * sheet's header says they must:
 *   · a platform with no metrics API says so IN WORDS — never a 0 that
 *     reads real ("partner-gated", "no impressions in the API", "deferred");
 *   · the trend chart is drawn ONLY over platforms that report reach, and
 *     SAYS SO on the card;
 *   · a row with no series gets NO sparkline — an empty cell, never a flat
 *     line at zero;
 *   · every number carries its as-of, with the platform's own field name as
 *     provenance (post_total_media_view_unique, …);
 *   · dev reality — an empty publication_metrics — renders as honest empty
 *     states, because that is TRUE, not a bug.
 */
export function Analytics() {
  const [windowDays, setWindowDays] = useState(28);
  const [modelStatus, setModelStatus] = useState<ReadStatus>("loading");
  const [model, setModel] = useState<AnalyticsModelWire | null>(null);
  const [planStatus, setPlanStatus] = useState<ReadStatus>("loading");
  const [plan, setPlan] = useState<PlanPayload | null>(null);
  // Best-effort chrome facts (tenant initials, profile version) — a failed
  // pulse degrades the avatar/lead to neutral, never blocks the surface.
  const [pulse, setPulse] = useState<WorkspacePulse | null>(null);
  // The view knobs — presentation state only; none of them reaches a client.
  const [platform, setPlatform] = useState<string | null>(null);
  const [sort, setSort] = useState<PostSort>("engagement");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  // Values-at-a-point on the trend chart (the sheet's drawn crosshair state).
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [hourWhat, setHourWhat] = useState(false);

  // No synchronous status write here: the initial state is "loading", and the
  // knobs/retry handlers reset it themselves before this refetches
  // (react-hooks/set-state-in-effect — effects fetch, handlers narrate).
  const loadModel = useCallback(
    () =>
      fetchAnalytics(windowDays)
        .then((data) => {
          setModel(data);
          setModelStatus("success");
        })
        .catch(() => {
          setModelStatus("error");
        }),
    [windowDays],
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
    void loadModel();
  }, [loadModel]);

  useEffect(() => {
    void loadPlan();
    fetchPulse()
      .then(setPulse)
      .catch(() => {});
  }, [loadPlan]);

  const posts = useMemo<PostView[]>(
    () => (model ? postViews(model, plan?.assets ?? []) : []),
    [model, plan],
  );
  const rows = useMemo(
    () => applyPostView(posts, { platform, sort, dir }),
    [posts, platform, sort, dir],
  );
  const platforms = useMemo(() => (model ? platformOptions(model) : []), [model]);
  const chart = useMemo(() => (model ? chartView(model) : null), [model]);
  const tiles = useMemo<TileView[] | null>(
    () =>
      model
        ? [publishedTile(model), measureTile(model, "audience"), measureTile(model, "engagement"), steeringTile(model)]
        : null,
    [model],
  );
  const asOf = useMemo(() => (model ? newestAsOf(model) : null), [model]);
  const narrowed = platform !== null;
  const pav = initials(pulse?.tenant?.name);

  const sortBy = (column: PostSort): void => {
    if (sort === column) setDir(dir === "desc" ? "asc" : "desc");
    else {
      setSort(column);
      setDir("desc");
    }
  };
  const arrow = (column: PostSort): string => (sort === column ? (dir === "desc" ? " ▼" : " ▲") : "");

  const chartDays = chart?.reach?.values ?? chart?.engagement?.values ?? null;
  const hoverReadout = (() => {
    if (!model || !chartDays || hoverIdx === null) return null;
    const from = new Date(model.window.from).getTime();
    const to = new Date(model.window.to).getTime();
    const at = new Date(from + ((to - from) / chartDays.length) * (hoverIdx + 1));
    const bits = [fmtDay(at)];
    if (chart?.reach) bits.push(`reach ${fmtCount(chart.reach.values[hoverIdx])}`);
    if (chart?.engagement) bits.push(`engagement ${fmtCount(chart.engagement.values[hoverIdx])}`);
    return bits.join(" · ");
  })();

  return (
    <div className="content analytics-surface" style={{ gap: 11 }}>
      {/* ── the headline band ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 className="t-headline">Analytics</h1>
        <span className="t-label">what YOUR posts did. Intel measures the market; this measures us</span>
        <div style={{ flex: 1 }} />
        <div className="seg">
          <button type="button" className="seg-opt on" aria-pressed>
            Table
          </button>
          {/* The sheet's second seg option, resting UNARMED (the runs Retry
              precedent): Cards isn't built, and a click that silently did
              nothing would be a dead door. */}
          <button
            type="button"
            className="seg-opt"
            aria-disabled
            title="Cards view isn’t built yet — Table is the shipped view (the sheet’s open call b)."
          >
            Cards
          </button>
        </div>
        <div className="btn btn-ghost btn-sm sel-ctl">
          {`Last ${windowDays} days`}
          <span className="chev" />
          <select
            className="sel-native"
            aria-label="Window length"
            value={windowDays}
            onChange={(event) => {
              setWindowDays(Number(event.target.value));
              setModelStatus("loading");
              setHoverIdx(null);
            }}
          >
            {WINDOWS.map((d) => (
              <option key={d} value={d}>{`Last ${d} days`}</option>
            ))}
          </select>
        </div>
        <span
          className="btn btn-ghost btn-sm"
          aria-disabled
          style={{ cursor: "default" }}
          title="The comparison is always the preceding window of equal length — other baselines aren’t wired yet."
        >
          {`vs previous ${windowDays}`}
        </span>
      </div>

      {/* ── the filter band + the surface-wide as-of ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div className="btn btn-ghost btn-sm sel-ctl">
          {platform === null ? "Filter" : "Filter · 1"}
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
        {platform !== null && (
          <span className="fchip">
            <span className="f">Platform ·</span> {platformLabel(platform)}{" "}
            <button
              type="button"
              className="x"
              aria-label="Remove the platform filter"
              onClick={() => setPlatform(null)}
            >
              ×
            </button>
          </span>
        )}
        {platform !== null && (
          <button
            type="button"
            className="card-link"
            style={{ ...LINK_BUTTON, fontSize: 12 }}
            onClick={() => setPlatform(null)}
          >
            × Clear
          </button>
        )}
        <div style={{ flex: 1 }} />
        {modelStatus === "success" && model && (
          <span className="t-data">
            {asOf
              ? `as of ${fmtAsOf(asOf)} · platform APIs lag up to 48h`
              : "no measurements yet — the metrics tick has not run"}
          </span>
        )}
      </div>

      {modelStatus === "error" && (
        <section
          className="card"
          style={{ padding: "14px 16px", borderColor: "color-mix(in oklab, var(--err) 40%, var(--n-400))" }}
          role="alert"
        >
          <p className="t-title">Couldn’t read the analytics</p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
            <span className="t-label">
              The read failed — this is a read failure, not an empty history.
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setModelStatus("loading");
                void loadModel();
              }}
            >
              Try again
            </button>
          </div>
        </section>
      )}

      {modelStatus === "loading" && (
        <div className="card">
          <div className="row">
            <span className="t-label">Reading what your posts did…</span>
          </div>
        </div>
      )}

      {modelStatus === "success" && model === null && (
        <div className="card">
          <div className="row">
            <span className="t-label">
              No tenant is seeded yet — this workspace has nothing to measure.
            </span>
          </div>
        </div>
      )}

      {/* The plan read failing must not silently strip the post cells — the
          excerpts' absence is stated, beside a table that still rendered. */}
      {modelStatus === "success" && model !== null && planStatus === "error" && posts.length > 0 && (
        <section className="card" style={{ padding: "11px 16px" }} role="status">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="t-label">
              Post excerpts couldn’t be read — rows show platform + id meanwhile.
            </span>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setPlanStatus("loading");
                void loadPlan();
              }}
            >
              Try again
            </button>
          </div>
        </section>
      )}

      {/* The bound, stated: deltas over a partial baseline must say so. */}
      {modelStatus === "success" && model?.bound.truncated === true && (
        <section className="card" style={{ padding: "11px 16px" }} role="status">
          <span className="t-label" style={{ color: "var(--warn)" }}>
            {`The read stopped at ${model.bound.limit} publications before reaching the previous window — the deltas compare against an incomplete baseline.`}
          </span>
        </section>
      )}

      {modelStatus === "success" && model !== null && tiles !== null && (
        <>
          {/* ── four facts, each with its own shape and its own footnote ── */}
          <div className="an-tiles">
            {tiles.map((tile) => (
              <TileBox key={tile.ctx} tile={tile} />
            ))}
          </div>

          <div className="an-grid">
            {/* ── the per-post table: the POST in the cell, a trend per row ── */}
            <div className="tbl">
              <div className="th">
                <span>Post</span>
                <span>Platform</span>
                <span className="num">
                  <button type="button" onClick={() => sortBy("sent")} className={sort === "sent" ? "on" : undefined}>
                    {`Sent${arrow("sent")}`}
                  </button>
                </span>
                <span className={sort === "reach" ? "num on" : "num"}>
                  <button type="button" onClick={() => sortBy("reach")} style={{ alignItems: "flex-end" }}>
                    <svg className="ico" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
                      <path d="M1.5 8S3.9 3.7 8 3.7 14.5 8 14.5 8 12.1 12.3 8 12.3 1.5 8 1.5 8Z" />
                      <circle cx="8" cy="8" r="1.9" />
                    </svg>
                    {`Reach${arrow("reach")}`}
                  </button>
                </span>
                <span className={sort === "engagement" ? "num on" : "num"}>
                  <button type="button" onClick={() => sortBy("engagement")} style={{ alignItems: "flex-end" }}>
                    <svg className="ico" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M8 13.5s-5.2-3.2-5.2-6.6A2.9 2.9 0 0 1 8 5.3a2.9 2.9 0 0 1 5.2 1.6c0 3.4-5.2 6.6-5.2 6.6Z" />
                    </svg>
                    {`Engag.${arrow("engagement")}`}
                  </button>
                </span>
                <span>Trend · Feeds back</span>
              </div>

              {rows.map((post) => (
                <PostRow key={post.id} post={post} pav={pav} />
              ))}

              {rows.length === 0 && (
                <div style={{ padding: "14px 13px" }}>
                  <span className="t-label">
                    {model.posts.length > 0
                      ? "No posts match this view — clear the platform filter to widen it."
                      : model.bound.totalPublications > 0
                        ? `Nothing published in the last ${model.bound.windowDays} days — ${model.bound.totalPublications} older publication${model.bound.totalPublications === 1 ? "" : "s"} fall outside the window.`
                        : "Nothing published yet — approved posts land here once they ship."}
                  </span>
                </div>
              )}

              <div style={{ flex: 1 }} />
              {model.posts.length > 0 && (
                <div className="end-line">{endLine(model, rows.length, narrowed)}</div>
              )}
            </div>

            {/* ── right column: the trend, the reserved box, the loop ── */}
            <div className="side">
              <div className="card" style={{ position: "relative" }}>
                <div className="card-head">
                  <span className="t-title">Reach &amp; engagement</span>
                  <button type="button" className="info" aria-label="How this chart is built">
                    i
                  </button>
                  {chart && (
                    <div className="tip" style={{ right: 13, top: 42 }}>
                      <span className="tip-h">how this line is built</span>
                      {chart.tip}
                    </div>
                  )}
                  <div style={{ flex: 1 }} />
                  <span className="lg2">
                    <i style={{ background: "var(--act)" }} />
                    Reach
                  </span>
                  <span className="lg2">
                    <i style={{ background: "var(--ok)" }} />
                    Engag.
                  </span>
                </div>
                <div className="chart-wrap">
                  <TrendChart
                    chart={chart}
                    hoverIdx={hoverIdx}
                    onHover={setHoverIdx}
                  />
                  <div className="x-ax">
                    {chart?.axis.map((label, i) => <span key={`${label}-${i}`}>{label}</span>)}
                  </div>
                  {chartDays !== null && (
                    <div className="t-data" style={{ height: 15, marginTop: 2 }}>
                      {hoverReadout ?? ""}
                    </div>
                  )}
                </div>
              </div>

              <div className="card" style={{ display: "flex", flexDirection: "column", position: "relative" }}>
                <div className="card-head">
                  <span className="t-title">Engagement by hour</span>
                  <button type="button" className="info" aria-label="Why this box is empty">
                    i
                  </button>
                  <div className="tip" style={{ right: 13, top: 42 }}>
                    <span className="tip-h">why this is empty</span>
                    Per-hour engagement needs the time-of-day density the metrics tick would write
                    into publication_metrics; the tick is not scheduled yet, so no hourly shape
                    exists. The box stays reserved rather than drawing a fabricated curve.
                  </div>
                  <div style={{ flex: 1 }} />
                  <div className="seg">
                    {["Avg", "Days", "Heatmap"].map((option, i) => (
                      <span
                        key={option}
                        className={i === 0 ? "seg-opt on" : "seg-opt"}
                        aria-disabled
                        title="No hourly data to segment yet — arrives with publication_metrics."
                      >
                        {option}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ padding: "10px 13px 12px" }}>
                  <div className="hour-box">
                    <svg className="ghost-area" viewBox="0 0 300 118" preserveAspectRatio="none" aria-hidden>
                      <path
                        fill="var(--n-700)"
                        d="M0,96 L25,80 L50,44 L75,66 L100,88 L125,74 L150,90 L175,58 L200,70 L225,30 L250,62 L275,84 L300,92 L300,118 L0,118 Z"
                      />
                    </svg>
                    <span className="t-label" style={{ fontSize: 11.5, color: "var(--n-900)", position: "relative" }}>
                      No hourly data yet
                    </span>
                    <span className="t-label" style={{ fontSize: 10.5, position: "relative", lineHeight: 1.4 }}>
                      This shape is a placeholder, not your data.
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 9 }}>
                    <span className="t-data">arrives with publication_metrics · the metrics tick is not scheduled yet</span>
                    <div style={{ flex: 1 }} />
                    <button
                      type="button"
                      className="card-link"
                      style={{ ...LINK_BUTTON, whiteSpace: "nowrap" }}
                      aria-expanded={hourWhat}
                      onClick={() => setHourWhat((open) => !open)}
                    >
                      What this does →
                    </button>
                  </div>
                  {hourWhat && (
                    <p className="t-label" style={{ marginTop: 7, lineHeight: 1.45 }}>
                      Once the metrics tick runs on a schedule, captures gain time-of-day density:
                      this box becomes average engagement per posting hour (Avg), split by weekday
                      (Days), or a week × hour heatmap — the read a schedule argues a slot with.
                    </p>
                  )}
                </div>
              </div>

              <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
                <div className="card-head">
                  <span className="t-title">Where this goes back</span>
                  <div style={{ flex: 1 }} />
                  {/* The sheet fixtures "6 of 14"; the wire carries no
                      feed-back read yet, so the pill says the honest word. */}
                  <span
                    className="pill pill-idle"
                    title="The measure→profile write-back isn’t wired yet — no post’s metrics have reached a profile."
                  >
                    none yet
                  </span>
                </div>
                <div className="loop-row">
                  <div className="loop-ico">P</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500 }}>
                      {pulse?.profile
                        ? `Profile v${pulse.profile.version} · voice weights`
                        : "Profile · voice weights"}
                    </div>
                    <div className="excerpt" style={{ whiteSpace: "normal" }}>
                      Waiting on measured posts — nothing has fed back yet.
                    </div>
                  </div>
                </div>
                <div className="loop-row">
                  <div className="loop-ico">C</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500 }}>Cadence · slot pressure</div>
                    <div className="excerpt" style={{ whiteSpace: "normal" }}>
                      Waiting on the hourly window above.
                    </div>
                  </div>
                </div>
                <div className="loop-row">
                  <div className="loop-ico">J</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500 }}>Judge · never</div>
                    <div className="excerpt" style={{ whiteSpace: "normal" }}>
                      Metrics never move the gate.
                    </div>
                  </div>
                </div>
                <div style={{ flex: 1 }} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** One fact tile: value + delta + its own shape + the honest footnote. */
function TileBox({ tile }: { tile: TileView }) {
  const paths = tile.spark ? sparkPaths(tile.spark.values, 100, 26) : null;
  return (
    <div className="an-tile" title={tile.title}>
      <span className="ctx">{tile.ctx}</span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
        <span className="fact">{tile.fact}</span>
        {tile.delta && <span className={tile.delta.cls}>{tile.delta.text}</span>}
      </div>
      {paths && tile.spark && (
        <svg
          className={tile.spark.ok ? "spark ok" : "spark"}
          viewBox="0 0 100 26"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path className="fill" d={paths.fill} />
          <path className="line" d={paths.line} />
        </svg>
      )}
      <span className="asof">{tile.note}</span>
    </div>
  );
}

/** One publication in the sheet's row grammar: post cell → mark → sent → the two metric cells → trend + feeds back. */
function PostRow({ post, pav }: { post: PostView; pav: string }) {
  const spark = post.trend ? sparkPaths(post.trend.values, 58, 18) : null;
  return (
    <div className="tr">
      <div className="post-cell">
        <div className="pav">{pav}</div>
        <div className="body">
          <div className="ttl">{post.title}</div>
          <div className="sub">{post.sub}</div>
        </div>
        {post.media !== null && <div className="pmedia">{post.media}</div>}
      </div>
      <span className="plat">
        <AnalyticsPlatMark platform={post.platform} />
        {platformLabel(post.platform)}
      </span>
      <span className="num t-data" title={fmtAsOf(post.sentAt)}>
        {fmtDay(post.sentAt)}
      </span>
      <MetricCell view={post.audience} />
      <MetricCell view={post.engagement} />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {spark && post.trend ? (
          <svg
            className="spark-row spark"
            viewBox="0 0 58 18"
            preserveAspectRatio="none"
            aria-label={`${post.trend.label} series · ${post.trend.values.length} captures`}
          >
            <path className="fill" d={spark.fill} />
            <path className="line" d={spark.line} />
          </svg>
        ) : (
          <span className="no-spark" title="No measured series on this post — nothing is drawn.">
            —
          </span>
        )}
        <span className="feeds feeds-off" title={post.feeds.title}>
          {post.feeds.text}
        </span>
      </div>
    </div>
  );
}

/** A number is a number; a hole is a sentence — never a 0 that reads real. */
function MetricCell({ view }: { view: import("./analytics-model").CellView }) {
  return view.kind === "number" ? (
    <span className="num" title={view.title}>
      {view.text}
    </span>
  ) : (
    <span className="na" title={view.title}>
      {view.text}
    </span>
  );
}

/** The 28-day trend: reach area over the platforms that report it, engagement dashed over its own stated basis, values-at-a-point on hover. */
function TrendChart({
  chart,
  hoverIdx,
  onHover,
}: {
  chart: ReturnType<typeof chartView> | null;
  hoverIdx: number | null;
  onHover: (idx: number | null) => void;
}) {
  const reach = chart?.reach ?? null;
  const engagement = chart?.engagement ?? null;
  const days = reach?.values.length ?? engagement?.values.length ?? 0;
  if (days === 0) {
    return (
      <div style={{ position: "relative" }}>
        <svg className="chart" viewBox="0 0 320 94" preserveAspectRatio="none" aria-hidden>
          <line className="grid-l" x1="0" y1="23" x2="320" y2="23" />
          <line className="grid-l" x1="0" y1="47" x2="320" y2="47" />
          <line className="grid-l" x1="0" y1="71" x2="320" y2="71" />
        </svg>
        <span
          className="t-label"
          style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, textAlign: "center" }}
        >
          No metric series yet — the metrics tick has not run.
        </span>
      </div>
    );
  }
  const max = Math.max(...(reach?.values ?? [0]), ...(engagement?.values ?? [0]));
  const reachPaths = reach ? chartPaths(reach.values, max) : null;
  const engagementPaths = engagement ? chartPaths(engagement.values, max) : null;
  const x = hoverIdx !== null && days > 1 ? (hoverIdx / (days - 1)) * 320 : null;
  const yAt = (values: number[] | undefined, idx: number): number | null => {
    if (!values) return null;
    return max === 0 ? 94 : 6 + (1 - values[idx] / max) * 88;
  };
  return (
    <svg
      className="chart"
      viewBox="0 0 320 94"
      preserveAspectRatio="none"
      role="img"
      aria-label="Reach and engagement over the window"
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const frac = (event.clientX - rect.left) / rect.width;
        onHover(Math.max(0, Math.min(days - 1, Math.round(frac * (days - 1)))));
      }}
      onMouseLeave={() => onHover(null)}
    >
      <line className="grid-l" x1="0" y1="23" x2="320" y2="23" />
      <line className="grid-l" x1="0" y1="47" x2="320" y2="47" />
      <line className="grid-l" x1="0" y1="71" x2="320" y2="71" />
      {reachPaths && (
        <>
          <path className="a-fill" d={reachPaths.fill} />
          <path className="a-line" d={reachPaths.line} />
        </>
      )}
      {engagementPaths && <path className="b-line" d={engagementPaths.line} />}
      {x !== null && hoverIdx !== null && (
        <>
          <line className="crosshair" x1={x} y1="0" x2={x} y2="94" />
          {reach && <circle cx={x} cy={yAt(reach.values, hoverIdx) ?? 0} r="2.6" fill="var(--act)" />}
          {engagement && (
            <circle cx={x} cy={yAt(engagement.values, hoverIdx) ?? 0} r="2.4" fill="var(--ok)" />
          )}
        </>
      )}
    </svg>
  );
}
