import type { WireSegment } from "./types";

/**
 * Transcript export builders (B6.5 + the Deliverable-D rider) — pure string
 * builders shared by the client (Blob downloads + copy-all) and tests.
 * Formats, chosen for what each is FOR: .md = the AI brief (the headline —
 * transcripts here get fed to agents), .txt = paste anywhere, .csv =
 * spreadsheets/analysis (RFC-4180 quoting), .srt = the interchange format
 * every caption tool reads.
 *
 * Timed formats need real cue times: `hasTimings` gates the CSV/SRT buttons
 * so an untimed (plain-text) ingest never exports invented timestamps.
 */

export function hasTimings(segments: WireSegment[]): boolean {
  return segments.length > 0 && segments.every((s) => s.startMs !== undefined && s.endMs !== undefined);
}

/**
 * Paragraph merge (shared by .md and .txt): cue-per-line transcripts are
 * unreadable to humans and token-wasteful to agents, so segments merge into
 * paragraphs. Break on a speech gap (> 2s of silence = a real pause), or on
 * a rolling window — past ~75s prefer the next sentence boundary, at ~90s
 * break regardless. Untimed ingests use character windows with the same
 * sentence-boundary preference (their gaps/spans are unknowable — never
 * invented).
 */
const GAP_BREAK_MS = 2_000;
const SOFT_WINDOW_MS = 75_000;
const HARD_WINDOW_MS = 90_000;
const SOFT_WINDOW_CHARS = 500;
const HARD_WINDOW_CHARS = 800;

const endsSentence = (text: string) => /[.!?…]["')\]]?\s*$/.test(text);

export interface TranscriptParagraph {
  /** First cue's start — undefined on untimed ingests (no stamp is rendered). */
  startMs?: number;
  text: string;
}

export function toParagraphs(segments: WireSegment[]): TranscriptParagraph[] {
  const timed = hasTimings(segments);
  const paragraphs: TranscriptParagraph[] = [];
  let current: WireSegment[] = [];

  const flush = () => {
    if (current.length === 0) return;
    paragraphs.push({
      startMs: timed ? current[0].startMs : undefined,
      text: current
        .map((s) => s.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    });
    current = [];
  };

  for (const segment of segments) {
    if (current.length > 0) {
      const prev = current[current.length - 1];
      let shouldBreak: boolean;
      if (timed) {
        const gap = (segment.startMs ?? 0) - (prev.endMs ?? 0);
        const span = (prev.endMs ?? 0) - (current[0].startMs ?? 0);
        shouldBreak =
          gap > GAP_BREAK_MS ||
          span >= HARD_WINDOW_MS ||
          (span >= SOFT_WINDOW_MS && endsSentence(prev.text));
      } else {
        const length = current.reduce((n, s) => n + s.text.length, 0);
        shouldBreak =
          length >= HARD_WINDOW_CHARS || (length >= SOFT_WINDOW_CHARS && endsSentence(prev.text));
      }
      if (shouldBreak) flush();
    }
    current.push(segment);
  }
  flush();
  return paragraphs.filter((p) => p.text !== "");
}

/** Plain text — the same readable paragraphs as the brief, no stamps, no header. */
export function toPlainText(segments: WireSegment[]): string {
  const paragraphs = toParagraphs(segments);
  if (paragraphs.length === 0) return "\n";
  return paragraphs.map((p) => p.text).join("\n\n") + "\n";
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

/** What the .md brief knows beyond the segments — all optional, all degrading honestly when absent. */
export interface BriefInfo {
  title?: string | null;
  uri?: string | null;
  tags?: string[];
  /** ISO timestamp of ingest (sources.createdAt). */
  createdAt?: string;
}

/** `[mm:ss]` under an hour, `[h:mm:ss]` past it — one sparse stamp per paragraph. */
function sparseStamp(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1_000));
  const h = Math.floor(total / 3_600);
  const m = Math.floor(total / 60) % 60;
  const s = total % 60;
  return h > 0 ? `[${h}:${pad(m)}:${pad(s)}]` : `[${pad(m)}:${pad(s)}]`;
}

/**
 * The AI brief (Deliverable D, founder-directed): transcripts here exist to
 * be fed to agents, so the headline export is a token-efficient Markdown
 * brief — SRT spends ~2.5–3× the tokens on the same words (sequence numbers
 * + timecode lines), while sparse-stamped paragraph Markdown is the shape
 * agents consume best: one `[mm:ss]` anchor per paragraph keeps moments
 * findable without paying per-cue overhead. Header facts degrade honestly:
 * no title → the URL heads the brief; untimed ingest → no duration, no
 * stamps (never invented).
 */
export function toMarkdownBrief(segments: WireSegment[], info: BriefInfo = {}): string {
  const timed = hasTimings(segments);
  const facts: string[] = [];
  if (info.uri) facts.push(`- Source: ${info.uri}`);
  if (timed && segments.length > 0) {
    const end = segments[segments.length - 1].endMs ?? 0;
    facts.push(`- Duration: ${sparseStamp(end).slice(1, -1)}`);
  }
  facts.push(`- Segments: ${segments.length}`);
  if (info.createdAt) facts.push(`- Ingested: ${info.createdAt.slice(0, 10)}`);
  if (info.tags && info.tags.length > 0) facts.push(`- Tags: ${info.tags.join(", ")}`);

  const body = toParagraphs(segments)
    .map((p) => (p.startMs !== undefined ? `${sparseStamp(p.startMs)} ${p.text}` : p.text))
    .join("\n\n");

  return `# ${info.title ?? info.uri ?? "Transcript"}\n\n${facts.join("\n")}\n\n## Transcript\n\n${body}\n`;
}

export type ExportFormat = "md" | "txt" | "csv" | "srt";

export const EXPORT_BUILDERS: Record<
  ExportFormat,
  { build: (s: WireSegment[], info?: BriefInfo) => string; mime: string; timed: boolean }
> = {
  md: { build: toMarkdownBrief, mime: "text/markdown", timed: false },
  txt: { build: toPlainText, mime: "text/plain", timed: false },
  csv: { build: toCsv, mime: "text/csv", timed: true },
  srt: { build: toSrt, mime: "application/x-subrip", timed: true },
};
