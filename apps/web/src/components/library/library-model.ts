import type { LibrarySourceRow, WireSegment } from "@/lib/library/types";
import { formatTimecode } from "@/lib/library/export";

/**
 * Pure derivations behind the Library sheet's bands (DOCTRINE 0 rebuild,
 * step 2). Every fact a shelf row states comes from here, so the honesty
 * rules stay unit-testable: a row says only what the ingest actually
 * recorded — no invented chunk counts, no invented "grounds N drafts", and
 * a pre-rider row (no title, no tags, no relevance) degrades to its URL.
 */

/** "ai, hooks , ai" → ["ai", "hooks"] — trimmed, deduped, capped to the ingest schema's 12. */
export function parseTags(raw: string): string[] {
  return [...new Set(raw.split(",").map((tag) => tag.trim()).filter(Boolean))].slice(0, 12);
}

/** Only web origins get a click-out — a non-http uri (local media path) is identity, not a link. */
export function webOrigin(uri: string | null): string | null {
  return uri && /^https?:\/\//.test(uri) ? uri : null;
}

/** The row's identity: the oEmbed title, else the URL, else the id (pre-rider rows). */
export function sourceLead(row: LibrarySourceRow): string {
  return row.title ?? row.uri ?? row.id;
}

/**
 * The sheet's day stamp: "today" · a weekday inside the last week ("Tue") ·
 * "18 Jul" beyond it.
 */
export function dayStamp(iso: string, now: Date): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDay = new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime();
  const daysAgo = Math.round((startOfToday - startOfDay) / 86_400_000);
  if (daysAgo === 0) return "today";
  if (daysAgo > 0 && daysAgo < 7) return at.toLocaleDateString("en-GB", { weekday: "short" });
  return at.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * The sheet's excerpt line for a shelf row — the facts this ingest recorded,
 * in the sheet's order. The sheet's "grounds N drafts" clause has no server
 * count behind it yet, so it is honestly absent rather than invented.
 */
export function sourceFacts(row: LibrarySourceRow): string {
  const parts = ["Video"];
  if (row.segmentCount !== null) {
    parts.push(`${row.segmentCount} segment${row.segmentCount === 1 ? "" : "s"}`);
  }
  if (row.provider) parts.push(row.provider);
  if (row.tags.length > 0) parts.push(row.tags.join(", "));
  return parts.join(" · ");
}

/**
 * The engine's top-scored monitored area for this row (the META-KEY
 * MINI-CONTRACT rider), with its reason for the tooltip. Null until the
 * engine has scored the row — pre-rider rows never invent relevance.
 */
export function topRelevance(row: LibrarySourceRow): { area: string; reason: string } | null {
  if (row.areaRelevance.length === 0) return null;
  const top = [...row.areaRelevance].sort((a, b) => b.score - a.score)[0];
  return { area: top.areaName, reason: top.reason };
}

/** The transcript panel's stamp: segment count, plus the run time when the ingest carried timings. */
export function transcriptStamp(segments: WireSegment[]): string {
  const count = `${segments.length} segment${segments.length === 1 ? "" : "s"}`;
  const endMs = segments[segments.length - 1]?.endMs;
  if (segments.length === 0 || endMs === undefined) return count;
  return `${count} · ${formatTimecode(endMs).slice(0, 8)}`;
}
