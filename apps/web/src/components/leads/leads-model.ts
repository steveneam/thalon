import { heatBand } from "@/components/intel/heat-grade";
import type { FeedRun, GridDraft } from "@/lib/approve-queue/types";
import type { LeadCard } from "@/lib/leads/types";

/**
 * Pure view-model for the rebuilt Leads surface — everything the sheet's
 * bands need derived from the wire, and nothing that touches the DOM. Kept
 * beside the surface (the Create/Approve convention) so each rule is
 * unit-testable and the component stays the sheet's markup.
 *
 * The rule throughout: derive, never invent. A field the wire doesn't carry
 * produces null/[] here and the surface states the gap — it never fabricates
 * a value to fill the fixture.
 */

/** The draft format outreach composes write (engine outreach/compose.ts). */
export const OUTREACH_FORMAT = "outreach_email";

/** The sheet's mono badge: two letters, from whatever identity the lead actually has. */
export function leadInitials(lead: LeadCard): string {
  const source = lead.name?.trim() || lead.company?.trim() || lead.email;
  const words = source.split(/[\s@._-]+/).filter(Boolean);
  const letters =
    words.length >= 2 ? `${words[0][0]}${words[1][0]}` : (words[0] ?? source).slice(0, 2);
  return letters.toUpperCase();
}

/** The sheet's `Mara Kessler · Fieldline Robotics` — whichever halves exist. */
export function leadTitle(lead: LeadCard): string {
  const parts = [lead.name?.trim(), lead.company?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : lead.email;
}

/**
 * The sheet's row excerpt (`Ops lead · asked about content automation…`) —
 * the role plus what the lead actually needs. Falls back to the email so a
 * bare imported row still says who it is rather than rendering empty.
 */
export function leadExcerpt(lead: LeadCard): string {
  const parts = [lead.role?.trim(), lead.painPoint?.trim() || lead.notes?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : lead.email;
}

/** The sheet paints its score bars off the same thermal bands the workspace grades by. */
export function heatColor(score: number): string {
  return `var(--heat-${heatBand(score)})`;
}

export interface ScoreReason {
  /** The sheet's `.rname` cell — the signal and its value ("fit 0.5"). */
  name: string;
  /** 0–1 when the reason states one; null for the reasons that carry no magnitude. */
  value: number | null;
  /** The sheet's third column — why the signal landed where it did. */
  detail: string;
  /** The scorer's line, untouched, for the row's title (nothing is lost in the split). */
  verbatim: string;
}

/** `fit 0.5 (role "Owner" matches "owner")` → name/value/detail, losslessly titled. */
export function parseScoreReason(reason: string): ScoreReason {
  const numeric = /^([A-Za-z][A-Za-z ]*?)\s+(\d+(?:\.\d+)?)\b\s*(.*)$/.exec(reason);
  if (numeric) {
    const [, label, value, rest] = numeric;
    const unwrapped = /^\((.*)\)$/.exec(rest.trim());
    return {
      name: `${label} ${value}`,
      value: Number(value),
      detail: unwrapped ? unwrapped[1] : rest.trim(),
      verbatim: reason,
    };
  }
  // Disarmed signals, dealbreakers and the learned-adjustment line carry no
  // magnitude: split at the first word so the grid keeps its geometry and the
  // sentence keeps every one of its own words.
  const space = reason.indexOf(" ");
  return space === -1
    ? { name: reason, value: null, detail: "", verbatim: reason }
    : {
        name: reason.slice(0, space),
        value: null,
        detail: reason.slice(space + 1),
        verbatim: reason,
      };
}

export function scoreReasons(lead: LeadCard): ScoreReason[] {
  return lead.reasons.map(parseScoreReason);
}

export interface ActivityRow {
  text: string;
  at: string;
}

const SOURCE_LABELS: Readonly<Record<string, string>> = {
  csv: "CSV import",
  waitlist: "waitlist signup",
  api: "the API",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

/**
 * The sheet's Activity column, from the events the lead spine actually
 * records: intake and scoring. Opens, clicks and replies are NOT stored
 * anywhere today — the surface says so rather than inventing a timeline.
 */
export function activityRows(lead: LeadCard): ActivityRow[] {
  const rows: ActivityRow[] = [];
  if (lead.scoredAt !== null && lead.score !== null) {
    rows.push({
      text: `Scored ${lead.score.toFixed(2)} against your ICP`,
      at: lead.scoredAt,
    });
  }
  rows.push({ text: `First seen — ${sourceLabel(lead.source)}`, at: lead.createdAt });
  return rows;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The sheet's `Tue · 22 Jul` stamp. UTC, so a server-stamped instant reads the same everywhere. */
export function sheetDate(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  return `${WEEKDAYS[at.getUTCDay()]} · ${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]}`;
}

/**
 * The compose door records the lead on its run (`params.leadId`, engine
 * outreach/compose.ts), so a lead's drafted outreach is reachable through the
 * EXISTING run clients — no new route, and only ONE extra drafts read, for
 * the newest run belonging to the selected lead.
 */
export function outreachRunFor(runs: FeedRun[], leadId: string): FeedRun | null {
  const mine = runs.filter((run) => {
    const params = run.params as { leadId?: unknown } | null;
    return params !== null && typeof params === "object" && params.leadId === leadId;
  });
  if (mine.length === 0) return null;
  return [...mine].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
}

export function outreachDraftOf(drafts: GridDraft[], leadId: string): GridDraft | null {
  const mine = drafts.filter((draft) => {
    if (draft.format !== OUTREACH_FORMAT) return false;
    const meta = draft.meta as { recipient?: { leadId?: unknown } } | null;
    return meta?.recipient?.leadId === leadId;
  });
  if (mine.length === 0) return null;
  return [...mine].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
}

export interface DraftEmail {
  subject: string;
  body: string;
}

/**
 * The judged email as the operator sends it. `meta.subject`/`meta.emailBody`
 * are what compose wrote; `draft.body` (subject + blank line + body, the
 * judge's claim surface) is the fallback when an older draft predates them.
 */
export function draftEmail(draft: GridDraft): DraftEmail {
  const meta = draft.meta as { subject?: unknown; emailBody?: unknown } | null;
  const subject = typeof meta?.subject === "string" ? meta.subject : null;
  const body = typeof meta?.emailBody === "string" ? meta.emailBody : null;
  if (subject !== null && body !== null) return { subject, body };
  const split = draft.body.indexOf("\n\n");
  return split === -1
    ? { subject: subject ?? "", body: body ?? draft.body }
    : {
        subject: subject ?? draft.body.slice(0, split),
        body: body ?? draft.body.slice(split + 2),
      };
}

/** The operator's own mailbox — the send is never ours to make. */
export function mailtoHref(email: string, draft: DraftEmail): string {
  const params = new URLSearchParams({ subject: draft.subject, body: draft.body });
  return `mailto:${email}?${params.toString().replace(/\+/g, "%20")}`;
}

/** What the judge did to this draft, in the sheet's pill grammar. */
export function judgePill(status: string): { text: string; className: string } {
  switch (status) {
    case "queued":
      return { text: "judge passed", className: "pill pill-ok" };
    case "approved":
    case "scheduled":
    case "published":
      return { text: `judge passed · ${status}`, className: "pill pill-ok" };
    case "blocked":
      return { text: "judge blocked", className: "pill pill-err" };
    case "rejected":
      return { text: "you rejected it", className: "pill pill-idle" };
    default:
      return { text: `at the judge · ${status}`, className: "pill pill-idle" };
  }
}
