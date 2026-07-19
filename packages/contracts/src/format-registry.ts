import { z } from "zod";
import type { DraftFormat } from "./draft-format";
import { directionDocSchema } from "./direction-doc";
import { seoMetaSchema } from "./search-intel";

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
  /** B6.8 SEO-meta capability — optional, so every pre-B6.8 draft parses unchanged. */
  seo: seoMetaSchema.optional(),
});
export type PillarScriptDraftMeta = z.infer<typeof pillarScriptDraftMetaSchema>;

/**
 * One storyboard scene as the structure stage persists it (B5.2). Scene 1
 * is the hook by convention (prompt-enforced) — there is no separate hook
 * field, so storyboard scenes map 1:1 onto direction-doc scenes and the
 * prefill stays purely mechanical.
 */
export const storyboardSceneSchema = z.object({
  /** Must equal the scene's array position (contiguity is schema-enforced below). */
  sceneIndex: z.number().int().min(0),
  heading: z.string().min(1),
  narration: z.string().min(1),
  onScreenText: z.string().min(1).optional(),
  visualHint: z.string().min(1).optional(),
  durationHintMs: z.number().int().positive().optional(),
});
export type StoryboardScene = z.infer<typeof storyboardSceneSchema>;

const contiguousScenes = <T extends { sceneIndex: number }>(
  scenes: T[],
  ctx: z.RefinementCtx,
  path: (string | number)[] = ["scenes"],
) => {
  scenes.forEach((scene, i) => {
    if (scene.sceneIndex !== i) {
      ctx.addIssue({
        code: "custom",
        path: [...path, i, "sceneIndex"],
        message: `sceneIndex ${scene.sceneIndex} at array position ${i} — scenes must be contiguous from 0 in order`,
      });
    }
  });
};

/**
 * `storyboard` (B5.2) meta — the structure stage's artifact. `stageKey`/
 * `stageIndex`/`family` are stage provenance from the stage plan
 * (./stage-registry.ts) that produced it; the staged pipeline advances a
 * draft by reading them back (self-describing — no side-channel state).
 */
export const storyboardDraftMetaSchema = z
  .object({
    title: z.string().min(1),
    scenes: z.array(storyboardSceneSchema).min(1),
    cta: z.string().nullable(),
    family: z.string().min(1),
    stageKey: z.string().min(1),
    stageIndex: z.number().int().min(0),
    groundingSourceIds: z.array(z.string().min(1)).min(1),
    promptVersion: z.string().min(1),
    brandProfileVersion: z.number().int(),
    platformProfileVersion: z.string().min(1),
  })
  .superRefine((meta, ctx) => contiguousScenes(meta.scenes, ctx));
export type StoryboardDraftMeta = z.infer<typeof storyboardDraftMetaSchema>;

/**
 * `direction_doc` (B5.2) meta — the scenes/effects and polish stages'
 * artifact: the complete strict-schema direction document (./direction-doc.ts)
 * plus stage + advance provenance. `renderStatus`/`renderRef` mirror
 * pillar_script's convention: only the render artifact stage moves them.
 */
export const directionDocDraftMetaSchema = z.object({
  doc: directionDocSchema,
  family: z.string().min(1),
  stageKey: z.string().min(1),
  stageIndex: z.number().int().min(1),
  /** The stage draft this was advanced FROM (storyboard for stage 2, prior direction_doc after). */
  priorDraftId: z.string().min(1),
  groundingSourceIds: z.array(z.string().min(1)).min(1),
  promptVersion: z.string().min(1),
  brandProfileVersion: z.number().int(),
  platformProfileVersion: z.string().min(1),
  renderStatus: z.enum(["directed", "rendered", "failed"]).default("directed"),
  /** null until a render succeeds; then the content-addressed object-store key of the render manifest. */
  renderRef: z.string().nullable().default(null),
  /** B6.8 SEO-meta capability — optional, so every pre-B6.8 draft parses unchanged. */
  seo: seoMetaSchema.optional(),
});
export type DirectionDocDraftMeta = z.infer<typeof directionDocDraftMetaSchema>;

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
  /** B6.8 SEO-meta capability — optional, so every pre-B6.8 draft parses unchanged. */
  seo: seoMetaSchema.optional(),
});
export type WebPageDraftMeta = z.infer<typeof webPageDraftMetaSchema>;

/**
 * `outreach_email` (B-crm.4 front half, Sprint-7 window amendment 1c) meta —
 * the clip_plan convention: the judged body's pieces live here so
 * `expectedBody` reproduces `drafts.body` byte-for-byte (I1). The subject is
 * INSIDE the judged body on purpose: recipients read it, so the judge must
 * too. `recipient` is provenance the queue renders (To: line + the manual
 * copy-out affordance). s54 window: the format is now `sendable` — the
 * B-crm.4 send door reaches ONLY APPROVED drafts of this format ("no
 * ungated contact, ever" holds by construction; live send stays behind its
 * own founder-gated ops door).
 */
export const outreachEmailDraftMetaSchema = z.object({
  subject: z.string().min(1),
  emailBody: z.string().min(1),
  recipient: z.object({
    /** `leads.id` this draft addresses — resolved by the caller from the leads repo, never invented. */
    leadId: z.string().min(1),
    email: z.string().min(1),
    name: z.string().nullable(),
  }),
  groundingSourceIds: z.array(z.string().min(1)).min(1),
  promptVersion: z.string().min(1),
  brandProfileVersion: z.number().int(),
  platformProfileVersion: z.string().min(1),
});
export type OutreachEmailDraftMeta = z.infer<typeof outreachEmailDraftMetaSchema>;

/**
 * Post-approval artifact capabilities — the render/deploy/capture trio the
 * artifact stage serves, plus `seoMeta` (B6.8, amendment A13): whether the
 * format's meta carries the optional `seo` block (./search-intel.ts) that
 * the deterministic on-page checks and the judge's SEO/AEO lens read.
 */
export interface DraftFormatCapabilities {
  renderable: boolean;
  deployable: boolean;
  capturable: boolean;
  seoMeta: boolean;
  /**
   * B-crm.4 (s54 window): whether the approve-door send op
   * (`outreach.send_email`) may target an APPROVED draft of this format.
   * The op itself is engine work behind this flag; a send is recorded in
   * `outreach_sends` (one per draft, structurally) and LIVE sending stays
   * behind its own founder-gated ops door — this flag only says the format
   * is eligible.
   */
  sendable: boolean;
  /**
   * Sprint-8 window 2: whether the B-pub publish door may hand an APPROVED
   * draft of this format to a social publisher (the sendable convention,
   * platform-scoped). The door reads THIS flag — never a format-name
   * branch — so making a future format postable is a registry edit, not a
   * door edit. Live posting stays behind the per-platform arming ratchet
   * (credential + founder GO + driver); this flag only says the format is
   * eligible.
   */
  publishable: boolean;
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
  seoMeta: false,
  sendable: false,
  publishable: false,
};

export const DRAFT_FORMAT_REGISTRY = {
  post: {
    format: "post",
    meta: postDraftMetaSchema,
    // Sprint-8 window 2: the ONE publishable family — unregistered
    // (platform-native shell-emitted) formats resolve here, so every social
    // draft the fan-out persists is publish-eligible by construction.
    capabilities: { ...NO_ARTIFACTS, publishable: true },
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
    capabilities: { ...NO_ARTIFACTS, renderable: true, seoMeta: true },
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
    capabilities: { ...NO_ARTIFACTS, deployable: true, seoMeta: true },
    artifactRefFields: ["htmlRef", "deployRef"],
    // body = extractVisibleText(stored html) — artifact-derived, NOT meta-derived.
  },
  storyboard: {
    format: "storyboard",
    meta: storyboardDraftMetaSchema,
    // An intermediate stage artifact — the direction_doc it advances into is what renders.
    capabilities: NO_ARTIFACTS,
    artifactRefFields: [],
    expectedBody: (meta: StoryboardDraftMeta) =>
      [
        meta.title,
        ...meta.scenes.map((scene) => scene.narration),
        ...(meta.cta ? [meta.cta] : []),
      ].join("\n\n"),
  },
  direction_doc: {
    format: "direction_doc",
    meta: directionDocDraftMetaSchema,
    capabilities: { ...NO_ARTIFACTS, renderable: true, seoMeta: true },
    artifactRefFields: ["renderRef"],
    expectedBody: (meta: DirectionDocDraftMeta) =>
      [
        meta.doc.title,
        ...meta.doc.scenes.map((scene) => scene.narration),
        ...(meta.doc.cta ? [meta.doc.cta] : []),
      ].join("\n\n"),
  },
  outreach_email: {
    format: "outreach_email",
    meta: outreachEmailDraftMetaSchema,
    // s54 window: the ONE sendable format — the B-crm.4 send door attaches
    // behind the approve gate. Still no render/deploy/capture stage.
    capabilities: { ...NO_ARTIFACTS, sendable: true },
    artifactRefFields: [],
    expectedBody: (meta: OutreachEmailDraftMeta) => [meta.subject, meta.emailBody].join("\n\n"),
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
