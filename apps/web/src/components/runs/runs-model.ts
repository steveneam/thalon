import { platformLabel, thumbLabel } from "@/components/dashboard/dashboard-model";
import type { FeedRun } from "@/lib/approve-queue/types";
import type { PipelineAsset } from "@/lib/workspace/types";
import { dayKey, weekDays } from "@/lib/workspace/week";

/**
 * Pure derivations behind the Runs sheet's bands (DOCTRINE 0 rebuild, step
 * 2). The surface reads TWO existing clients — the `/api/runs` feed (what
 * ran) and the plan read (`/api/app/plan`, what each run's drafts DID) —
 * and every line the sheet draws comes from here, so the honesty rules stay
 * unit-testable: no fabricated counts, the recorded error verbatim, and a
 * run the plan window doesn't cover degrades to what the feed itself knows
 * instead of inventing draft numbers.
 */

export type RunFilter = "all" | "failed" | "published";

/** How far the plan read has got — the excerpt says "reading…" only while it honestly is. */
export type PlanReadStatus = "loading" | "error" | "success";

const WAITING = new Set(["queued", "blocked"]);

export interface RunPill {
  tone: "ok" | "warn" | "err" | "idle";
  label: string;
}

export interface RunRow {
  id: string;
  /** The run's receipts, one click deep — the whole row is this door. */
  href: string;
  lead: string;
  excerpt: string;
  /** The excerpt rides the error channel (recorded failure / judge block). */
  excerptError: boolean;
  /** Live page URL when a deploy recorded one — the sheet's "Published · /blog/… ↗". */
  liveHref: string | null;
  pill: RunPill;
  thumb: string | null;
  at: Date;
  /** Recorded failure or partial fan-out — the Failed filter AND the header pill. */
  failed: boolean;
  /** A draft of this run reached a live page. */
  published: boolean;
  /** Replay isn't wired — the sheet's Retry rides failed rows unarmed, and says so. */
  retryable: boolean;
}

/** jsonb on the wire: trust nothing, name only what is actually there. */
export function platformsOf(run: FeedRun): string[] {
  return Array.isArray(run.platforms) ? run.platforms.filter((p): p is string => typeof p === "string") : [];
}

function statusWord(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/** Drafts of this run, from the plan read's pipeline assets. */
export function assetsByRun(assets: PipelineAsset[]): Map<string, PipelineAsset[]> {
  const map = new Map<string, PipelineAsset[]>();
  for (const asset of assets) {
    const list = map.get(asset.runId);
    if (list) list.push(asset);
    else map.set(asset.runId, [asset]);
  }
  return map;
}

/**
 * One feed run as the sheet's row. `assets` is what the plan read knows
 * about this run's drafts — empty means the plan hasn't answered yet, or
 * the run is older than the plan window; both degrade to the feed's own
 * numbers, never to invented ones.
 */
export function runRow(run: FeedRun, assets: PipelineAsset[], planStatus: PlanReadStatus): RunRow {
  const platforms = platformsOf(run);
  const published = assets.filter((a) => a.publishedAt !== null);
  const blocked = assets.filter((a) => a.status === "blocked");
  const waitingAssets = assets.filter((a) => WAITING.has(a.status));
  const passed = assets.filter((a) => a.judgedAt !== null && a.status !== "blocked").length;
  // The feed carries its own waiting count (server-derived) — it stays the
  // fallback for runs the plan window doesn't cover.
  const waiting = assets.length > 0 ? waitingAssets.length : run.waiting;
  const recordedFailure = run.lastError !== null || run.status === "failed";
  // ONE triage predicate for the header pill and the Failed filter, so the
  // count and the view can never disagree: a recorded error OR a fan-out
  // that produced fewer drafts than it requested (an aborted run).
  const failed = recordedFailure || !run.draftsComplete;

  let excerpt: string;
  let excerptError = false;
  if (run.lastError) {
    // VERBATIM (B4.5's operator surface): the recorded message IS the triage
    // evidence, cleared automatically when a later pass backfills the run.
    excerpt = run.lastError;
    excerptError = true;
  } else if (blocked.length > 0) {
    excerpt = `Blocked by the judge — ${blocked[0].reasons[0] ?? "reasons attached"}`;
    excerptError = true;
  } else if (published.length > 0) {
    excerpt = "Published";
  } else if (assets.length > 0) {
    const parts = [`One prompt → ${assets.length} draft${assets.length === 1 ? "" : "s"}`];
    if (passed > 0) parts.push(`${passed} passed the judge`);
    if (waiting > 0) parts.push(`${waiting} waiting on you`);
    if (!run.draftsComplete) parts.push("fewer drafts than platforms requested");
    excerpt = parts.join(" · ");
  } else if (planStatus === "loading") {
    excerpt = "reading the drafts…";
  } else {
    const parts = [
      platforms.length > 0
        ? `${platforms.length} platform${platforms.length === 1 ? "" : "s"} requested`
        : "no platforms recorded",
    ];
    if (waiting > 0) parts.push(`${waiting} waiting on you`);
    if (!run.draftsComplete) parts.push("fewer drafts than platforms requested");
    excerpt = parts.join(" · ");
  }

  let pill: RunPill;
  if (recordedFailure) pill = { tone: "err", label: "Failed" };
  else if (!run.draftsComplete) pill = { tone: "err", label: "Incomplete" };
  else if (blocked.length > 0) pill = { tone: "err", label: "Blocked" };
  else if (waiting > 0) pill = { tone: "warn", label: `${waiting} waits` };
  else if (published.length > 0) pill = { tone: "ok", label: "Published" };
  else if (assets.length > 0 && assets.every((a) => a.status === "approved"))
    pill = { tone: "ok", label: "Approved" };
  else pill = { tone: "idle", label: statusWord(run.status) };

  return {
    id: run.id,
    href: `/app/approve?run=${encodeURIComponent(run.id)}`,
    lead:
      platforms.length > 0
        ? `Fan-out · ${platforms.map(platformLabel).join(" + ")}`
        : "Fan-out run",
    excerpt,
    excerptError,
    liveHref: published[0]?.deployRef ?? null,
    pill,
    thumb: assets.map(thumbLabel).find((label) => label !== null) ?? null,
    at: new Date(run.createdAt),
    failed,
    published: published.length > 0,
    retryable: recordedFailure,
  };
}

export function rowsFor(
  runs: FeedRun[],
  assets: PipelineAsset[],
  planStatus: PlanReadStatus,
): RunRow[] {
  const byRun = assetsByRun(assets);
  return runs.map((run) => runRow(run, byRun.get(run.id) ?? [], planStatus));
}

export function filterRows(rows: RunRow[], filter: RunFilter): RunRow[] {
  if (filter === "failed") return rows.filter((row) => row.failed);
  if (filter === "published") return rows.filter((row) => row.published);
  return rows;
}

export interface RunDay {
  key: string;
  heading: string;
  rows: RunRow[];
}

/** The sheet's day headings: "Today · Friday 25 July", then plain "Thursday 24 July". */
export function dayHeading(date: Date, now: Date): string {
  // en-GB gives the sheet's exact grammar (the dashboard header's precedent).
  const long = date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  return dayKey(date) === dayKey(now) ? `Today · ${long}` : long;
}

/** Newest day first, rows newest first inside it — one `.day-hd` + `.card` per day. */
export function groupByDay(rows: RunRow[], now: Date): RunDay[] {
  const days: RunDay[] = [];
  for (const row of [...rows].sort((a, b) => b.at.getTime() - a.at.getTime())) {
    const key = dayKey(row.at);
    const day = days.find((d) => d.key === key);
    if (day) day.rows.push(row);
    else days.push({ key, heading: dayHeading(row.at, now), rows: [row] });
  }
  return days;
}

/** The header's "18 this week" — the local Monday-start week the whole workspace uses. */
export function runsThisWeek(rows: RunRow[], now: Date): number {
  const days = weekDays(now);
  if (days.length === 0) return 0;
  const start = days[0].date.getTime();
  const end = new Date(days[days.length - 1].date).setHours(24, 0, 0, 0);
  return rows.filter((row) => row.at.getTime() >= start && row.at.getTime() < end).length;
}
