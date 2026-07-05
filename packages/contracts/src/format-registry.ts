import { z } from "zod";
import type { DraftFormat } from "./draft-format";

/**
 * THE format contract registry (B4.2, amendment A10): per-format pinned
 * draft-meta schema + capabilities, declared ONCE here in contracts so
 * engine (persists/parses), apps/web (renders — deliberately does not
 * depend on the heavy engine package), and the artifact stages all route
 * through the same declaration instead of scattered `format === "x"`
 * branches and hand-kept mirrors. Extend a meta schema additively only;
 * never rename/remove a field outside a contract window.
 *
 * The executable ratchet lives in
 * packages/engine/src/__tests__/format-registry.test.ts: every draft each
 * pipeline persists must parse against its registered schema, and every
 * meta-derivable body must reproduce `drafts.body` byte-for-byte (I1
 * body_hash binding).
 */

/**
 * `post` (Sprint-1 fan-out) meta: generation provenance. `drafts.format` is
 * deliberately open-ended for social drafts (generator shells may emit
 * platform-native format names) — `resolveDraftFormatSpec` maps every
 * non-registered format to this spec, because whatever the shell called it,
 * the fan-out persisted exactly this meta shape.
 */
export const postDraftMetaSchema = z.object({
  promptVersion: z.string(),
  brandProfileVersion: z.number().int(),
  platformProfileVersion: z.string(),
  /** Present only when the active profile carried identity content (B3.8). */
  identityPromptVersion: z.string().optional(),
  /** Present only on exemplar-aware runs (B2.4) — grounding provenance, never republished. */
  exemplarIds: z.array(z.string()).optional(),
});
export type PostDraftMeta = z.infer<typeof postDraftMetaSchema>;

/** `clip_plan` (B2.3 waterfall) meta — timing/window provenance + the three body pieces. */
export const clipPlanDraftMetaSchema = z.object({
  /** Milliseconds into the source media where this clip starts/ends (CandidateWindow.startMs/endMs). */
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(0),
  durationMs: z.number().int().min(0),
  /** Index into the run's derived CandidateWindow[] this draft was cut from. */
  windowIndex: z.number().int().min(0),
  /** `source_chunks.seq` values composing the window — chunk-level provenance. */
  chunkSeqs: z.array(z.number().int()),
  hook: z.string(),
  captions: z.string(),
  platformCopy: z.string(),
  promptVersion: z.string(),
  brandProfileVersion: z.number().int(),
  platformProfileVersion: z.string(),
});
export type ClipPlanDraftMeta = z.infer<typeof clipPlanDraftMetaSchema>;

/** `demo_plan` (B2.5) storyboard step — the pinned cross-lane contract from wave-2 kickoff. */
export const demoPlanStepSchema = z.object({
  stepIndex: z.number().int().min(0),
  action: z.enum(["goto", "click", "fill", "press", "expect"]),
  /** URL (for goto) or CSS selector (all other actions) — must exist in the flow map */
  target: z.string().min(1),
  /** Text typed / key pressed / assertion text — empty string when N/A */
  value: z.string(),
  /** Operator-facing narration; the narrations joined "\n\n" = drafts.body (the judged text) */
  narration: z.string().min(1),
});
export type DemoPlanStep = z.infer<typeof demoPlanStepSchema>;

/** `demo_plan` (B2.5) meta. */
export const demoPlanDraftMetaSchema = z.object({
  steps: z.array(demoPlanStepSchema).min(1),
  /** sources.id of the site_crawl this storyboard grounds against */
  crawlSourceId: z.string(),
  /** URLs the storyboard touches, from the flow map */
  pageUrls: z.array(z.string()).min(1),
  captureStatus: z.enum(["planned", "captured", "failed"]),
  /** null until a capture succeeds; then the content-addressed object-store key of the capture bundle */
  captureRef: z.string().nullable(),
  promptVersion: z.string(),
  brandProfileVersion: z.number().int(),
  platformProfileVersion: z.string(),
});
export type DemoPlanDraftMeta = z.infer<typeof demoPlanDraftMetaSchema>;

/** One pillar-script beat as the B3.9 shell emits it (no index — core assigns beatIndex from array order). */
export const pillarBeatSchema = z.object({
  narration: z.string().min(1),
  onScreenText: z.string().min(1).optional(),
  visualHint: z.string().min(1).optional(),
  durationHintMs: z.number().int().positive().optional(),
});
export type PillarBeat = z.infer<typeof pillarBeatSchema>;

/**
 * `pillar_script` (B3.9) meta. `renderStatus`/`renderRef` (B3.10, additive —
 * mirrors demo_plan's captureStatus/captureRef): "scripted" until a render
 * succeeds; the defaults keep drafts persisted before B3.10 parsing
 * unchanged. Only the render artifact stage moves these fields.
 */
export const pillarScriptDraftMetaSchema = z.object({
  title: z.string().min(1),
  hook: z.string().min(1),
  beats: z.array(pillarBeatSchema.extend({ beatIndex: z.number().int().nonnegative() })).min(1),
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

/** `web_page` (B3.15) meta. `deployStatus`/`deployRef` mirror the render/capture convention. */
export const webPageDraftMetaSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  htmlRef: z.string().min(1),
  groundingSourceIds: z.array(z.string().min(1)).min(1),
  promptVersion: z.string().min(1),
  brandProfileVersion: z.number().int(),
  platformProfileVersion: z.string().min(1),
  deployStatus: z.enum(["drafted", "deployed", "failed"]).default("drafted"),
  /** null until a deploy succeeds; then the target-reported URL/ref of the live preview or site */
  deployRef: z.string().nullable().default(null),
});
export type WebPageDraftMeta = z.infer<typeof webPageDraftMetaSchema>;

/** Post-approval artifact capabilities — exactly the render/deploy/capture trio the artifact stage serves. */
export interface DraftFormatCapabilities {
  renderable: boolean;
  deployable: boolean;
  capturable: boolean;
}

/**
 * Type-erased spec view (what `resolveDraftFormatSpec` returns). Method
 * syntax on `expectedBody` is deliberate — it lets each registry entry keep
 * its precisely-typed meta parameter while remaining assignable here.
 */
export interface ResolvedDraftFormatSpec {
  format: DraftFormat;
  /** Pinned meta schema — every persisted draft of this format must parse against it (the B4.2 ratchet). */
  meta: {
    parse(input: unknown): unknown;
    safeParse(input: unknown): { success: boolean };
  };
  capabilities: DraftFormatCapabilities;
  /** Meta fields holding post-approval artifact refs (null until that stage succeeds). */
  artifactRefFields: readonly string[];
  /**
   * Judged-body derivation from meta (the I1 body_hash convention) —
   * undefined when body isn't meta-derived (post: body IS the authored
   * copy; web_page: body derives from the stored HTML artifact via
   * extractVisibleText, not from meta).
   */
  expectedBody?(meta: unknown): string;
}

const NO_ARTIFACTS: DraftFormatCapabilities = {
  renderable: false,
  deployable: false,
  capturable: false,
};

export const DRAFT_FORMAT_REGISTRY = {
  post: {
    format: "post",
    meta: postDraftMetaSchema,
    capabilities: NO_ARTIFACTS,
    artifactRefFields: [],
  },
  clip_plan: {
    format: "clip_plan",
    meta: clipPlanDraftMetaSchema,
    // Clip rendering is B3.3/B3.4 — no artifact stage exists for clips yet.
    capabilities: NO_ARTIFACTS,
    artifactRefFields: [],
    expectedBody: (meta: ClipPlanDraftMeta) => [meta.hook, meta.captions, meta.platformCopy].join("\n\n"),
  },
  demo_plan: {
    format: "demo_plan",
    meta: demoPlanDraftMetaSchema,
    capabilities: { ...NO_ARTIFACTS, capturable: true },
    artifactRefFields: ["captureRef"],
    expectedBody: (meta: DemoPlanDraftMeta) => meta.steps.map((step) => step.narration).join("\n\n"),
  },
  pillar_script: {
    format: "pillar_script",
    meta: pillarScriptDraftMetaSchema,
    capabilities: { ...NO_ARTIFACTS, renderable: true },
    artifactRefFields: ["renderRef"],
    expectedBody: (meta: PillarScriptDraftMeta) =>
      [
        meta.title,
        meta.hook,
        ...meta.beats.map((beat) => beat.narration),
        ...(meta.cta ? [meta.cta] : []),
      ].join("\n\n"),
  },
  web_page: {
    format: "web_page",
    meta: webPageDraftMetaSchema,
    capabilities: { ...NO_ARTIFACTS, deployable: true },
    artifactRefFields: ["htmlRef", "deployRef"],
    // body = extractVisibleText(stored html) — artifact-derived, NOT meta-derived.
  },
} as const satisfies Record<DraftFormat, ResolvedDraftFormatSpec>;

/**
 * Maps a persisted `drafts.format` to its registered spec. Unregistered
 * (platform-native shell-emitted) and null formats resolve to `post` — the
 * open-ended social family whose meta shape the fan-out always persists.
 */
export function resolveDraftFormatSpec(format: string | null | undefined): ResolvedDraftFormatSpec {
  if (format && format in DRAFT_FORMAT_REGISTRY) {
    return DRAFT_FORMAT_REGISTRY[format as DraftFormat];
  }
  return DRAFT_FORMAT_REGISTRY.post;
}
