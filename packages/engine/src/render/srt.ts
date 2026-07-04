import type { PillarScriptDraftMeta } from "../origination/schemas";

/**
 * B3.10 deterministic caption core (SPINE §1: pure — no I/O, no clock; same
 * meta in, same bytes out). The pillar video's SRT derives from EXACTLY the
 * authored script lines — hook, then each beat's narration in beatIndex
 * order, then the CTA — verbatim, never ASR'd and never paraphrased (ADR
 * 0003 §3: no ASR for our own content). This is what lets B2.3 waterfall a
 * generated pillar with born-accurate timestamps: the SRT written here
 * round-trips through the B2.2 caption-file ingest unchanged (test-proven).
 */

/** Derived cue duration: ~16.7 chars/sec reading speed for the on-screen-text-first cut. An authored `durationHintMs` (judged content) is trusted verbatim; only derived durations clamp. */
export const DERIVED_MS_PER_CHAR = 60;
export const MIN_DERIVED_CUE_MS = 1_500;
export const MAX_DERIVED_CUE_MS = 12_000;

export interface PillarTimelineCue {
  kind: "hook" | "beat" | "cta";
  /** The source beat's beatIndex; null for the hook/cta cues. */
  beatIndex: number | null;
  /** Whitespace-normalised cue text (single spaces — SRT cue text must never contain a blank line, which would terminate the cue). */
  text: string;
  onScreenText: string | null;
  visualHint: string | null;
  startMs: number;
  endMs: number;
}

export interface PillarTimeline {
  cues: PillarTimelineCue[];
  totalDurationMs: number;
}

/** Collapses all whitespace runs (incl. newlines) to single spaces — deterministic, and exactly the normalisation ../ingest/captions.ts applies on parse, so the round-trip is byte-stable. */
function normalizeCueText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function derivedCueDurationMs(text: string): number {
  return Math.min(
    MAX_DERIVED_CUE_MS,
    Math.max(MIN_DERIVED_CUE_MS, normalizeCueText(text).length * DERIVED_MS_PER_CHAR),
  );
}

/**
 * The authored script → a contiguous timeline (cue N's end IS cue N+1's
 * start — no gaps, no overlaps, starting at 0). Beat order is beatIndex,
 * never array order. This one timeline drives BOTH artifacts: the SRT cues
 * and the render manifest the composition consumes.
 */
export function derivePillarTimeline(
  meta: Pick<PillarScriptDraftMeta, "hook" | "beats" | "cta">,
): PillarTimeline {
  const cues: PillarTimelineCue[] = [];
  let cursorMs = 0;
  const push = (
    kind: PillarTimelineCue["kind"],
    beatIndex: number | null,
    text: string,
    durationMs: number,
    onScreenText: string | null = null,
    visualHint: string | null = null,
  ) => {
    cues.push({
      kind,
      beatIndex,
      text: normalizeCueText(text),
      onScreenText,
      visualHint,
      startMs: cursorMs,
      endMs: cursorMs + durationMs,
    });
    cursorMs += durationMs;
  };

  push("hook", null, meta.hook, derivedCueDurationMs(meta.hook));
  for (const beat of [...meta.beats].sort((a, b) => a.beatIndex - b.beatIndex)) {
    push(
      "beat",
      beat.beatIndex,
      beat.narration,
      beat.durationHintMs ?? derivedCueDurationMs(beat.narration),
      beat.onScreenText ?? null,
      beat.visualHint ?? null,
    );
  }
  if (meta.cta) push("cta", null, meta.cta, derivedCueDurationMs(meta.cta));

  return { cues, totalDurationMs: cursorMs };
}

/** `HH:MM:SS,mmm` — the strict SRT form ../ingest/captions.ts's TIMESTAMP regex accepts. */
export function formatSrtTimestamp(ms: number): string {
  if (!Number.isInteger(ms) || ms < 0) throw new Error(`invalid SRT timestamp ms: ${ms}`);
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1_000);
  const millis = ms % 1_000;
  const pad = (n: number, width: number) => String(n).padStart(width, "0");
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(millis, 3)}`;
}

/** Timeline → standard SRT text (1-based cue counter, CRLF-free, trailing newline). */
export function renderSrt(timeline: PillarTimeline): string {
  return timeline.cues
    .map(
      (cue, i) =>
        `${i + 1}\n${formatSrtTimestamp(cue.startMs)} --> ${formatSrtTimestamp(cue.endMs)}\n${cue.text}\n`,
    )
    .join("\n");
}

/** Convenience: authored script meta → its deterministic SRT. */
export function pillarScriptToSrt(
  meta: Pick<PillarScriptDraftMeta, "hook" | "beats" | "cta">,
): string {
  return renderSrt(derivePillarTimeline(meta));
}
