import {
  ASPECT_DIMENSIONS,
  DIRECTION_DOC_VERSION,
  directionDocSchema,
  type DirectionDoc,
  type DirectionMotion,
  type DirectionPacing,
} from "@thalon/contracts";
import { derivedCueDurationMs, formatSrtTimestamp } from "../render/srt";

/**
 * The deterministic export (B5.2, amendment A11): direction doc in, the
 * complete render-consumable structure out — NEVER a prompt (charter: "export
 * is deterministic core"). Same doc, same bytes, always. The B5.1 render
 * driver builds its HTML composition from exactly this export, and the SRT
 * here is the platform-upload caption artifact (the same derived timeline
 * can additionally drive burned-in caption components in the composition).
 *
 * Timeline rules: scenes are contiguous from 0ms in sceneIndex order with
 * their authored durations; a CTA becomes one trailing cue with a DERIVED
 * duration (the doc's schema carries no CTA duration — it is computed with
 * the same reading-speed math as every other derived duration).
 */

export interface DirectionTimelineCue {
  kind: "scene" | "cta";
  /** null for the cta cue. */
  sceneIndex: number | null;
  heading: string | null;
  /** The narrated line (single-line by contract) — the SRT cue text. */
  text: string;
  onScreenText: string | null;
  visual: string | null;
  motion: DirectionMotion | null;
  startMs: number;
  endMs: number;
}

export interface DirectionTimeline {
  cues: DirectionTimelineCue[];
  totalDurationMs: number;
}

export interface DirectionExport {
  docVersion: typeof DIRECTION_DOC_VERSION;
  title: string;
  /** Compile-time composition constants (never script/variable-settable in the composition). */
  width: number;
  height: number;
  fps: number;
  pacing: DirectionPacing;
  timeline: DirectionTimeline;
}

export function deriveDirectionTimeline(
  doc: Pick<DirectionDoc, "scenes" | "cta">,
): DirectionTimeline {
  const cues: DirectionTimelineCue[] = [];
  let cursorMs = 0;
  for (const scene of doc.scenes) {
    cues.push({
      kind: "scene",
      sceneIndex: scene.sceneIndex,
      heading: scene.heading,
      text: scene.narration,
      onScreenText: scene.onScreenText,
      visual: scene.visual,
      motion: scene.motion,
      startMs: cursorMs,
      endMs: cursorMs + scene.durationMs,
    });
    cursorMs += scene.durationMs;
  }
  if (doc.cta) {
    const durationMs = derivedCueDurationMs(doc.cta);
    cues.push({
      kind: "cta",
      sceneIndex: null,
      heading: null,
      text: doc.cta,
      onScreenText: null,
      visual: null,
      motion: null,
      startMs: cursorMs,
      endMs: cursorMs + durationMs,
    });
    cursorMs += durationMs;
  }
  return { cues, totalDurationMs: cursorMs };
}

export function deriveDirectionExport(input: DirectionDoc): DirectionExport {
  // Fail-loud: exporting an invalid doc is a caller sequencing bug.
  const doc = directionDocSchema.parse(input);
  const { width, height } = ASPECT_DIMENSIONS[doc.aspect];
  return {
    docVersion: doc.docVersion,
    title: doc.title,
    width,
    height,
    fps: doc.fps,
    pacing: doc.pacing,
    timeline: deriveDirectionTimeline(doc),
  };
}

/** Timeline → standard SRT text — byte-compatible with the pillar SRT convention (1-based counter, blank-line separated cues, trailing newline) so it round-trips through the B2.2 caption-file ingest unchanged. */
export function renderDirectionSrt(timeline: DirectionTimeline): string {
  return timeline.cues
    .map(
      (cue, i) =>
        `${i + 1}\n${formatSrtTimestamp(cue.startMs)} --> ${formatSrtTimestamp(cue.endMs)}\n${cue.text}\n`,
    )
    .join("\n");
}

/** Convenience: direction doc → its deterministic SRT (mirrors pillarScriptToSrt). */
export function directionDocToSrt(doc: DirectionDoc): string {
  return renderDirectionSrt(deriveDirectionTimeline(doc));
}
