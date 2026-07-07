import type { WireSegment } from "./types";

/**
 * Transcript export builders (B6.5) — pure string builders shared by the
 * client (Blob downloads) and tests. Three formats, chosen for what each is
 * FOR: .txt = paste anywhere, .csv = spreadsheets/analysis (RFC-4180
 * quoting), .srt = the interchange format every caption tool reads.
 *
 * Timed formats need real cue times: `hasTimings` gates the CSV/SRT buttons
 * so an untimed (plain-text) ingest never exports invented timestamps.
 */

export function hasTimings(segments: WireSegment[]): boolean {
  return segments.length > 0 && segments.every((s) => s.startMs !== undefined && s.endMs !== undefined);
}

/** Flowing plain text — cue texts joined, whitespace collapsed. */
export function toPlainText(segments: WireSegment[]): string {
  return (
    segments
      .map((s) => s.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim() + "\n"
  );
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** ms → `HH:MM:SS<sep>mmm` (sep "." for CSV readability, "," per the SRT spec). */
export function formatTimecode(ms: number, sep: "." | "," = "."): string {
  const clamped = Math.max(0, Math.round(ms));
  const h = Math.floor(clamped / 3_600_000);
  const m = Math.floor(clamped / 60_000) % 60;
  const s = Math.floor(clamped / 1_000) % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}${sep}${pad(clamped % 1_000, 3)}`;
}

const csvQuote = (value: string) => `"${value.replace(/"/g, '""')}"`;

/** `start_ms,end_ms,start,end,text` — one row per segment. */
export function toCsv(segments: WireSegment[]): string {
  const rows = segments.map((s) =>
    [s.startMs ?? "", s.endMs ?? "", formatTimecode(s.startMs ?? 0), formatTimecode(s.endMs ?? 0), csvQuote(s.text)].join(","),
  );
  return ["start_ms,end_ms,start,end,text", ...rows].join("\n") + "\n";
}

/** Numbered SRT cues (comma millisecond separator per the spec). */
export function toSrt(segments: WireSegment[]): string {
  return (
    segments
      .map((s, i) => `${i + 1}\n${formatTimecode(s.startMs ?? 0, ",")} --> ${formatTimecode(s.endMs ?? 0, ",")}\n${s.text}\n`)
      .join("\n") + "\n"
  );
}

export type ExportFormat = "txt" | "csv" | "srt";

export const EXPORT_BUILDERS: Record<ExportFormat, { build: (s: WireSegment[]) => string; mime: string; timed: boolean }> = {
  txt: { build: toPlainText, mime: "text/plain", timed: false },
  csv: { build: toCsv, mime: "text/csv", timed: true },
  srt: { build: toSrt, mime: "application/x-subrip", timed: true },
};
