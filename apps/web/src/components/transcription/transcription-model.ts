import type { LibrarySourceRow, WireSegment } from "@/lib/library/types";
import { formatTimecode } from "@/lib/library/export";

/**
 * Pure derivations behind the Transcription surface's bands, whose sheet is
 * still Library.dc.html (DOCTRINE 0 rebuild,
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

/**
 * What a FREE ingest gives up, in the row's own words (s86 — transcription is
 * free + deterministic by default, founder ruling s79).
 *
 * The absence this explains is real: a free source has no chunk embeddings, so
 * it is never scored against the monitored areas and `topKSimilarChunks` skips
 * it outright. Left unexplained, the missing "relevant to …" clause reads as an
 * area that scored nothing — a measurement that never happened. So the words
 * appear only when the row can actually carry them: `aiEnhanced === false` is
 * the operator's recorded choice, while `undefined` (every row ingested before
 * the key existed) claims nothing, and a row that somehow has both a `false`
 * flag and real scores shows the SCORES — data beats a flag.
 */
export function freeIngestNote(row: LibrarySourceRow): string | null {
  if (row.aiEnhanced !== false || row.areaRelevance.length > 0) return null;
  return "free ingest — no relevance score, not semantically retrievable";
}

/* ── THE VIEW KNOBS (founder s77: "re-introduce the good things (like filters,
   sort by …) from the old design"; the s77 fan-out reached the same gap here
   independently — "an unbounded shelf with no search, no filter and no sort").
   Pure so the narrowing is unit-testable, and ONE grammar with lane 1's three
   surfaces: Approve's `.sel-ctl` pickers plus a find box.

   The verify round (T3 2/3) killed the finding's other half: the per-row tags
   are NOT chip-shaped, so they are not a lying control — they are prose inside
   a nowrap `.excerpt` that clips them out of view. The fix is therefore a real
   tag control in the band, never the row text restyled into chips. ── */

export type ShelfSort = "newest" | "oldest" | "title";

export interface ShelfFilters {
  find: string;
  /** "" = every tag; otherwise the one tag being filtered on. */
  tag: string;
  sort: ShelfSort;
}

export const SHELF_DEFAULTS: ShelfFilters = { find: "", tag: "", sort: "newest" };

/** Every tag on the shelf, deduped and sorted — the tag filter's own vocabulary. */
export function shelfTags(rows: LibrarySourceRow[]): string[] {
  return [...new Set(rows.flatMap((row) => row.tags))].sort((a, b) => a.localeCompare(b));
}

/** True when any knob is off its default — what the surface must SAY it is doing. */
export function shelfNarrowed(filters: ShelfFilters): boolean {
  return filters.find.trim() !== "" || filters.tag !== "";
}

/**
 * Find matches the row's identity, its URL and its tags — the three things an
 * operator would type. Sort defaults to the route's own newest-first.
 */
export function applyShelfFilters(
  rows: LibrarySourceRow[],
  filters: ShelfFilters,
): LibrarySourceRow[] {
  const needle = filters.find.trim().toLowerCase();
  const matched = rows.filter((row) => {
    if (filters.tag !== "" && !row.tags.includes(filters.tag)) return false;
    if (needle === "") return true;
    const haystack = [sourceLead(row), row.uri ?? "", ...row.tags].join(" ").toLowerCase();
    return haystack.includes(needle);
  });
  const at = (row: LibrarySourceRow) => new Date(row.createdAt).getTime();
  return [...matched].sort((a, b) => {
    if (filters.sort === "title") return sourceLead(a).localeCompare(sourceLead(b));
    return filters.sort === "oldest" ? at(a) - at(b) : at(b) - at(a);
  });
}

/** The knob's own word, for the `.sel-ctl` chip face. */
export const SHELF_SORT_WORDS: Record<ShelfSort, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  title: "Title A–Z",
};

/** The transcript panel's stamp: segment count, plus the run time when the ingest carried timings. */
export function transcriptStamp(segments: WireSegment[]): string {
  const count = `${segments.length} segment${segments.length === 1 ? "" : "s"}`;
  const endMs = segments[segments.length - 1]?.endMs;
  if (segments.length === 0 || endMs === undefined) return count;
  return `${count} · ${formatTimecode(endMs).slice(0, 8)}`;
}
