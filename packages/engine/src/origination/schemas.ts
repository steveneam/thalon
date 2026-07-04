import { z } from "zod";

/**
 * B3.9 shell→core boundary: the pillar-script generator's output contract
 * (SPINE §1 — shell returns candidates only; core validates here before
 * anything persists). A pillar script is the judged artifact a pillar video
 * is rendered from at B3.10: an ordered list of beats, each carrying its
 * narration line (the caption/SRT text is derived from exactly these lines),
 * optional on-screen text, an optional visual hint for the render composition,
 * and an optional duration hint.
 */
export const pillarBeatSchema = z.object({
  narration: z.string().min(1),
  onScreenText: z.string().min(1).optional(),
  visualHint: z.string().min(1).optional(),
  durationHintMs: z.number().int().positive().optional(),
});

export const pillarScriptShellOutputSchema = z.object({
  title: z.string().min(1),
  hook: z.string().min(1),
  beats: z.array(pillarBeatSchema).min(1).max(40),
  cta: z.string().min(1).optional(),
});

export type PillarBeat = z.infer<typeof pillarBeatSchema>;
export type PillarScriptShellOutput = z.infer<typeof pillarScriptShellOutputSchema>;

/**
 * The PINNED `pillar_script` draft-meta contract (mirrors B2.5's
 * demoPlanDraftMetaSchema role): the approve-queue UI renders from this and
 * the B3.10 render seam consumes it — extend additively only; never
 * rename/remove a field outside a contract window. `groundingSourceIds`
 * lists EVERY source this script may draw claims from (the operator's
 * prompt source plus any site-crawl/repo sources); the judge callers ground
 * against all of them via `collectGroundingChunks`.
 *
 * `renderStatus`/`renderRef` (B3.10, additive — mirrors demo_plan's
 * captureStatus/captureRef): "scripted" until a render succeeds; the
 * defaults keep drafts persisted before B3.10 parsing unchanged. Only
 * ../render/render.ts moves these fields.
 */
export const pillarScriptDraftMetaSchema = z.object({
  title: z.string().min(1),
  hook: z.string().min(1),
  beats: z
    .array(pillarBeatSchema.extend({ beatIndex: z.number().int().nonnegative() }))
    .min(1),
  cta: z.string().nullable(),
  groundingSourceIds: z.array(z.string().min(1)).min(1),
  promptVersion: z.string().min(1),
  brandProfileVersion: z.number().int(),
  platformProfileVersion: z.string().min(1),
  renderStatus: z.enum(["scripted", "rendered", "failed"]).default("scripted"),
  /** null until a render succeeds; then the content-addressed object-store key of the render manifest */
  renderRef: z.string().nullable().default(null),
});

export type PillarScriptDraftMeta = z.infer<typeof pillarScriptDraftMetaSchema>;
