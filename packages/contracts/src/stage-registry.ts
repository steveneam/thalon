import { z } from "zod";

/**
 * The staged-creation registry (B5.2, amendment A11): per-family ORDERED
 * stage list — the stage COUNT is config, not code. The shipped default for
 * the video family is 3 stages (structure → scenes/effects → polish); a
 * plan with 2 or 5 stages is equally valid data, and the staged pipeline in
 * @thalon/engine runs whatever plan it is handed. One-prompt mode and
 * advanced mode run the SAME plan through the SAME code path — one-prompt
 * just auto-advances on prefill defaults.
 *
 * Export (direction doc → timeline/SRT/render manifest) is DETERMINISTIC
 * CORE, never a prompt — which is why no plan has an "export" stage: it is
 * not a stage, it is a pure function.
 */

/** The only formats a stage may persist. Stage 1 authors structure (`storyboard`); every later stage transforms the direction document (`direction_doc`). */
export const STAGED_DRAFT_FORMATS = ["storyboard", "direction_doc"] as const;
export type StagedDraftFormat = (typeof STAGED_DRAFT_FORMATS)[number];

export const stageDefSchema = z.object({
  /** Stable machine key ("structure", "scenes_effects", …) — recorded on every stage draft's meta as provenance. */
  key: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9_]*$/, "stage keys are snake_case identifiers"),
  /** Operator-facing stage title (the B5.4 staged-flow UI renders it). */
  title: z.string().min(1),
  /** The draft format this stage persists. */
  produces: z.enum(STAGED_DRAFT_FORMATS),
  /** Versioned prompt-file stem in proprietary/prompts (`<name>.v<N>` — ".md" appended at read time). Doubles as the stage's prompt_version (SPINE §3.2). */
  promptSlug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+\.v\d+$/, "prompt slugs are versioned file stems like storyboard-stage-structure.v1"),
});
export type StageDef = z.infer<typeof stageDefSchema>;

export const stagePlanSchema = z
  .object({
    /** The creation family this plan drives ("video"). Free-form so future families arrive as data. */
    family: z.string().min(1),
    stages: z.array(stageDefSchema).min(1).max(8),
  })
  .superRefine((plan, ctx) => {
    const seen = new Set<string>();
    plan.stages.forEach((stage, i) => {
      if (seen.has(stage.key)) {
        ctx.addIssue({
          code: "custom",
          path: ["stages", i, "key"],
          message: `duplicate stage key "${stage.key}" — stage keys are unique within a plan`,
        });
      }
      seen.add(stage.key);
      const expected = i === 0 ? "storyboard" : "direction_doc";
      if (stage.produces !== expected) {
        ctx.addIssue({
          code: "custom",
          path: ["stages", i, "produces"],
          message:
            i === 0
              ? `the first stage authors the structure and must produce "storyboard" (got "${stage.produces}")`
              : `every stage after the first transforms the direction document and must produce "direction_doc" (got "${stage.produces}")`,
        });
      }
    });
  });
export type StagePlan = z.infer<typeof stagePlanSchema>;

/** The shipped default video plan: 3 stages. The count being config means a tenant-supplied plan simply replaces this VALUE — no code change. */
export const VIDEO_STAGE_PLAN: StagePlan = stagePlanSchema.parse({
  family: "video",
  stages: [
    {
      key: "structure",
      title: "Structure",
      produces: "storyboard",
      promptSlug: "storyboard-stage-structure.v1",
    },
    {
      key: "scenes_effects",
      title: "Scenes & effects",
      produces: "direction_doc",
      promptSlug: "direction-stage-scenes.v1",
    },
    {
      key: "polish",
      title: "Polish",
      produces: "direction_doc",
      promptSlug: "direction-stage-polish.v1",
    },
  ],
});

export const STAGE_PLAN_REGISTRY: Readonly<Record<string, StagePlan>> = {
  video: VIDEO_STAGE_PLAN,
};

/** Resolves a family's shipped stage plan — loud on an unknown family (a typo must never silently run the video plan). */
export function resolveStagePlan(family: string): StagePlan {
  const plan = STAGE_PLAN_REGISTRY[family];
  if (!plan) {
    throw new Error(
      `no stage plan registered for family "${family}" (known: ${Object.keys(STAGE_PLAN_REGISTRY).join(", ")})`,
    );
  }
  return plan;
}
