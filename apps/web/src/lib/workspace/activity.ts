import type { ActivityItem } from "./types";

/**
 * Humanizes the events spine for the dashboard's live activity feed
 * (docs/FRONTEND.md §3 stickiness 2: the feed ATTRIBUTES work to the engine
 * — visibility of automation is perceived value). Pure and exhaustive-by-
 * fallback: an unmapped event still renders honestly as its raw name.
 */
export interface ActivityView {
  /** Engine-attributed sentence, e.g. "Scout captured a trend snapshot". */
  summary: string;
  /** The workspace surface this event's entity lives on — the provenance link. */
  href: string | null;
  /** Visual grouping for the feed's icon/tone. */
  tone: "engine" | "operator" | "alert";
}

const SURFACE_BY_ENTITY: Record<string, string> = {
  draft: "/app/approve",
  fanout_run: "/app/runs",
  monitored_area: "/app/intel",
  watchlist: "/app/intel",
  trend_snapshot: "/app/intel",
  search_target: "/app/intel?tab=search",
  search_snapshot: "/app/intel?tab=search",
  brand_profile: "/app/profiles",
  source: "/app/runs",
};

function payloadStr(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" ? value : null;
}

/**
 * Provenance links land on the ENTITY, not just its surface (critique
 * 2026-07-14, recognition-over-recall): a draft event deep-links into the
 * approve queue's selection; other entities fall back to their surface.
 */
function entityHref(item: ActivityItem): string | null {
  if (item.entityType === "draft") {
    return `/app/approve?draft=${encodeURIComponent(item.entityId)}`;
  }
  if (item.entityType === "fanout_run") {
    return `/app/runs?run=${encodeURIComponent(item.entityId)}`;
  }
  return SURFACE_BY_ENTITY[item.entityType] ?? null;
}

export function describeActivity(item: ActivityItem): ActivityView {
  const href = entityHref(item);
  const p = item.payload;
  switch (item.event) {
    case "fanout_run.created":
      return { summary: "Engine started a fan-out run", href, tone: "engine" };
    case "fanout_run.last_error_recorded":
      return {
        summary: `Run hit an irrecoverable failure — needs triage${payloadStr(p, "message") ? `: ${payloadStr(p, "message")}` : ""}`,
        href,
        tone: "alert",
      };
    case "fanout_run.last_error_cleared":
      return { summary: "Run recovered — a later pass backfilled it", href, tone: "engine" };
    case "fanout_run.status_changed": {
      // The failure ALERT is last_error_recorded (it carries the message);
      // this row is lifecycle bookkeeping, so it stays engine-tone throughout.
      const to = payloadStr(p, "to");
      if (to === "running") return { summary: "Run started generating", href, tone: "engine" };
      if (to === "complete") return { summary: "Run completed", href, tone: "engine" };
      if (to === "failed") return { summary: "Run marked failed", href, tone: "engine" };
      return { summary: `Run status: ${to ?? "updated"}`, href, tone: "engine" };
    }
    case "draft.created":
      return {
        summary: `Engine drafted for ${payloadStr(p, "platform") ?? "a platform"}`,
        href,
        tone: "engine",
      };
    case "draft.transition": {
      const to = payloadStr(p, "to");
      if (to === "queued") return { summary: "Judge passed a draft — it's in your queue", href, tone: "engine" };
      if (to === "blocked") return { summary: "Judge blocked a draft — it needs your edit", href, tone: "alert" };
      if (to === "approved") return { summary: "You approved a draft", href, tone: "operator" };
      if (to === "rejected") return { summary: "You rejected a draft", href, tone: "operator" };
      if (to === "judging") return { summary: "A draft went back to the judge", href, tone: "engine" };
      return { summary: `Draft moved to ${to ?? "a new state"}`, href, tone: "engine" };
    }
    case "draft.meta_updated":
      return { summary: "Draft metadata updated", href, tone: "engine" };
    case "source.ingested":
      return { summary: "Engine ingested a source", href, tone: "engine" };
    case "source.deleted":
      return { summary: "You deleted a transcript from the library", href: "/app/transcription", tone: "operator" };
    case "trend_snapshot.captured":
      return { summary: "Scout captured a trend snapshot", href, tone: "engine" };
    case "search_snapshot.captured":
      return { summary: `Scout captured search metrics for "${payloadStr(p, "query") ?? "a query"}"`, href, tone: "engine" };
    case "monitored_area.created":
      return { summary: `You started monitoring "${payloadStr(p, "name") ?? "an area"}"`, href, tone: "operator" };
    case "monitored_area.updated":
      return { summary: "You updated a monitored area", href, tone: "operator" };
    case "watchlist.created":
      return { summary: "Watchlist created", href, tone: "operator" };
    case "watchlist.updated":
      return { summary: "Watchlist updated", href, tone: "operator" };
    case "search_target.created": {
      const keyword = payloadStr(p, "keyword");
      const origin = payloadStr(p, "origin");
      return {
        summary:
          origin === "operator"
            ? `You added keyword target "${keyword ?? "?"}"`
            : `Engine compiled keyword target "${keyword ?? "?"}"`,
        href,
        tone: origin === "operator" ? "operator" : "engine",
      };
    }
    case "search_target.status_changed":
      return {
        summary: `Keyword target ${payloadStr(p, "status") === "dismissed" ? "dismissed" : "reactivated"}`,
        href,
        tone: "operator",
      };
    case "brand_profile.created":
      return { summary: "Brand profile version saved", href, tone: "operator" };
    case "budget.exceeded":
      return { summary: "Daily token budget exceeded — generation halted", href: "/app/settings", tone: "alert" };
    case "waitlist.joined":
      return { summary: "Someone joined the waitlist", href: null, tone: "engine" };
    default:
      return { summary: item.event, href, tone: "engine" };
  }
}
