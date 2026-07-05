import { z } from "zod";
import { DIRECTION_MOTIONS } from "@thalon/contracts";

/**
 * B5.2 shell→core boundaries for the three shipped video stages (SPINE §1:
 * shell returns candidates only; core validates before anything persists).
 * Each stage's creative surface is exactly what its schema admits — the
 * deterministic fields (aspect/fps/pacing, scene count/order) are absent
 * here BY CONSTRUCTION, so a shell cannot even attempt to move them.
 */

/** Structure stage: the shell emits scenes WITHOUT sceneIndex — core assigns it from array order once the candidate survives validation (mirrors pillar beats). */
export const storyboardStageShellOutputSchema = z.object({
  title: z.string().min(1).max(200),
  scenes: z
    .array(
      z.object({
        heading: z.string().min(1).max(200),
        narration: z.string().min(1).max(500),
        onScreenText: z.string().min(1).max(200).optional(),
        visualHint: z.string().min(1).max(500).optional(),
        durationHintMs: z.number().int().positive().max(600_000).optional(),
      }),
    )
    .min(1)
    .max(40),
  cta: z.string().min(1).max(200).optional(),
});
export type StoryboardStageShellOutput = z.infer<typeof storyboardStageShellOutputSchema>;

/** Scenes/effects stage: creative slots ONLY, addressed by sceneIndex. */
export const directionScenesShellOutputSchema = z.object({
  scenes: z
    .array(
      z.object({
        sceneIndex: z.number().int().min(0),
        visual: z.string().min(1).max(500),
        motion: z.enum(DIRECTION_MOTIONS),
        onScreenText: z.string().min(1).max(200).nullable(),
      }),
    )
    .min(1)
    .max(100),
});
export type DirectionScenesShellOutput = z.infer<typeof directionScenesShellOutputSchema>;

/** Polish stage: the full creative surface — but the scene set is pinned (same indexes, same count; validated against the current doc). */
export const directionPolishShellOutputSchema = z.object({
  title: z.string().min(1).max(200),
  cta: z.string().min(1).max(200).nullable(),
  scenes: z
    .array(
      z.object({
        sceneIndex: z.number().int().min(0),
        heading: z.string().min(1).max(200),
        narration: z.string().min(1).max(500),
        onScreenText: z.string().min(1).max(200).nullable(),
        visual: z.string().min(1).max(500),
        motion: z.enum(DIRECTION_MOTIONS),
        durationMs: z.number().int().positive().max(600_000),
      }),
    )
    .min(1)
    .max(100),
});
export type DirectionPolishShellOutput = z.infer<typeof directionPolishShellOutputSchema>;
