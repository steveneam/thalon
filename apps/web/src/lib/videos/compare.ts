import type { AudioCue, CaptionLine, Edl, EdlClip } from "@thalon/contracts";
import { splitLane } from "./editor";

/**
 * COMPARE TWO VERSIONS (s82 A1) — what actually changed between v6 and v7.
 *
 * The editor has always been able to SAVE a new version and to say who
 * authored it; it could never say what the version DID. "Cut history →" leads
 * to a strip of versions with authorship, which answers who and when and
 * leaves what unanswered — so the only way to know whether v7 was the trim you
 * meant was to open both and remember.
 *
 * This is the answer, and it is DETERMINISTIC: two EDLs in, a list of changes
 * out. No model, no metered call, nothing to spend. The diff is structural —
 * an EDL is a beat lane, a caption lane, a music cue and an output frame, and
 * every one of those is comparable by value. (The agent's own `EdlDiff` is a
 * different artifact for a different job: it is a PROPOSAL, a small set of ops
 * someone wants applied. This describes two things that already exist.)
 *
 * The rows land in the surface's existing `.diff-panel` / `.diff-op` grammar —
 * the op name as the pill, the sentence beside it — which is why A1 needed no
 * new CSS: a proposal panel and a compare panel are the same shape.
 */

/** One line of the comparison: the `.diff-op` pill, and the sentence beside it. */
export interface CutDiffRow {
  /** The op vocabulary, kept close to `EdlDiff`'s where the two overlap. */
  op: string;
  /** What changed, said once, in the operator's terms. */
  what: string;
}

export interface EdlComparison {
  rows: CutDiffRow[];
  /** True when the two EDLs describe the same film — stated, never implied by an empty list. */
  identical: boolean;
}

/**
 * Seconds, compactly — `6s`, `3.5s`, `0.25s`.
 *
 * Deliberately NOT the surface's `timecode()` m:ss.t: a diff row states a
 * DELTA ("6s → 3.5s") and the clock form reads worse in a sentence than it
 * does under a scrub bar. Readouts of a POSITION (the scrub, the header, the
 * beats rail) all go through `timecode()`; this is a magnitude.
 */
function secs(n: number): string {
  return `${Math.round(n * 1000) / 1000}s`;
}

/** A place in a lane, one-based, as the operator counts them. */
function position(index: number): string {
  return `#${index + 1}`;
}

/**
 * Stable per-lane identities. A beat's `name` is its identity, and a lane that
 * repeats a name (an inserted beat copies its neighbour's, `beat-03-insert`
 * aside) disambiguates by occurrence so the two lanes still line up pairwise
 * rather than collapsing onto the first match.
 */
function keysOf(values: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return values.map((value) => {
    const n = (seen.get(value) ?? 0) + 1;
    seen.set(value, n);
    return n === 1 ? value : `${value}#${n}`;
  });
}

/**
 * The keys that survive in ORDER between two sequences — a longest common
 * subsequence over unique keys.
 *
 * This is what makes "moved" honest. Comparing positions directly would report
 * every beat after an insertion as reordered, which is true of the index and
 * false of the edit: inserting one beat moves nothing. Only the keys that fall
 * OUTSIDE the longest order-preserving run are ones the operator actually
 * moved.
 */
function orderedCommon(a: readonly string[], b: readonly string[]): Set<string> {
  const table: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i][j] =
        a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const kept = new Set<string>();
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      kept.add(a[i]);
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return kept;
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function takeName(ref: string): string {
  return ref.split("/").pop() ?? ref;
}

/* ── the beat lane ──────────────────────────────────────────────────── */

function compareBeats(before: EdlClip[], after: EdlClip[], rows: CutDiffRow[]): void {
  const beforeKeys = keysOf(before.map((c) => c.name));
  const afterKeys = keysOf(after.map((c) => c.name));
  const beforeAt = new Map(beforeKeys.map((key, i) => [key, i]));
  const afterAt = new Map(afterKeys.map((key, i) => [key, i]));

  for (const key of afterKeys) {
    if (beforeAt.has(key)) continue;
    const clip = after[afterAt.get(key) as number];
    rows.push({
      op: "beat-added",
      what: `${clip.name} added at ${position(afterAt.get(key) as number)} — ${secs(
        clip.duration,
      )} of ${takeName(clip.source.ref)}`,
    });
  }
  for (const key of beforeKeys) {
    if (afterAt.has(key)) continue;
    const clip = before[beforeAt.get(key) as number];
    rows.push({
      op: "beat-removed",
      what: `${clip.name} dropped from ${position(beforeAt.get(key) as number)} — it was ${secs(
        clip.duration,
      )} of ${takeName(clip.source.ref)}`,
    });
  }

  const common = beforeKeys.filter((key) => afterAt.has(key));
  const held = orderedCommon(
    common,
    afterKeys.filter((key) => beforeAt.has(key)),
  );

  // Walked in the NEW lane's order, so the panel reads down the cut as it is
  // now rather than as it was.
  for (const key of afterKeys) {
    if (!beforeAt.has(key)) continue;
    const from = beforeAt.get(key) as number;
    const to = afterAt.get(key) as number;
    const was = before[from];
    const now = after[to];
    if (!held.has(key)) {
      rows.push({
        op: "beat-moved",
        what: `${now.name} moved from ${position(from)} to ${position(to)}`,
      });
    }
    if (was.source.ref !== now.source.ref) {
      rows.push({
        op: "beat-source",
        what: `${now.name} now rides ${takeName(now.source.ref)} (was ${takeName(
          was.source.ref,
        )})`,
      });
    }
    if (was.duration !== now.duration || was.in !== now.in) {
      const length =
        was.duration === now.duration
          ? `${secs(now.duration)} held`
          : `${secs(was.duration)} → ${secs(now.duration)}`;
      const inPoint = was.in === now.in ? "" : `, in-point ${secs(was.in)} → ${secs(now.in)}`;
      rows.push({ op: "beat-trimmed", what: `${now.name} ${length}${inPoint}` });
    }
    if (
      !sameJson(was.crop, now.crop) ||
      !sameJson(was.scale, now.scale) ||
      !sameJson(was.grade, now.grade)
    ) {
      // The reframe window and the grade knobs both live here; naming which
      // one moved beats "something about the picture changed".
      const parts = [
        sameJson(was.crop, now.crop) ? null : "crop",
        sameJson(was.scale, now.scale) ? null : "scale",
        sameJson(was.grade, now.grade) ? null : "grade",
      ].filter((part): part is string => part !== null);
      rows.push({ op: "beat-reframed", what: `${now.name} ${parts.join(" + ")} changed` });
    }
    if (!sameJson(was.transitionIn, now.transitionIn)) {
      const describe = (clip: EdlClip) =>
        clip.transitionIn ? `${clip.transitionIn.type} ${secs(clip.transitionIn.duration)}` : "cut";
      rows.push({
        op: "beat-transition",
        what: `${now.name} enters on ${describe(now)} (was ${describe(was)})`,
      });
    }
  }
}

/* ── the caption lane ───────────────────────────────────────────────── */

function timingOf(line: CaptionLine): string {
  return `${secs(line.fadeIn)}–${secs(line.fadeOut)}`;
}

function compareCaptionPair(
  was: CaptionLine,
  now: CaptionLine,
  index: number,
  rows: CutDiffRow[],
): void {
  if (was.text !== now.text) {
    // Text is CONTENT — the judge gate binds at the approve door, and a
    // comparison that hid a reworded line would hide the thing most worth
    // reading before approving.
    rows.push({
      op: "caption-text",
      what: `line ${index + 1}: “${was.text}” → “${now.text}”`,
    });
  }
  if (was.fadeIn !== now.fadeIn || was.fadeOut !== now.fadeOut || was.ramp !== now.ramp) {
    const ramp = was.ramp === now.ramp ? "" : `, ramp ${secs(was.ramp)} → ${secs(now.ramp)}`;
    rows.push({
      op: "caption-timing",
      what: `line ${index + 1} “${now.text}” now holds ${timingOf(now)} (was ${timingOf(
        was,
      )})${ramp}`,
    });
  }
  if (was.x !== now.x || was.y !== now.y) {
    rows.push({
      op: "caption-move",
      what: `line ${index + 1} “${now.text}” moved to ${now.x},${now.y} (was ${was.x},${was.y})`,
    });
  }
}

function compareCaptions(before: Edl, after: Edl, rows: CutDiffRow[]): void {
  const wasLines = before.captions?.lines ?? [];
  const nowLines = after.captions?.lines ?? [];
  if (wasLines.length === 0 && nowLines.length === 0) return;

  // Only when there are plates on BOTH sides: a cut that lost its caption lane
  // outright did not restyle it, and saying so beside the removals would be a
  // row about a plate that no longer exists.
  if (
    wasLines.length > 0 &&
    nowLines.length > 0 &&
    !sameJson(before.captions?.style, after.captions?.style)
  ) {
    rows.push({ op: "caption-style", what: "the caption plate's typography changed" });
  }

  /*
   * Lines have no ids, so identity has to be inferred. Anchor on identical
   * TEXT first (an untouched line is the same line wherever it sits), then
   * pair what is left over IN ORDER — those pairs are rewordings, which is the
   * single most common caption edit and the one an index-blind diff reports
   * as "every line was deleted and a new one added". Anything still unpaired
   * genuinely arrived or genuinely left.
   */
  const wasKeys = keysOf(wasLines.map((l) => l.text));
  const nowKeys = keysOf(nowLines.map((l) => l.text));
  const anchored = orderedCommon(
    wasKeys.filter((key) => nowKeys.includes(key)),
    nowKeys.filter((key) => wasKeys.includes(key)),
  );

  const wasLeft: number[] = [];
  const nowLeft: number[] = [];
  wasKeys.forEach((key, i) => {
    if (!anchored.has(key)) wasLeft.push(i);
  });
  nowKeys.forEach((key, i) => {
    if (!anchored.has(key)) nowLeft.push(i);
  });

  // The anchored ones can still have moved or been re-timed.
  const nowIndexOf = new Map(nowKeys.map((key, i) => [key, i]));
  wasKeys.forEach((key, i) => {
    if (!anchored.has(key)) return;
    const j = nowIndexOf.get(key) as number;
    compareCaptionPair(wasLines[i], nowLines[j], j, rows);
  });

  const paired = Math.min(wasLeft.length, nowLeft.length);
  for (let k = 0; k < paired; k += 1) {
    compareCaptionPair(wasLines[wasLeft[k]], nowLines[nowLeft[k]], nowLeft[k], rows);
  }
  for (let k = paired; k < nowLeft.length; k += 1) {
    const line = nowLines[nowLeft[k]];
    rows.push({
      op: "caption-added",
      what: `line ${nowLeft[k] + 1} added: “${line.text}” at ${timingOf(line)}`,
    });
  }
  for (let k = paired; k < wasLeft.length; k += 1) {
    const line = wasLines[wasLeft[k]];
    rows.push({ op: "caption-removed", what: `“${line.text}” removed` });
  }
}

/* ── the music lane ─────────────────────────────────────────────────── */

function easing(cue: AudioCue): string {
  const parts: string[] = [];
  if (cue.fadeIn) parts.push(`entry ease ${secs(cue.fadeIn.duration)}`);
  if (cue.fadeOut)
    parts.push(`tail ease from ${secs(cue.fadeOut.start)} over ${secs(cue.fadeOut.duration)}`);
  return parts.length === 0 ? "no easing" : parts.join(" · ");
}

function compareMusic(before: Edl, after: Edl, rows: CutDiffRow[]): void {
  const was = before.audio[0] ?? null;
  const now = after.audio[0] ?? null;
  if (was === null && now === null) return;
  if (was === null && now !== null) {
    rows.push({
      op: "music-added",
      what: `${takeName(now.source.ref)} scores the cut (from ${secs(now.offset)} in, ${
        now.gainDb
      } dB)`,
    });
    return;
  }
  if (was !== null && now === null) {
    rows.push({ op: "music-removed", what: `${takeName(was.source.ref)} removed — the cut is silent` });
    return;
  }
  if (was === null || now === null) return;
  if (was.source.ref !== now.source.ref) {
    rows.push({
      op: "music-source",
      what: `bed swapped to ${takeName(now.source.ref)} (was ${takeName(was.source.ref)})`,
    });
  }
  if (was.offset !== now.offset) {
    rows.push({
      op: "music-align",
      what: `bed enters ${secs(was.offset)} → ${secs(now.offset)} into the track`,
    });
  }
  if (was.gainDb !== now.gainDb) {
    rows.push({ op: "music-gain", what: `bed level ${was.gainDb} dB → ${now.gainDb} dB` });
  }
  if (!sameJson(was.fadeIn, now.fadeIn) || !sameJson(was.fadeOut, now.fadeOut)) {
    rows.push({ op: "music-easing", what: `${easing(was)} → ${easing(now)}` });
  }
  if (was.mode !== now.mode) {
    rows.push({
      op: "music-mode",
      what: `bed is ${now.mode}d (was ${was.mode}d) — a copied bed carries no knobs`,
    });
  }
  if (before.audio.length > 1 || after.audio.length > 1) {
    // The compiler caps the lane at one cue, so this is a corrupt or
    // hand-written EDL rather than an edit. Saying so beats comparing the
    // first cue and silently ignoring the rest.
    rows.push({
      op: "music-lane",
      what: `${before.audio.length} → ${after.audio.length} cues on a lane the compiler caps at one`,
    });
  }
}

/* ── the frame ──────────────────────────────────────────────────────── */

function compareOutput(before: Edl, after: Edl, rows: CutDiffRow[]): void {
  const was = before.output;
  const now = after.output;
  if (was.duration !== now.duration) {
    rows.push({ op: "output", what: `runtime ${secs(was.duration)} → ${secs(now.duration)}` });
  }
  if (was.width !== now.width || was.height !== now.height) {
    rows.push({
      op: "output",
      what: `frame ${was.width}×${was.height} → ${now.width}×${now.height}`,
    });
  }
  if (was.fps !== now.fps) {
    rows.push({ op: "output", what: `${was.fps} fps → ${now.fps} fps` });
  }
  if (was.video.mode !== now.video.mode) {
    rows.push({ op: "output", what: `picture ${was.video.mode}d → ${now.video.mode}d` });
  }
}

/**
 * Compare two versions of a cut. `before` is the older one (or whatever the
 * operator picked to compare against); `after` is what is on screen. Every row
 * reads as a change `after` made.
 */
export function compareEdls(before: Edl, after: Edl): EdlComparison {
  const rows: CutDiffRow[] = [];
  const wasLane = splitLane(before);
  const nowLane = splitLane(after);

  compareBeats(wasLane.beats, nowLane.beats, rows);

  // The endcard tail is not a beat — it is pinned last by the compiler and
  // carries its own freeze boundary — so it is compared on its own terms
  // rather than being matched against the beats around it.
  if (wasLane.overlay === null && nowLane.overlay !== null) {
    rows.push({
      op: "endcard-added",
      what: `${nowLane.overlay.name} holds from ${secs(nowLane.overlay.at ?? 0)}`,
    });
  } else if (wasLane.overlay !== null && nowLane.overlay === null) {
    rows.push({ op: "endcard-removed", what: `${wasLane.overlay.name} removed` });
  } else if (wasLane.overlay !== null && nowLane.overlay !== null) {
    if ((wasLane.overlay.at ?? 0) !== (nowLane.overlay.at ?? 0)) {
      rows.push({
        op: "endcard-freeze",
        what: `the endcard freezes the film at ${secs(wasLane.overlay.at ?? 0)} → ${secs(
          nowLane.overlay.at ?? 0,
        )}`,
      });
    }
    if (wasLane.overlay.source.ref !== nowLane.overlay.source.ref) {
      rows.push({
        op: "endcard-source",
        what: `endcard now ${takeName(nowLane.overlay.source.ref)} (was ${takeName(
          wasLane.overlay.source.ref,
        )})`,
      });
    }
  }

  compareCaptions(before, after, rows);
  compareMusic(before, after, rows);
  compareOutput(before, after, rows);

  return { rows, identical: rows.length === 0 };
}
