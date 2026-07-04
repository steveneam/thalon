/**
 * B2.3 candidate-window derivation (SPINE §1 doctrine: pure core — given the
 * same timed chunks and config, always the same windows; no I/O, no clock,
 * no randomness). A candidate window is one or more consecutive chunks: a
 * window never cuts inside a single chunk's text, only at chunk boundaries.
 *
 * Two deterministic passes:
 *  1. Group consecutive chunks into "runs" wherever the gap between one
 *     chunk's end and the next chunk's start is at least `pauseGapMs` — a
 *     pause in the source audio is treated as a natural boundary a clip
 *     should never straddle.
 *  2. Slice each run into one or more windows of at most `maxDurationMs`,
 *     cutting at the last chunk boundary that still fits (never inside a
 *     chunk) — a run with no internal pauses still gets split by duration
 *     alone.
 * Any resulting window shorter than `minDurationMs` is discarded — too short
 * to be a usable short-form clip.
 */
export interface WindowConfig {
  /** A candidate window shorter than this is discarded. */
  minDurationMs: number;
  /** A candidate window never grows past this; a run longer than this is sliced into multiple windows at chunk boundaries. */
  maxDurationMs: number;
  /** A gap at least this long between two consecutive chunks' end/start counts as a natural boundary a window never spans. */
  pauseGapMs: number;
}

/** Sane defaults for short-form clips: 15s-90s, cut on pauses of 700ms+. */
export const DEFAULT_WINDOW_CONFIG: WindowConfig = {
  minDurationMs: 15_000,
  maxDurationMs: 90_000,
  pauseGapMs: 700,
};

/** The minimal chunk shape the derivation needs — matches `@thalon/db`'s `SourceChunk` (startMs/endMs are nullable there for untimed sources). */
export interface WaterfallChunkInput {
  seq: number;
  text: string;
  startMs?: number | null;
  endMs?: number | null;
}

export interface CandidateWindow {
  /** Milliseconds into the source media where this window starts (its first chunk's startMs). */
  startMs: number;
  /** Milliseconds into the source media where this window ends (its last chunk's endMs). */
  endMs: number;
  durationMs: number;
  /** `source_chunks.seq` values composing this window, in order — chunk-level provenance. */
  chunkSeqs: number[];
  /** The window's transcript excerpt (its chunks' text, joined) — what highlight-select grounds hook/captions/platform copy against. */
  text: string;
}

function isTimed(
  chunk: WaterfallChunkInput,
): chunk is WaterfallChunkInput & { startMs: number; endMs: number } {
  return (
    typeof chunk.startMs === "number" &&
    typeof chunk.endMs === "number" &&
    chunk.endMs > chunk.startMs
  );
}

type TimedChunk = WaterfallChunkInput & { startMs: number; endMs: number };

function groupByPauseGap(chunks: TimedChunk[], pauseGapMs: number): TimedChunk[][] {
  const runs: TimedChunk[][] = [];
  let current: TimedChunk[] = [];
  for (const chunk of chunks) {
    if (current.length > 0) {
      const prev = current[current.length - 1];
      const gap = chunk.startMs - prev.endMs;
      if (gap >= pauseGapMs) {
        runs.push(current);
        current = [];
      }
    }
    current.push(chunk);
  }
  if (current.length > 0) runs.push(current);
  return runs;
}

function sliceRunByMaxDuration(run: TimedChunk[], maxDurationMs: number): TimedChunk[][] {
  const slices: TimedChunk[][] = [];
  let current: TimedChunk[] = [];
  let sliceStartMs = 0;
  for (const chunk of run) {
    if (current.length > 0 && chunk.endMs - sliceStartMs > maxDurationMs) {
      slices.push(current);
      current = [];
    }
    if (current.length === 0) sliceStartMs = chunk.startMs;
    current.push(chunk);
  }
  if (current.length > 0) slices.push(current);
  return slices;
}

/**
 * Derives every candidate clip window from a source's timed chunks. Returns
 * `[]` when the source carries no timed chunks (nothing to derive from) or
 * when every candidate falls short of `minDurationMs`. Array position is the
 * window's stable index for a given (chunks, config) pair — the highlight-
 * select shell selects clips by that index.
 */
export function deriveCandidateWindows(
  chunks: readonly WaterfallChunkInput[],
  config: WindowConfig = DEFAULT_WINDOW_CONFIG,
): CandidateWindow[] {
  const timed = chunks.filter(isTimed).slice().sort((a, b) => a.startMs - b.startMs);
  if (timed.length === 0) return [];

  const windows: CandidateWindow[] = [];
  for (const run of groupByPauseGap(timed, config.pauseGapMs)) {
    for (const slice of sliceRunByMaxDuration(run, config.maxDurationMs)) {
      const first = slice[0];
      const last = slice[slice.length - 1];
      const durationMs = last.endMs - first.startMs;
      if (durationMs < config.minDurationMs) continue;
      windows.push({
        startMs: first.startMs,
        endMs: last.endMs,
        durationMs,
        chunkSeqs: slice.map((c) => c.seq),
        text: slice.map((c) => c.text).join(" "),
      });
    }
  }
  return windows;
}
