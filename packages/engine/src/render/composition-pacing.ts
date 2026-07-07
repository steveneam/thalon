/**
 * Composition v2's pacing-density rule (engaging-clips.md §5 item 1),
 * ENFORCED BY CONSTRUCTION: the project emitter plans every scheduled
 * visual change (scene entrances, transitions, caption group swaps, word
 * highlights, stat count-ups), this module measures the gaps, and any gap
 * over the limit gets deterministic accent pulses inserted BEFORE emission
 * — then the same measurement runs again as a hard assert, so a template
 * regression that reopens a dead stretch fails the generator, not the
 * founder's eye. Limits per the craft evidence (§2: a visible change every
 * ~1.5–3s; the hook owns the open): ≤2.5s everywhere, ≤2s inside the hook
 * cue.
 */

export const MAX_VISUAL_GAP_MS = 2_500;
export const HOOK_MAX_VISUAL_GAP_MS = 2_000;

export type MotionEventKind =
  | "scene-entrance"
  | "transition"
  | "caption-group"
  | "caption-word"
  | "stat-count"
  | "accent-pulse";

export interface MotionEvent {
  atMs: number;
  kind: MotionEventKind;
  /** Owning cue (null for root-level events like transitions). */
  cueIndex: number | null;
}

export interface MotionSchedule {
  events: MotionEvent[];
  /** Largest silent stretch measured over [0, durationMs] AFTER pulse insertion. */
  maxGapMs: number;
}

/** The hook window = cue 0's span; gaps that lie fully inside it use the tighter limit. */
export interface PacingWindow {
  durationMs: number;
  hookEndMs: number;
}

function gapLimit(gapStart: number, gapEnd: number, window: PacingWindow): number {
  return gapEnd <= window.hookEndMs ? HOOK_MAX_VISUAL_GAP_MS : MAX_VISUAL_GAP_MS;
}

function sortedTimes(events: MotionEvent[]): number[] {
  return [...events.map((e) => e.atMs)].sort((a, b) => a - b);
}

/**
 * Measures every silent stretch (anchored at 0 and durationMs) and returns
 * the pulses needed to close the oversized ones — evenly spaced, integer ms,
 * deterministic. The caller materializes each pulse as a small accent tween
 * in the scene that owns its timestamp.
 */
export function planAccentPulses(events: MotionEvent[], window: PacingWindow): number[] {
  const times = [0, ...sortedTimes(events), window.durationMs];
  const pulses: number[] = [];
  for (let i = 1; i < times.length; i++) {
    const start = times[i - 1];
    const end = times[i];
    const limit = gapLimit(start, end, window);
    const gap = end - start;
    if (gap <= limit) continue;
    const inserts = Math.ceil(gap / limit) - 1;
    for (let k = 1; k <= inserts; k++) {
      pulses.push(Math.round(start + (gap * k) / (inserts + 1)));
    }
  }
  return pulses;
}

/** Post-insertion belt: throws when any gap still exceeds its limit. The emitter calls this on the final schedule — a violation is a generator bug, never render-spend. */
export function assertPacingDensity(events: MotionEvent[], window: PacingWindow): MotionSchedule {
  const times = [0, ...sortedTimes(events), window.durationMs];
  let maxGapMs = 0;
  for (let i = 1; i < times.length; i++) {
    const gap = times[i] - times[i - 1];
    maxGapMs = Math.max(maxGapMs, gap);
    const limit = gapLimit(times[i - 1], times[i], window);
    if (gap > limit) {
      throw new Error(
        `composition pacing-density violated: a ${gap}ms stretch with no scheduled visual change at ${times[i - 1]}–${times[i]}ms (limit ${limit}ms) — the generator must insert accent pulses by construction`,
      );
    }
  }
  return { events: [...events].sort((a, b) => a.atMs - b.atMs), maxGapMs };
}
