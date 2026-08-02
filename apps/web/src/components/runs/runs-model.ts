import { platformLabel, thumbLabel } from "@/components/dashboard/dashboard-model";
import type { FeedRun } from "@/lib/approve-queue/types";
import type { CreateRunWire } from "@/lib/create/client";
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

/** The W1 sheet's seg — All · Live · Waiting · Failed · Published. */
export type RunFilter = "all" | "live" | "waiting" | "failed" | "published";

/**
 * The operator's view knobs (founder s77: "re-introduce the good things (like
 * filters, sort by …) from the old design"). Presentation state only — the
 * derivations above are untouched by them, exactly as Approve's
 * `applyQueueView` is a pure pass over its own rows.
 */
export type RunSort = "newest" | "oldest";

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
  /** What the run requested — what the platform filter narrows by. */
  platforms: string[];
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
  /** Still generating (pending/running, no recorded failure) — the live band + Live filter. */
  live: boolean;
  /** Drafts of this run waiting on the operator — the Waiting filter. */
  waiting: number;
}

/** jsonb on the wire: trust nothing, name only what is actually there. */
export function platformsOf(run: FeedRun): string[] {
  return Array.isArray(run.platforms) ? run.platforms.filter((p): p is string => typeof p === "string") : [];
}

function statusWord(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/** The lead's subject is one row's worth of topic, never a wrapped paragraph. */
const LEAD_TOPIC_CHARS = 46;

/**
 * The row's lead, in the sheet's own grammar: SUBJECT first, platforms second —
 * "Launch film · LinkedIn + X + Facebook", "Blog article · inside the
 * build-step pipeline" (Runs.dc.html draws five leads and every one carries a
 * distinguishing subject).
 *
 * The port derived the lead from platforms ALONE, so on live data 17 of 27 rows
 * read the identical string "Fan-out · Video" and eight consecutive rows in one
 * day card were byte-identical across lead, excerpt, thumb and pill — on the
 * surface whose whole job is answering "which run was that" (s77 finding,
 * runs-model.ts:134).
 *
 * The subject is the run's own first draft excerpt, which is the only
 * run-identifying text the two existing reads carry. A run the plan window does
 * not cover has none, and falls back to today's honest platform-only line
 * rather than to an invented subject.
 */
export function runLead(platforms: string[], assets: PipelineAsset[]): string {
  const spread = platforms.map(platformLabel).join(" + ");
  const raw = assets.map((asset) => asset.excerpt).find((excerpt) => excerpt.trim() !== "");
  if (raw === undefined) return spread === "" ? "Fan-out run" : `Fan-out · ${spread}`;
  const collapsed = raw.replace(/\s+/g, " ").trim();
  const topic =
    collapsed.length <= LEAD_TOPIC_CHARS
      ? collapsed
      : // Cut at a word boundary — a lead clipped mid-word loses information
        // with no cue that anything was lost.
        `${collapsed.slice(0, collapsed.lastIndexOf(" ", LEAD_TOPIC_CHARS - 1) + 1 || LEAD_TOPIC_CHARS).trim()}…`;
  return spread === "" ? topic : `${topic} · ${spread}`;
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
    lead: runLead(platforms, assets),
    platforms,
    excerpt,
    excerptError,
    liveHref: published[0]?.deployRef ?? null,
    pill,
    thumb: assets.map(thumbLabel).find((label) => label !== null) ?? null,
    at: new Date(run.createdAt),
    failed,
    published: published.length > 0,
    retryable: recordedFailure,
    live: !recordedFailure && (run.status === "pending" || run.status === "running"),
    waiting,
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
  if (filter === "live") return rows.filter((row) => row.live);
  if (filter === "waiting") return rows.filter((row) => row.waiting > 0);
  if (filter === "failed") return rows.filter((row) => row.failed);
  if (filter === "published") return rows.filter((row) => row.published);
  return rows;
}

/**
 * Every platform the feed ACTUALLY recorded, label-ordered — so the filter
 * offers only values that can match something, and gains a new platform the
 * day a run requests one (never a hand-kept list).
 */
export function platformOptions(rows: RunRow[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) for (const platform of row.platforms) seen.add(platform);
  return [...seen].sort((a, b) => platformLabel(a).localeCompare(platformLabel(b)));
}

export interface RunView {
  filter: RunFilter;
  /** null = every platform; otherwise the raw platform key, not its label. */
  platform: string | null;
  find: string;
  sort: RunSort;
}

/**
 * The view knobs as ONE pure pass (Approve's `applyQueueView` shape): the
 * sheet's own All/Failed/Published seg, then the two knobs the founder named,
 * then find over the text the row actually shows. Sort is applied by
 * `groupByDay`, which owns row order inside its day groups.
 */
export function applyRunView(rows: RunRow[], view: RunView): RunRow[] {
  const needle = view.find.trim().toLowerCase();
  return filterRows(rows, view.filter).filter((row) => {
    if (view.platform !== null && !row.platforms.includes(view.platform)) return false;
    // Find matches what is ON the row — its lead and its excerpt — so a hit is
    // always visible in the result rather than a match on hidden state.
    return needle === "" || `${row.lead} ${row.excerpt}`.toLowerCase().includes(needle);
  });
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

/**
 * Newest day first, rows newest first inside it — one `.day-hd` + `.card` per
 * day, which is the order the sheet draws. `sort: "oldest"` reverses BOTH
 * levels: a day-grouped list whose groups ran one way and whose rows ran the
 * other would be a third order the operator never asked for.
 */
export function groupByDay(rows: RunRow[], now: Date, sort: RunSort = "newest"): RunDay[] {
  const direction = sort === "oldest" ? -1 : 1;
  const days: RunDay[] = [];
  for (const row of [...rows].sort((a, b) => direction * (b.at.getTime() - a.at.getTime()))) {
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

/* ── The W1 re-shape (Runs.dc.html AMENDED s89; workspace spec §3 ORIENT, §5.8):
   the running-now band (Cloudflare), create-run PARENTS with the family
   nested under them, the five-state seg, and the day-total footer (Clay).
   Deliberately NOT drawn from thin air: per-run cost and durations are on
   the sheet but no read exposes them (usage_ledger has no per-run read;
   runs record no completion instant) — the footer's day total is the cost
   truth that IS on the wire. ── */

/** Elapsed-time word for a live row — "12s" / "3m 42s" / "2h 5m". Real math, never a fixture. */
export function elapsedWord(fromIso: string, now: Date): string {
  const s = Math.max(0, Math.floor((now.getTime() - new Date(fromIso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

/** The brief's operator ask, when the jsonb actually carries one — the parent lead's topic. */
export function briefTopic(brief: unknown): string | null {
  if (typeof brief !== "object" || brief === null) return null;
  const prompt = (brief as { prompt?: unknown }).prompt;
  if (typeof prompt !== "string" || prompt.trim() === "") return null;
  const collapsed = prompt.replace(/\s+/g, " ").trim();
  if (collapsed.length <= LEAD_TOPIC_CHARS) return collapsed;
  return `${collapsed.slice(0, collapsed.lastIndexOf(" ", LEAD_TOPIC_CHARS - 1) + 1 || LEAD_TOPIC_CHARS).trim()}…`;
}

export interface LiveRow {
  id: string;
  lead: string;
  /** The second line — a state the read actually carries, or null. */
  sub: string | null;
  elapsed: string;
  /** The fanout rows keep their receipts door; a create run has no detail surface yet — null, no dead Watch. */
  href: string | null;
}

/** The running-now band: in-flight work from BOTH reads, newest first. */
export function liveRows(rows: RunRow[], createRuns: CreateRunWire[], now: Date): LiveRow[] {
  const fanouts: Array<LiveRow & { at: number }> = rows
    .filter((row) => row.live)
    .map((row) => ({
      id: row.id,
      lead: row.lead,
      sub: row.excerpt || null,
      elapsed: elapsedWord(row.at.toISOString(), now),
      href: row.href,
      at: row.at.getTime(),
    }));
  const creates: Array<LiveRow & { at: number }> = createRuns
    .filter((run) => run.status === "pending" || run.status === "running")
    .map((run) => ({
      id: run.id,
      lead: `Create run · ${briefTopic(run.brief) ?? run.family}`,
      sub: `${run.family} · ${run.mode}`,
      elapsed: elapsedWord(run.createdAt, now),
      href: null,
      at: new Date(run.createdAt).getTime(),
    }));
  return [...fanouts, ...creates]
    .sort((a, b) => b.at - a.at)
    .map((row) => ({ id: row.id, lead: row.lead, sub: row.sub, elapsed: row.elapsed, href: row.href }));
}

/** One nested family output under a create-run parent — the sheet's `.child` row grammar. */
export interface ChildAssetRow {
  draftId: string;
  platform: string;
  /** "post" / "clip plan" — the format opened up, never a fake word. */
  word: string;
  quote: string;
  /** The Hume chip: the judge's outcome for this output, or null before any verdict. */
  judge: "passed" | "blocked" | null;
  pill: RunPill;
  href: string;
}

export interface CreateParentBlock {
  id: string;
  lead: string;
  excerpt: string;
  excerptError: boolean;
  pill: RunPill;
  at: Date;
  thumb: string | null;
  children: ChildAssetRow[];
  /** The parent chip — "judge ✓ N of M" over its family's outputs. */
  judgePassed: number;
  judgeTotal: number;
  waiting: number;
  failed: boolean;
  published: boolean;
  live: boolean;
  /** The parent's door: its family's queue when it has one; null = no dead Open. */
  href: string | null;
  /** Platforms across the family — what the platform filter narrows by. */
  platforms: string[];
}

function childRow(asset: PipelineAsset): ChildAssetRow {
  const status = asset.status;
  const pill: RunPill =
    status === "queued"
      ? { tone: "warn", label: "Waiting" }
      : status === "blocked"
        ? { tone: "err", label: "Blocked" }
        : status === "approved"
          ? { tone: "ok", label: "Approved" }
          : status === "published"
            ? { tone: "ok", label: "Published" }
            : { tone: "idle", label: statusWord(status) };
  return {
    draftId: asset.draftId,
    platform: asset.platform,
    word: (asset.format ?? "post").replace(/_/g, " "),
    quote: asset.excerpt,
    judge: asset.judgedAt === null ? null : status === "blocked" ? "blocked" : "passed",
    pill,
    href: `/app/approve?draft=${encodeURIComponent(asset.draftId)}`,
  };
}

/**
 * Create runs as parent blocks (the s87 window's shape): a parent's family
 * outputs are the plan assets of its child fanout runs plus any direct
 * child drafts. Returns the blocks AND the set of fanout-run ids the
 * parents absorbed — an orphan family run (pre-create era) stays a flat
 * row, never minting a fake parent (the sheet's Thursday rule).
 */
export function createParents(
  createRuns: CreateRunWire[],
  assets: PipelineAsset[],
): { blocks: CreateParentBlock[]; absorbedRunIds: Set<string> } {
  const byRun = assetsByRun(assets);
  const absorbedRunIds = new Set<string>();
  const blocks = createRuns.map((run) => {
    const childRunIds = run.children.filter((c) => c.kind === "fanout_run").map((c) => c.id);
    const childDraftIds = new Set(run.children.filter((c) => c.kind === "draft").map((c) => c.id));
    for (const id of childRunIds) absorbedRunIds.add(id);
    const familyAssets = [
      ...childRunIds.flatMap((id) => byRun.get(id) ?? []),
      ...assets.filter((a) => childDraftIds.has(a.draftId)),
    ];
    const children = familyAssets.map(childRow);
    const judgePassed = children.filter((c) => c.judge === "passed").length;
    const waiting = familyAssets.filter((a) => WAITING.has(a.status)).length;
    const published = familyAssets.some((a) => a.publishedAt !== null);
    const childErrors = run.children.filter((c) => typeof c.error === "string" && c.error !== "");
    const failed = run.status === "failed" || run.lastError !== null || childErrors.length > 0;
    const live = !failed && (run.status === "pending" || run.status === "running");

    const pill: RunPill = failed
      ? { tone: "err", label: "Failed" }
      : waiting > 0
        ? { tone: "warn", label: `${waiting} wait on you` }
        : live
          ? { tone: "idle", label: "Running" }
          : published
            ? { tone: "ok", label: "Published" }
            : { tone: "idle", label: statusWord(run.status) };

    // The error channel carries the RECORDED words: the run's own lastError
    // first, else the first child failure — verbatim, never paraphrased.
    const recorded = run.lastError ?? childErrors[0]?.error ?? null;
    const excerpt =
      recorded ??
      `${run.family} · ${run.mode}${
        children.length > 0
          ? ` · the ${children.length} row${children.length === 1 ? "" : "s"} below are its family`
          : " · no outputs recorded"
      }`;

    return {
      id: run.id,
      lead: `Create run · ${briefTopic(run.brief) ?? run.family}`,
      excerpt,
      excerptError: recorded !== null,
      pill,
      at: new Date(run.createdAt),
      thumb: familyAssets.map(thumbLabel).find((label) => label !== null) ?? null,
      children,
      judgePassed,
      judgeTotal: children.length,
      waiting,
      failed,
      published,
      live,
      href: childRunIds.length > 0 ? `/app/approve?run=${encodeURIComponent(childRunIds[0])}` : null,
      platforms: [...new Set(familyAssets.map((a) => a.platform))],
    };
  });
  return { blocks, absorbedRunIds };
}

/** One history entry: a flat (orphan) run row, or a create-run parent block. */
export type DayItem = { type: "run"; row: RunRow } | { type: "create"; block: CreateParentBlock };

export function itemAt(item: DayItem): Date {
  return item.type === "run" ? item.row.at : item.block.at;
}

/** The view knobs over the MIXED history (the RunRow pass's exact semantics, item-shaped). */
export function applyItemView(items: DayItem[], view: RunView): DayItem[] {
  const needle = view.find.trim().toLowerCase();
  return items.filter((item) => {
    const flags =
      item.type === "run"
        ? item.row
        : {
            live: item.block.live,
            waiting: item.block.waiting,
            failed: item.block.failed,
            published: item.block.published,
          };
    if (view.filter === "live" && !flags.live) return false;
    if (view.filter === "waiting" && !(flags.waiting > 0)) return false;
    if (view.filter === "failed" && !flags.failed) return false;
    if (view.filter === "published" && !flags.published) return false;
    const platforms = item.type === "run" ? item.row.platforms : item.block.platforms;
    if (view.platform !== null && !platforms.includes(view.platform)) return false;
    if (needle === "") return true;
    const text =
      item.type === "run"
        ? `${item.row.lead} ${item.row.excerpt}`
        : `${item.block.lead} ${item.block.excerpt} ${item.block.children.map((c) => c.quote).join(" ")}`;
    return text.toLowerCase().includes(needle);
  });
}

export interface ItemDay {
  key: string;
  heading: string;
  items: DayItem[];
}

/** `groupByDay`, item-shaped — same two-level ordering rule. */
export function groupItemsByDay(items: DayItem[], now: Date, sort: RunSort = "newest"): ItemDay[] {
  const direction = sort === "oldest" ? -1 : 1;
  const days: ItemDay[] = [];
  for (const item of [...items].sort((a, b) => direction * (itemAt(b).getTime() - itemAt(a).getTime()))) {
    const key = dayKey(itemAt(item));
    const day = days.find((d) => d.key === key);
    if (day) day.items.push(item);
    else days.push({ key, heading: dayHeading(itemAt(item), now), items: [item] });
  }
  return days;
}
