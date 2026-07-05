import { z } from "zod";

/**
 * The `direction_doc` contract (B5.2, amendment A11): the complete direction
 * document a staged video is exported from. STRICT SCHEMA, never freeform
 * (founder-ratified decision 2, 2026-07-05) — the document round-trips
 * byte-identically through ./direction-md.ts (renderer/parser), so the
 * operator's raw-markdown view, the form view, and the persisted meta are
 * one artifact, not three.
 *
 * Deterministic-first doctrine (SPINE §1): everything here that CAN be
 * computed is computed — aspect/fps/pacing prefill from tenant platform
 * config, durations derive from narration length, dimensions derive from
 * aspect. The AI-fillable creative slots are exactly `visual`, `motion`,
 * `onScreenText`, and (at the polish stage) wording refinements — all
 * schema-bounded. Export is deterministic core, never a prompt.
 */

export const DIRECTION_DOC_VERSION = "direction.v1";

/** Root aspect ratios. Width/height are COMPILE-TIME constants of the composition (the render driver bakes them — they are never script/variable-settable, per the composition contract's forbidden-pattern list). */
export const DIRECTION_ASPECTS = ["16:9", "9:16", "1:1"] as const;
export type DirectionAspect = (typeof DIRECTION_ASPECTS)[number];

export const ASPECT_DIMENSIONS: Record<DirectionAspect, { width: number; height: number }> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
};

/** Scene motion vocabulary — enum slots with a deterministic easing mapping in the render driver, never freeform effect prose. */
export const DIRECTION_MOTIONS = ["smooth", "snappy", "bouncy", "dramatic"] as const;
export type DirectionMotion = (typeof DIRECTION_MOTIONS)[number];

/** Document-level pacing — a deterministic transition-speed mapping in the render driver. */
export const DIRECTION_PACINGS = ["fast", "medium", "slow"] as const;
export type DirectionPacing = (typeof DIRECTION_PACINGS)[number];

/** The literal ./direction-md.ts writes for a null field — reserved, so no real value can be mistaken for null on parse. */
export const DIRECTION_NONE_SENTINEL = "(none)";

/**
 * Every direction.md field is exactly one line, trimmed, and never the null
 * sentinel — the three constraints that make the byte-identical round-trip
 * a schema property instead of a renderer hope.
 */
const directionLine = z
  .string()
  .min(1)
  .max(500)
  .refine((s) => !/[\r\n]/.test(s), {
    message: "direction.md fields are single-line",
  })
  .refine((s) => s === s.trim(), {
    message: "no leading/trailing whitespace (byte-identical round-trip)",
  })
  .refine((s) => s !== DIRECTION_NONE_SENTINEL, {
    message: `"${DIRECTION_NONE_SENTINEL}" is reserved as the null sentinel`,
  });

export const directionSceneSchema = z.object({
  /** Must equal the scene's array position (contiguity is schema-enforced on the doc). */
  sceneIndex: z.number().int().min(0),
  heading: directionLine,
  /** The judged claim surface — narrations compose the draft body (I1). */
  narration: directionLine,
  onScreenText: directionLine.nullable(),
  /** Creative slot: null until the scenes/effects stage fills it. */
  visual: directionLine.nullable(),
  motion: z.enum(DIRECTION_MOTIONS),
  durationMs: z.number().int().positive().max(600_000),
});
export type DirectionScene = z.infer<typeof directionSceneSchema>;

export const directionDocSchema = z
  .object({
    docVersion: z.literal(DIRECTION_DOC_VERSION),
    title: directionLine,
    aspect: z.enum(DIRECTION_ASPECTS),
    fps: z.number().int().min(1).max(120),
    pacing: z.enum(DIRECTION_PACINGS),
    scenes: z.array(directionSceneSchema).min(1).max(100),
    cta: directionLine.nullable(),
  })
  .superRefine((doc, ctx) => {
    doc.scenes.forEach((scene, i) => {
      if (scene.sceneIndex !== i) {
        ctx.addIssue({
          code: "custom",
          path: ["scenes", i, "sceneIndex"],
          message: `sceneIndex ${scene.sceneIndex} at array position ${i} — scenes must be contiguous from 0 in order`,
        });
      }
    });
  });
export type DirectionDoc = z.infer<typeof directionDocSchema>;
