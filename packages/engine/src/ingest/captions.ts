/**
 * Caption parsing (B2.2): SRT / WebVTT / plain text → timed segments. Pure
 * core (SPINE §1) — no I/O, no clock; given the same input, always the same
 * segments. Malformed cue timings fail loud with the offending line rather
 * than silently dropping media time.
 */

export type CaptionFormat = "srt" | "vtt" | "text";

export interface TimedSegment {
  text: string;
  /** Milliseconds into the media; absent for untimed (plain-text) segments. */
  startMs?: number;
  endMs?: number;
}

const TIMING_LINE = /^(.+?)\s+-->\s+(\S+)(?:\s+.*)?$/;
const TIMESTAMP = /^(?:(\d{1,3}):)?(\d{1,2}):(\d{2})[.,](\d{1,3})$/;

export function detectCaptionFormat(input: string): CaptionFormat {
  const head = input.trimStart();
  if (head.startsWith("WEBVTT")) return "vtt";
  if (input.includes("-->")) return "srt";
  return "text";
}

/** `HH:MM:SS,mmm` (SRT) or `[HH:]MM:SS.mmm` (VTT) → milliseconds. */
export function parseCaptionTimestamp(raw: string): number {
  const match = TIMESTAMP.exec(raw.trim());
  if (!match) throw new Error(`malformed caption timestamp: "${raw.trim()}"`);
  const [, hours, minutes, seconds, millis] = match;
  return (
    (hours ? Number(hours) * 3_600_000 : 0) +
    Number(minutes) * 60_000 +
    Number(seconds) * 1_000 +
    Number(millis.padEnd(3, "0"))
  );
}

export function parseCaptions(input: string, format?: CaptionFormat): TimedSegment[] {
  const resolved = format ?? detectCaptionFormat(input);
  if (resolved === "vtt") return parseCueBlocks(stripVttPreamble(input));
  if (resolved === "srt") return parseCueBlocks(input);
  return parseUntimedText(input);
}

/** Drops the WEBVTT header plus any NOTE/STYLE/REGION blocks before the first cue. */
function stripVttPreamble(input: string): string {
  return splitBlocks(input)
    .filter((block) => !/^(WEBVTT|NOTE|STYLE|REGION)\b/.test(block.trimStart()))
    .join("\n\n");
}

/**
 * Shared SRT/VTT cue walk — both formats are blank-line-separated blocks of
 * [optional id line] + timing line + text lines. Cue payload tags
 * (`<c>`, `<i>`, inline `<00:00:01.000>` word timestamps) are stripped.
 */
function parseCueBlocks(input: string): TimedSegment[] {
  const segments: TimedSegment[] = [];
  for (const block of splitBlocks(input)) {
    const lines = block.split(/\r?\n/).map((line) => line.trim());
    const timingIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingIndex === -1) {
      // A bare single-line stray (trailing cue counter) carries no media time; a
      // multi-line block without a timing line is lost captions — fail loud.
      if (lines.filter(Boolean).length <= 1) continue;
      throw new Error(`caption cue block has no "-->" timing line: "${lines[0]}"`);
    }
    const timing = TIMING_LINE.exec(lines[timingIndex]);
    if (!timing) throw new Error(`malformed caption cue timing line: "${lines[timingIndex]}"`);
    const text = lines
      .slice(timingIndex + 1)
      .join(" ")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    segments.push({
      text,
      startMs: parseCaptionTimestamp(timing[1]),
      endMs: parseCaptionTimestamp(timing[2]),
    });
  }
  return segments;
}

/** Plain transcript with no timings: paragraphs become untimed segments (chunks then carry no media time). */
function parseUntimedText(input: string): TimedSegment[] {
  return splitBlocks(input)
    .map((block) => block.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((text) => ({ text }));
}

function splitBlocks(input: string): string[] {
  return input
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean);
}
