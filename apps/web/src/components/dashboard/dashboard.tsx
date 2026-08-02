"use client";

import "@/components/dashboard/dashboard.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  composingCount,
  needsYouRows,
  oldestWaitHours,
  publishedRows,
  setupState,
  slotsInWeek,
} from "@/components/dashboard/dashboard-model";
import { BoardView } from "@/components/dashboard/board-view";
import { NeedsYouCard, type NeedsYouStatus } from "@/components/dashboard/needs-you-card";
import { SetupBand } from "@/components/dashboard/setup-band";
import { WeekCard, type WeekCardStatus } from "@/components/dashboard/week-card";
import { usePulse } from "@/components/workspace/pulse-context";
import { fetchIntegrationCards } from "@/lib/integrations/client";
import { fetchTrends } from "@/lib/intel/client";
import { fetchPlan, fetchStatus } from "@/lib/workspace/client";
import { timeAgo, waitLabel } from "@/lib/workspace/format";
import { weekDays } from "@/lib/workspace/week";
import type { PlanPayload, WorkspaceStatus } from "@/lib/workspace/types";
import type { TrendsPayload } from "@/lib/intel/types";

function headerDate(now: Date): string {
  // en-GB gives the sheet's exact grammar: "Friday 25 July".
  return now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

/** Dismissal is per-tenant presentation state — localStorage, like the theme toggle. */
function setupDismissKey(tenantSlug: string): string {
  return `thalon:setup-dismissed:${tenantSlug}`;
}

export type HomeView = "overview" | "board";

/**
 * The seg's state rides the URL (`/app?view=board`) so the board stays
 * linkable after the /app/board route's retirement. The PAGE resolves the
 * initial view from its own searchParams — server and client render the same
 * state on a deep link (a `typeof window` branch here was a measured
 * hydration mismatch) — and popstate re-reads it so back/forward re-cross
 * the toggle.
 */
function readHomeView(): HomeView {
  return new URLSearchParams(window.location.search).get("view") === "board"
    ? "board"
    : "overview";
}

/** "next in 4h" from an ISO instant — quiet when there is honestly no next sweep. */
function nextIn(iso: string | null, now: Date): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - now.getTime();
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return "due now";
  const h = Math.round(ms / 3_600_000);
  return h < 1 ? `in ${Math.max(1, Math.round(ms / 60_000))}m` : `in ${h}h`;
}

/**
 * The Home/Dashboard surface, rebuilt exactly from Dashboard.dc.html
 * (DOCTRINE 0 — the sheet is the blueprint): Today header + the four stat
 * tiles, the needs-you × week home-grid, the latest-published strip. Every
 * fact is a door; every count is real or visibly unresolved ("–"), never a
 * real-looking zero. The first-run and engine-unreachable states keep
 * their honesty cards in the sheet's card grammar.
 */
export function Dashboard({ initialView = "overview" }: { initialView?: HomeView }) {
  const { pulse, status: pulseStatus, refresh } = usePulse();
  const router = useRouter();

  const [health, setHealth] = useState<WorkspaceStatus | null>(null);
  // One status for both plan-backed cards (week + needs-you) — they share the read.
  const [planStatus, setPlanStatus] = useState<WeekCardStatus>("loading");
  const [plan, setPlan] = useState<PlanPayload | null>(null);
  const [trends, setTrends] = useState<TrendsPayload | null>(null);
  // The setup band's channel step needs the integration cards. null until the
  // read RESOLVES; a failed read leaves it null and the band simply doesn't
  // render — a nudge is optional chrome, and a wrong nudge ("connect a
  // channel" to someone connected) would be worse than none.
  const [channelConnected, setChannelConnected] = useState<boolean | null>(null);
  const [setupDismissed, setSetupDismissed] = useState(false);
  const [view, setView] = useState<HomeView>(initialView);

  // Back/forward re-crosses the toggle — the URL stays the one truth of which
  // state is on screen (the toggle is a lens, and lenses must be reversible).
  useEffect(() => {
    const onPop = () => setView(readHomeView());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const showView = (next: HomeView) => {
    if (next === view) return;
    setView(next);
    router.push(next === "board" ? "/app?view=board" : "/app");
  };

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
    let cancelled = false;
    void loadPlan();
    // The trends tile rides the surface's own read; a failed read leaves the
    // tile at "–" (never a real-looking zero).
    fetchTrends()
      .then((data) => {
        if (!cancelled) setTrends(data);
      })
      .catch(() => {
        /* the tile renders its unresolved state */
      });
    // Best-effort health read: only a degraded gateway surfaces here — the
    // full seam/driver readout is Settings' job, not the dashboard's.
    fetchStatus()
      .then((data) => {
        if (!cancelled) setHealth(data);
      })
      .catch(() => {
        /* the pulse error card covers engine-down; nothing extra to say */
      });
    // The setup band's channel truth. Failure leaves the band unrendered.
    fetchIntegrationCards()
      .then((cards) => {
        if (!cancelled) setChannelConnected(cards.some((c) => c.state === "connected"));
      })
      .catch(() => {
        /* band stays absent — see the state's comment */
      });
    return () => {
      cancelled = true;
    };
  }, [loadPlan]);

  const now = new Date();
  const firstRun = pulseStatus === "success" && pulse?.tenant === null;
  const pulseError = pulseStatus === "error";
  const needsYou = pulse?.needsYou ?? 0;

  const tenantSlug = pulse?.tenant?.slug ?? null;
  useEffect(() => {
    if (!tenantSlug) return;
    // The async wrapper keeps the setState out of the effect's own body
    // (react-hooks/set-state-in-effect — the B1.4 lesson).
    Promise.resolve(window.localStorage.getItem(setupDismissKey(tenantSlug))).then((stored) => {
      setSetupDismissed(stored === "1");
    });
  }, [tenantSlug]);

  // The band exists only once every step's truth has been READ: the pulse
  // (profile/runs/approvals) and the integration cards (channel). All four
  // done, or dismissed, and it is gone — it never blocks, it never nags.
  const setup =
    pulseStatus === "success" && pulse?.tenant && channelConnected !== null
      ? setupState({
          channelConnected,
          hasProfile: pulse.profile !== null,
          hasRun: pulse.counts.runs > 0,
          hasApproval: pulse.counts.approved > 0,
          needsYou,
        })
      : null;
  const showSetup = setup !== null && !setup.allDone && !setupDismissed;
  const dismissSetup = () => {
    if (tenantSlug) window.localStorage.setItem(setupDismissKey(tenantSlug), "1");
    setSetupDismissed(true);
  };

  const retryPlan = () => {
    setPlanStatus("loading");
    void loadPlan();
  };
  // The needs-you card draws rows from the plan read but its count from the
  // pulse — it resolves only when both have answered.
  const needsYouStatus: NeedsYouStatus =
    pulseError || planStatus === "error"
      ? "error"
      : pulseStatus === "success" && planStatus === "success"
        ? "success"
        : "loading";

  const assets = planStatus === "success" && plan ? plan.assets : [];
  const composing = planStatus === "success" ? String(composingCount(assets)) : "–";
  const oldestWait = oldestWaitHours(assets, now);
  const rows = needsYouStatus === "success" ? needsYouRows(assets) : [];
  /** How many waiting drafts the PLAN read actually returned — null until it has. */
  const waitingRead = needsYouStatus === "success" ? rows.length : null;
  const slotsCount =
    planStatus === "success" && plan ? String(slotsInWeek(plan.plannedSlots, weekDays(now)).length) : "–";
  const published = publishedRows(assets);

  return (
    // `.dashboard-surface` is the scope root every rebuilt surface carries
    // (README rule 6). This surface shipped without one, which is why a status
    // colour it needed to override had nowhere to live — see dashboard.css.
    <div className="content dashboard-surface">
      {firstRun && (
        <section className="card" style={{ padding: "14px 16px" }} aria-label="First run">
          <p className="t-title">Welcome — three steps to your first draft</p>
          <p className="t-label" style={{ marginTop: 4 }}>
            All on the built-in demo drivers — no keys, no spend, and nothing ships without your
            click.
          </p>
          <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
            <Link className="card-link" href="/app/profiles">
              1 · Tell Thalon who it writes for →
            </Link>
            <Link className="card-link" href="/app/create">
              2 · Feel the flow on one prompt →
            </Link>
            <Link className="card-link" href="/app/approve">
              3 · Walk the queue once →
            </Link>
          </div>
        </section>
      )}
      {pulseError && (
        <section
          className="card"
          style={{
            padding: "14px 16px",
            borderColor: "color-mix(in oklab, var(--err) 40%, var(--n-400))",
          }}
          role="alert"
        >
          <p className="t-title">Couldn’t reach the engine</p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
            <span className="t-label">
              The queue couldn’t be read — this is a read failure, not a quiet day.
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void refresh()}>
              Try again
            </button>
          </div>
        </section>
      )}

      {/* Each state renders ITS sheet's header exactly: Overview puts the date
          beside Today and the seg on the right (Dashboard.dc.html); Board puts
          the seg beside Today and the loop hint on the right (Board.dc.html).
          The seg's buttons are buttons, not Links: `.screen a` paints anchors
          accent-blue and workspace.css is the shell contract — the week card's
          Today/This week control sets the same precedent. */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <h1 className="t-headline">Today</h1>
        {view === "overview" && <span className="t-label">{headerDate(now)}</span>}
        {view === "board" && <HomeSeg view={view} onShow={showView} />}
        <div style={{ flex: 1 }} />
        {view === "overview" ? (
          <HomeSeg view={view} onShow={showView} />
        ) : (
          <span className="t-label">
            left to right is the loop · cards move when the work moves · one human gate — Approve
          </span>
        )}
      </div>

      {view === "board" ? (
        <BoardView plan={plan} planStatus={planStatus} onRetryPlan={retryPlan} now={now} />
      ) : (
        <>
          {showSetup && setup && <SetupBand state={setup} onDismiss={dismissSetup} />}

      <div className="tiles">
        <Link href="/app/intel" className="tile tile-link" style={{ color: "inherit" }}>
          <div className="tile-head">
            <span className="t-label">Rising trends</span>
            <div style={{ flex: 1 }} />
            <span className="tile-arrow">→</span>
          </div>
          <span className="fact">{trends ? trends.cards.length : "–"}</span>
          <span className="ctx">
            {trends
              ? `swept ${timeAgo(trends.sweep.lastSweptAt, now.getTime())}${
                  trends.sweep.dueNow
                    ? " · sweep due now"
                    : trends.sweep.nextSweepAt
                      ? ` · next ${nextIn(trends.sweep.nextSweepAt, now)}`
                      : " · no next sweep scheduled"
                }`
              : "reading trends…"}
          </span>
        </Link>
        <Link href="/app/runs" className="tile tile-link" style={{ color: "inherit" }}>
          <div className="tile-head">
            <span className="t-label">Composing</span>
            <div style={{ flex: 1 }} />
            <span className="tile-arrow">→</span>
          </div>
          <span className="fact">{composing}</span>
          <span className="ctx">drafts at the judge gate</span>
        </Link>
        <Link
          href="/app/approve"
          className="tile tile-link"
          style={
            needsYou > 0
              ? { color: "inherit", borderColor: "color-mix(in oklab, var(--warn) 35%, var(--n-400))" }
              : { color: "inherit" }
          }
        >
          <div className="tile-head">
            <span className="t-label">Needs you</span>
            <div style={{ flex: 1 }} />
            <span className="tile-arrow">→</span>
          </div>
          <span className="fact" style={needsYou > 0 ? { color: "var(--warn)" } : undefined}>
            {pulseStatus === "success" ? needsYou : "–"}
          </span>
          {/* The tile's number is the pulse's; the wait beside it is computed
              from the narrower plan window, so when the two disagree the wait
              is the oldest of what was READ, not of the queue — and the drafts
              outside the window are the oldest ones. Say which set it measures
              rather than printing a real-looking number for the wrong one
              (this surface's own rule: visibly bounded beats confidently
              wrong). The card below carries the same bound with its door. */}
          <span className="ctx">
            {pulseStatus !== "success"
              ? "reading the queue…"
              : needsYou === 0
                ? "queue clear"
                : oldestWait !== null
                  ? waitingRead !== null && waitingRead < needsYou
                    ? `${waitingRead} of ${needsYou} read · oldest of those ${waitLabel(oldestWait)}`
                    : `oldest has waited ${waitLabel(oldestWait)}`
                  : "waiting on your review"}
          </span>
        </Link>
        <Link href="/app/schedule" className="tile tile-link" style={{ color: "inherit" }}>
          <div className="tile-head">
            <span className="t-label">Planned slots</span>
            <div style={{ flex: 1 }} />
            <span className="tile-arrow">→</span>
          </div>
          <span className="fact">{slotsCount}</span>
          <span className="ctx">this week · door unarmed — plans, not uploads</span>
        </Link>
      </div>

      <div className="home-grid">
        <NeedsYouCard
          rows={rows}
          count={needsYou}
          status={needsYouStatus}
          onRetry={retryPlan}
          now={now}
        />
        <WeekCard status={planStatus} plan={plan} onRetry={retryPlan} now={now} />
      </div>

      {health?.seams.gateway === "unconfigured" && (
        <section
          className="card"
          style={{
            padding: "10px 16px",
            borderColor: "color-mix(in oklab, var(--warn) 35%, var(--n-400))",
          }}
          role="status"
        >
          <span className="t-label">
            The AI gateway key isn’t configured — generation and judging can’t run until it is.{" "}
            <Link className="card-link" href="/app/settings">
              Check Settings →
            </Link>
          </span>
        </section>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="t-title">Latest published</span>
        <div style={{ flex: 1 }} />
        <Link className="card-link" href="/app/settings">
          The published ledger →
        </Link>
      </div>
      {published.length > 0 ? (
        <div className="pub-grid">
          {published.map((row) => (
            <div key={row.draftId} className="pub-card">
              <div className="thumb-sm">
                <span>{row.thumb}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {row.title}
                </div>
                <div className="excerpt">
                  {row.liveHref ? (
                    <>
                      <a href={row.liveHref} target="_blank" rel="noreferrer">
                        view live ↗
                      </a>{" "}
                      · {timeAgo(row.at.toISOString(), now.getTime())}
                    </>
                  ) : (
                    timeAgo(row.at.toISOString(), now.getTime())
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <span className="t-label">
          {planStatus === "success"
            ? "Nothing published yet — approved work ships from the queue."
            : "Reading the ledger…"}
        </span>
      )}
        </>
      )}
    </div>
  );
}

/** The Overview | Board lens switch — one control, drawn wherever its state's sheet puts it. */
function HomeSeg({ view, onShow }: { view: HomeView; onShow: (next: HomeView) => void }) {
  return (
    <div className="seg">
      <button
        type="button"
        className={view === "overview" ? "seg-opt on" : "seg-opt"}
        onClick={() => onShow("overview")}
      >
        Overview
      </button>
      <button
        type="button"
        className={view === "board" ? "seg-opt on" : "seg-opt"}
        title="The same day as pipeline columns"
        onClick={() => onShow("board")}
      >
        Board
      </button>
    </div>
  );
}
