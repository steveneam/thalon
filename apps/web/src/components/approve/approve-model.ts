import { computeJudgeBadge, type JudgeGateStatus } from "@/lib/approve-queue/judge-badge";
import { gateLabel, type JudgeResultWithEvidence } from "@/lib/approve-queue/judge-reasons";
import { parseClipPlanMeta, formatMsAsClock } from "@/lib/approve-queue/formats/clip-plan";
import type { FeedRun, GridDraft } from "@/lib/approve-queue/types";
import { platformLabel } from "@/lib/workspace/format";

/**
 * Pure derivations behind the Approve surface's exact-mock rebuild — every
 * string the sheet (docs/research/mock-sheets/Approve.dc.html) puts on a row
 * or in the detail head, computed from real draft/run/judge data. Kept
 * separate from the components so the sheet's copy grammar is unit-testable
 * (the dashboard-model.ts precedent).
 */

/** One row of the flat approve queue: the draft plus the run it belongs to (lineage + seats context). */
export interface QueueItem {
  draft: GridDraft;
  run: FeedRun;
}

export type QueueSort = "newest" | "oldest";

/**
 * The W1 sheet's state tabs (Reddit's mod queue): status filtering moved
 * from the header picker onto the queue card as tabs with live counts, and
 * grew the two decided states. "Waiting" is the operator's word for
 * `queued` (judge-passed, needs you); "Approved" includes `published` —
 * a published draft passed this gate and its pill still says Published.
 * States outside the five tabs (`judging`, `generated`) show under All only.
 */
export type QueueFilter = "all" | "waiting" | "blocked" | "approved" | "rejected";

/** The sheet's picker copy — the visible label of each option. */
export const SORT_OPTIONS: ReadonlyArray<{ value: QueueSort; label: string }> = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];
export const QUEUE_TABS: ReadonlyArray<{ value: QueueFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "waiting", label: "Waiting" },
  { value: "blocked", label: "Blocked" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

function matchesFilter(draft: GridDraft, filter: QueueFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "waiting":
      return draft.status === "queued";
    case "blocked":
      return draft.status === "blocked";
    case "approved":
      return draft.status === "approved" || draft.status === "published";
    case "rejected":
      return draft.status === "rejected";
  }
}

/** Every tab's live count over the UNFILTERED queue — the `.qtab .n` numbers. */
export function queueTabCounts(items: QueueItem[]): Record<QueueFilter, number> {
  const counts: Record<QueueFilter, number> = { all: 0, waiting: 0, blocked: 0, approved: 0, rejected: 0 };
  for (const { draft } of items) {
    for (const tab of QUEUE_TABS) {
      if (matchesFilter(draft, tab.value)) counts[tab.value] += 1;
    }
  }
  return counts;
}

/**
 * The header's second picker (the W1 sheet's "All families"): the content
 * FAMILY lens, keyed on the draft's format in the engine's own vocabulary —
 * social platform drafts (plain posts + clip plans), site articles, outreach
 * email, and the video-arc artifacts (storyboard / direction doc / demo plan).
 */
export type QueueFamily = "all" | "social" | "page" | "email" | "video";

export const FAMILY_OPTIONS: ReadonlyArray<{ value: QueueFamily; label: string }> = [
  { value: "all", label: "All families" },
  { value: "social", label: "Social" },
  { value: "page", label: "Articles" },
  { value: "email", label: "Email" },
  { value: "video", label: "Video" },
];

export function familyOf(draft: GridDraft): Exclude<QueueFamily, "all"> {
  switch (draft.format) {
    case "web_page":
      return "page";
    case "outreach_email":
      return "email";
    case "storyboard":
    case "direction_doc":
    case "demo_plan":
      return "video";
    default:
      // A plain post (format null) or a clip plan — a social platform draft.
      return "social";
  }
}

/** Waiting on the operator = judge-passed (queued) or judge-blocked. */
export function isWaiting(draft: GridDraft): boolean {
  return draft.status === "queued" || draft.status === "blocked";
}

/**
 * Why the header's "N waiting" and the bulk button's "(M)" are different
 * numbers — stated on screen instead of left as an 11-row silent gap.
 *
 * The two counts describe genuinely different sets and both are true: the
 * pill counts every queued draft (the same set the rail's "Needs you" and
 * the pulse count), while batch approve acts only on the CURRENT VIEW and
 * deliberately skips stage artifacts, which advance through their own
 * staged surface. Live s79: "13 waiting" beside "Approve all waiting (2)",
 * with nothing anywhere naming the other 11.
 *
 * Returns null when the numbers agree — the sentence only exists when there
 * is a gap to explain.
 */
export function batchScopeNote(counts: {
  /** Every queued draft in the queue — the header pill's number. */
  waiting: number;
  /** What the bulk button will actually act on — the view's non-staged queued drafts. */
  batchable: number;
  /** Queued drafts excluded because they are stage artifacts. */
  stagedWaiting: number;
}): string | null {
  const { waiting, batchable, stagedWaiting } = counts;
  if (waiting === batchable) return null;
  const parts: string[] = [];
  if (stagedWaiting > 0) {
    parts.push(
      stagedWaiting === 1
        ? "1 staged draft advances through its own flow"
        : `${stagedWaiting} staged drafts advance through their own flow`,
    );
  }
  // Anything left over is the filter narrowing the view — named separately so
  // a filtered view never reads as if staged work explained the whole gap.
  const narrowed = waiting - batchable - stagedWaiting;
  if (narrowed > 0) parts.push(`${narrowed} sit outside this view`);
  if (parts.length === 0) return null;
  return `${batchable} of ${waiting} waiting can be approved together — ${parts.join(", ")}.`;
}

/**
 * Wire status → the sheet's pill (word + channel). The sheet draws three:
 * Waiting (amber = needs you), Blocked (red), Approved (green); the states
 * it does not draw keep their own honest word on the neutral channel —
 * never dressed as one of the three.
 */
export function statusPill(status: string): { word: string; cls: string } {
  switch (status) {
    case "queued":
      return { word: "Waiting", cls: "pill-warn" };
    case "blocked":
      return { word: "Blocked", cls: "pill-err" };
    case "approved":
      return { word: "Approved", cls: "pill-ok" };
    case "published":
      return { word: "Published", cls: "pill-ok" };
    case "rejected":
      // The W1 sheet draws Rejected as the BARE pill — decided, quiet, no channel.
      return { word: "Rejected", cls: "" };
    default:
      return { word: status.charAt(0).toUpperCase() + status.slice(1), cls: "pill-idle" };
  }
}

/** The sheet writes platforms as their brand names ("LinkedIn", "X", "Blog"), never the wire token. */
// One home for the label map (lib/workspace/format.ts); re-exported so the
// surfaces and tests that import it from this model keep working.
export { platformLabel };

/** The sheet's format words. A plain draft (format null) is a "post". */
const FORMAT_WORDS: Record<string, string> = {
  post: "post",
  web_page: "article",
  demo_plan: "demo",
  outreach_email: "email",
  storyboard: "storyboard",
  direction_doc: "direction",
};

/**
 * The row's format word — "post" / "article" / "clip 0:12–0:47" (the sheet
 * folds a clip plan's window into the word itself). Unknown formats read
 * as their own wire token with underscores opened up, never a fake word.
 */
export function formatWord(draft: GridDraft): string {
  if (draft.format === "clip_plan") {
    const meta = parseClipPlanMeta(draft.meta);
    if (meta) return `clip ${formatMsAsClock(meta.startMs)}–${formatMsAsClock(meta.endMs)}`;
    return "clip";
  }
  if (!draft.format) return "post";
  return FORMAT_WORDS[draft.format] ?? draft.format.replace(/_/g, " ");
}

/**
 * The detail head's window label — the sheet's "0:12–0:47 · 35s". Only a
 * clip plan carries one; every other format leaves the slot empty rather
 * than inventing a stat for it.
 */
export function headWindow(draft: GridDraft): string | null {
  if (draft.format !== "clip_plan") return null;
  const meta = parseClipPlanMeta(draft.meta);
  if (!meta) return null;
  const seconds = Math.round(meta.durationMs / 1000);
  return `${formatMsAsClock(meta.startMs)}–${formatMsAsClock(meta.endMs)} · ${seconds}s`;
}

/**
 * The striped placeholder label for a media-bearing draft (the sheet's
 * media-first grammar, doctrine 1). Drafts carry NO media ref on the wire
 * today, so every media slot is honestly a placeholder naming what belongs
 * there — the founder's own instruction ("put in any placeholders like the
 * thumbnails … if the backend is not ready yet"). Text-only formats get no
 * slot at all, exactly as the sheet draws its two plain post rows.
 */
export function thumbLabel(draft: GridDraft): string | null {
  switch (draft.format) {
    case "clip_plan":
      return "clip frame";
    case "web_page":
      return "page hero";
    case "demo_plan":
      return "demo capture";
    case "storyboard":
      return "storyboard frame";
    default:
      return null;
  }
}

/** First line of the draft body — the row's title (bodies open with the hook). */
export function rowTitle(body: string): string {
  const firstLine = body.split("\n", 1)[0].trim();
  return firstLine.length > 0 ? firstLine : "(empty draft)";
}

/**
 * The row's quoted excerpt — the NEXT non-empty line after the title, which
 * is what the sheet quotes beside the platform/format words (founder s71:
 * excerpts over abstractions). A one-line draft has nothing more to quote.
 */
export function rowQuote(body: string): string | null {
  const rest = body
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return rest[0] ?? null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * The sheet's stamp grammar — "4 Jul, 09:00": the EXACT local date and time
 * a draft was created, never a relative age (founder s66). App adaptation:
 * the sheet's fixture is all one year, so it drops the year; a real queue
 * can hold rows from another one, and those carry it ("4 Jul 2025, 09:00")
 * rather than reading as this year's.
 */
export function formatStamp(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = d.getFullYear() === now.getFullYear() ? "" : ` ${d.getFullYear()}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${year}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * The operator's view over the flat queue (founder s66): NEWEST first by
 * default, with the sort switchable, the state tabs (W1), and the family
 * picker — presentation only, the stored list stays the stable ascending
 * flatten.
 */
export function applyQueueView(
  items: QueueItem[],
  sort: QueueSort,
  filter: QueueFilter,
  family: QueueFamily = "all",
): QueueItem[] {
  const filtered = items.filter(
    (i) => matchesFilter(i.draft, filter) && (family === "all" || familyOf(i.draft) === family),
  );
  return sort === "oldest" ? filtered : [...filtered].reverse();
}

/* ── Run groups (the W1 sheet's `.run-hd` band — Deel's batch-verb-with-count) ── */

export interface RunGroup {
  run: FeedRun;
  items: QueueItem[];
}

/**
 * CONSECUTIVE view rows sharing a run become one group — the view's order
 * is the truth, never re-sorted for grouping, so a run whose drafts
 * interleave with another's under a sort honestly appears twice.
 */
export function groupByRun(view: QueueItem[]): RunGroup[] {
  const groups: RunGroup[] = [];
  for (const item of view) {
    const last = groups[groups.length - 1];
    if (last && last.run.id === item.run.id) last.items.push(item);
    else groups.push({ run: item.run, items: [item] });
  }
  return groups;
}

/**
 * The group band's copy — "Run · 4 Jul, 09:00 · 2 drafts". The sheet's
 * fixture also names the run's subject ("launch video"); no read exposes a
 * run's source subject yet, so the band carries what IS on the wire rather
 * than an invented word (the "diff not on the wire" precedent).
 */
export function runGroupLabel(group: RunGroup): string {
  const n = group.items.length;
  return `Run · ${formatStamp(group.run.createdAt)} · ${n} draft${n === 1 ? "" : "s"}`;
}

/**
 * The flat queue: every draft of every feed run in one stable-sorted list
 * (ascending by age here; the VIEW decides direction). Ties (fixture-shaped
 * data) break on platform then id for a stable walk.
 */
export function flattenQueue(perRun: QueueItem[][]): QueueItem[] {
  return perRun.flat().sort((a, b) => {
    const at = new Date(a.draft.createdAt).getTime();
    const bt = new Date(b.draft.createdAt).getTime();
    return at - bt || a.draft.platform.localeCompare(b.draft.platform) || a.draft.id.localeCompare(b.draft.id);
  });
}

/**
 * Default selection honors the dashboard's promise (critique P1, s39): "N
 * drafts wait on you" must land ON waiting work — the first waiting draft
 * in VIEW order, scoped to runs whose server-derived `waiting` count claims
 * operator work (the staged demo run deliberately reports waiting: 0 so the
 * fixture flow never hijacks the mount — the count-agreement invariant).
 */
export function defaultSelection(items: QueueItem[]): string | null {
  const waiting = items.find((item) => item.run.waiting > 0 && isWaiting(item.draft));
  return (waiting ?? items[0])?.draft.id ?? null;
}

/* ── The version strip (VISIBLE PROVENANCE, plan §5 doctrine 4b) ───────── */

export interface VersionStrip {
  /** How many distinct bodies the judge has verdicts for, plus the current one when it is newer. */
  total: number;
  /** 1-based index of the draft's CURRENT body among them. */
  current: number;
  /** True once the operator's edit produced a body beyond the engine's v1. */
  edited: boolean;
  /** True when the judge has verdicts for the draft's current body (invariant I1). */
  reJudged: boolean;
}

/**
 * Body versions read off the judge's own record: each distinct body_hash the
 * judge ever ran on is a version, ordered by when it was first judged. v1 is
 * the engine draft; any later version exists because the operator edited
 * (the only path that changes a draft's body). A current body with no
 * verdicts yet is honestly its own, un-judged version.
 */
export function versionStrip(draft: GridDraft, results: JudgeResultWithEvidence[]): VersionStrip {
  const firstSeen = new Map<string, number>();
  for (const r of results) {
    const at = new Date(r.createdAt).getTime();
    const prev = firstSeen.get(r.bodyHash);
    if (prev === undefined || at < prev) firstSeen.set(r.bodyHash, at);
  }
  const ordered = [...firstSeen.entries()].sort((a, b) => a[1] - b[1]).map(([hash]) => hash);
  const index = ordered.indexOf(draft.bodyHash);
  const reJudged = index !== -1;
  const total = reJudged ? ordered.length : ordered.length + 1;
  const current = reJudged ? index + 1 : total;
  return { total, current, edited: current > 1, reJudged };
}

/* ── The checks band (the sheet's per-gate row) ────────────────────────── */

/** Gates the sheet names but `judge-reasons` has no label for (the advisory lenses land here). */
const EXTRA_GATE_LABELS: Record<string, string> = {
  discoverability: "Discoverability",
  seo_aeo: "Discoverability — page",
};

export function checkLabel(gate: string): string {
  return EXTRA_GATE_LABELS[gate] ?? gateLabel(gate);
}

/**
 * The ADVISORY lenses — they warn, they never block: the pipeline appends
 * their row for operator triage and the queued/blocked outcome never reads
 * it (proprietary/judge/src/pipeline.ts; invariant I1 stays g3_final-only).
 * `cadence` is deliberately NOT here — a failing cadence gate transitions
 * the draft to `blocked`, so it wears the blocking ✗ like the tiers do.
 */
const ADVISORY_GATES = new Set(["discoverability", "seo_aeo"]);

export interface CheckMark {
  gate: string;
  label: string;
  status: JudgeGateStatus;
  /** Advisory gates warn instead of failing — the sheet's ◐ in amber. */
  advisory: boolean;
  /** The recorded reason lines for this gate, VERBATIM — never paraphrased. */
  lines: string[];
  /** The sheet's tooltip: the gate code, plus what an advisory gate means. */
  title: string;
}

interface EvidenceClaim {
  claim?: unknown;
  verdict?: unknown;
  evidence?: unknown;
}

/** Reason lines from a recorded evidence blob — structural reads only, an honest fallback line rather than a crash. */
function evidenceLines(result: JudgeResultWithEvidence | undefined, status: JudgeGateStatus): string[] {
  if (!result || status === "pending") return ["no verdict yet for the current body"];
  const ev = result.evidence as { claims?: unknown; notes?: unknown } | null;
  const claims = Array.isArray(ev?.claims) ? (ev.claims as EvidenceClaim[]) : [];
  const lines: string[] = [];
  for (const c of claims) {
    const claim = typeof c.claim === "string" && c.claim.length > 0 ? c.claim : null;
    const detail = typeof c.evidence === "string" && c.evidence.length > 0 ? c.evidence : null;
    const line = claim && detail ? `${claim} — ${detail}` : (claim ?? detail);
    if (line) lines.push(line);
  }
  if (lines.length === 0) {
    const notes = typeof ev?.notes === "string" && ev.notes.length > 0 ? ev.notes : null;
    lines.push(
      notes ??
        (status === "pass"
          ? "passed — no claims recorded for this check"
          : "failed without recorded detail — re-judge to get a fresh verdict"),
    );
  }
  return lines;
}

/** The first FAILING claim's line — what the sheet puts beside a warning check. */
function firstFailingLine(result: JudgeResultWithEvidence | undefined): string | null {
  const ev = result?.evidence as { claims?: unknown } | null;
  const claims = Array.isArray(ev?.claims) ? (ev.claims as EvidenceClaim[]) : [];
  for (const c of claims) {
    if (c.verdict !== "fail") continue;
    const detail = typeof c.evidence === "string" && c.evidence.length > 0 ? c.evidence : null;
    if (detail) return detail;
  }
  return null;
}

/** The draft's declared discoverability targets, in order (meta.targetTerms — generation writes them, Phase 2c). */
export function targetTerms(draft: GridDraft): string[] {
  const meta = draft.meta && typeof draft.meta === "object" ? (draft.meta as Record<string, unknown>) : null;
  const terms = meta?.targetTerms;
  if (!Array.isArray(terms)) return [];
  return terms.filter((t): t is string => typeof t === "string" && t.trim() !== "");
}

/**
 * The sheet's checks band: the blocking gates first (denylist, both
 * grounding tiers) then every advisory lens the judge recorded for this
 * body. Only rows for the draft's CURRENT bodyHash are live evidence
 * (SPINE invariant I1) — a stale verdict from before an edit never shows.
 */
export function checkMarks(draft: GridDraft, results: JudgeResultWithEvidence[]): CheckMark[] {
  const { gates } = computeJudgeBadge(results, draft.bodyHash);

  const latestByGate = new Map<string, JudgeResultWithEvidence>();
  for (const r of results) {
    if (r.bodyHash !== draft.bodyHash) continue;
    const prev = latestByGate.get(r.gate);
    if (!prev || new Date(r.createdAt).getTime() >= new Date(prev.createdAt).getTime()) {
      latestByGate.set(r.gate, r);
    }
  }
  // Gates outside the badge's map still belong on the band, named: the
  // advisory lenses (which never move the queued/blocked outcome) AND
  // cadence (which does). Anything the judge recorded for this body is
  // shown — a gate the operator can't see is a gate they can't trust.
  const extraGates = [...latestByGate.keys()].filter((g) => !(g in gates));

  const terms = targetTerms(draft);
  return [...Object.keys(gates), ...extraGates].map((gate) => {
    const result = latestByGate.get(gate);
    const status: JudgeGateStatus = gates[gate] ?? ((result?.verdict as JudgeGateStatus) ?? "pending");
    const advisory = ADVISORY_GATES.has(gate);
    const failing = status === "fail" ? firstFailingLine(result) : null;
    const label = checkLabel(gate) + (failing ? ` — ${failing}` : "");
    return {
      gate,
      label,
      status,
      advisory,
      lines: evidenceLines(result, status),
      title:
        gate === "discoverability"
          ? `discoverability · advisory — warns, never blocks${terms.length > 0 ? ` · targets: ${terms.join(" · ")}` : " · no targets declared"}`
          : advisory
            ? `${gate} · advisory — warns, never blocks`
            : gate,
    };
  });
}

/** The rule behind the two COMPOSITE blocks, stated in operator copy (never a bare code). */
const OVERALL_NOTES: Record<string, string> = {
  blocked_disagreement:
    "The two grounding tiers returned different verdicts — the gate blocks until they agree, never silently passes.",
  blocked_overlap: "Verbatim exemplar reuse detected — a distinct, harder block than an ordinary fail.",
};

/**
 * A composite block is not visible in any single gate's row — the draft
 * blocks because the gates DISAGREE, or because exemplar reuse is its own
 * harder verdict. The receipt states that rule rather than leaving the
 * operator to infer it from a band of passes.
 */
export function overallNote(draft: GridDraft, results: JudgeResultWithEvidence[]): string | null {
  const { overall } = computeJudgeBadge(results, draft.bodyHash);
  return OVERALL_NOTES[overall] ?? null;
}

/** The sheet's check mark: ✓ pass · ✗ blocking fail · ◐ advisory warning · · pending. */
export function checkGlyph(mark: CheckMark): string {
  if (mark.status === "pass") return "✓";
  if (mark.status === "pending") return "·";
  return mark.advisory ? "◐" : "✗";
}
