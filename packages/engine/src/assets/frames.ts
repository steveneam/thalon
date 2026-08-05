/**
 * frames.ts — naming and sampling for frame-sequence derives.
 *
 * A scroll-scrubbed moving image on a template site is NOT an mp4 the page
 * seeks through: setting `video.currentTime` lands on h264 keyframes and
 * janks. The page scrubs a sequence of stills instead, which decodes without
 * seek cost and is deterministic under a scroll position (s105 finding).
 *
 * The mp4 stays the pinned original in the object store; the frames are the
 * derive, emitted by `scripts/export-template-assets.ts` from one manifest
 * entry carrying `frames: N` and a printf-style `file` pattern. Both the
 * exporter and the portfolio ratchet expand that pattern through the helpers
 * here, so a manifest entry and the files on disk can never disagree about
 * which names the sequence occupies.
 */

/** One `%0Nd` placeholder, e.g. `%03d` — the only substitution a pattern may carry. */
const PATTERN_RE = /%0(\d)d/;

/** True when `file` is a frame-sequence pattern rather than a plain filename. */
export function isFramePattern(file: string): boolean {
  return PATTERN_RE.test(file);
}

/**
 * Expands a frame-sequence pattern into its exact filenames, frame 0 first.
 *
 * Throws when the pattern carries no `%0Nd`, carries more than one, or is too
 * narrow to hold `frames - 1` without overflowing its own zero padding — a
 * silently-truncated pattern would collide two frames onto one filename and
 * drop a frame from the sequence without any error.
 */
export function frameFileNames(pattern: string, frames: number): string[] {
  if (!Number.isInteger(frames) || frames < 1) {
    throw new Error(`frames must be a positive integer, got ${frames}`);
  }
  const match = PATTERN_RE.exec(pattern);
  if (!match) throw new Error(`frame pattern "${pattern}" has no %0Nd placeholder`);
  if (PATTERN_RE.test(pattern.slice(match.index + match[0].length))) {
    throw new Error(`frame pattern "${pattern}" has more than one %0Nd placeholder`);
  }
  const width = Number(match[1]);
  const last = String(frames - 1);
  if (last.length > width) {
    throw new Error(
      `frame pattern "${pattern}" is %0${width}d but needs ${last.length} digits for ${frames} frames`,
    );
  }
  return Array.from({ length: frames }, (_, i) =>
    pattern.replace(PATTERN_RE, String(i).padStart(width, "0")),
  );
}

/**
 * Picks `want` evenly-spaced indices out of `total` source frames, always
 * including the first and the last.
 *
 * The endpoints matter more than the spacing here: frame 0 is the season the
 * scrub starts on and frame N-1 is the one it ends on, and those two are the
 * pinned keyframes the whole transition was generated between. Dropping
 * either would leave the scrub landing somewhere that no longer matches the
 * month the instrument is reporting.
 */
export function evenlySpacedIndices(total: number, want: number): number[] {
  if (!Number.isInteger(total) || total < 1) throw new Error(`total must be >= 1, got ${total}`);
  if (!Number.isInteger(want) || want < 1) throw new Error(`want must be >= 1, got ${want}`);
  if (want > total) throw new Error(`cannot sample ${want} frames from ${total}`);
  if (want === 1) return [0];
  return Array.from({ length: want }, (_, i) => Math.round((i * (total - 1)) / (want - 1)));
}
