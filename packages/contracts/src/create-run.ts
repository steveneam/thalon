import { z } from "zod";
import { MEDIA_ROLES, mediaRefEnvelopeSchema } from "./media";

/**
 * s87 window (B-create.1): the shapes the Create run engine is built on —
 * **Brief → Plan → Generate → Composer → Approve**, the flow that un-orphans
 * the Composer. Charter: `docs/create-engine/spec.md` (APPROVED, founder
 * 2026-07-29). This file ships the validated shapes and their vocabularies;
 * plan derivation and the orchestrator are LANE work against the frozen
 * contract (kickoff `agent_handoff/lanes/KICKOFF-create-engine.md`).
 *
 * The one structural idea worth stating once: Create adds **no generation
 * code**. It records a brief, derives a plan, dispatches to the family
 * engines that already exist and judge their own output, and records what
 * came back. Every shape below serves that and nothing more.
 */

/* ------------------------------------------------------------------ */
/* Vocabularies — closed, because each one is dispatched on.            */
/* ------------------------------------------------------------------ */

/**
 * The output families Create can run. CLOSED, unlike `stage-registry`'s
 * free-form family string, and the difference is load-bearing: a stage plan
 * merely *describes* stages, while `runCreate` must pick an ENGINE per
 * family. There is no dispatch arm for a family nobody registered, so an
 * unknown one is an error rather than data — and adding one is a contract
 * window because it also needs its arm.
 *
 * `apps/web`'s `CreateFamily` is re-pointed at this list rather than kept as
 * a hand-copied mirror (the format-registry docblock's complaint, applied).
 */
export const CREATE_FAMILIES = ["post", "video", "page", "email"] as const;
export type CreateFamily = (typeof CREATE_FAMILIES)[number];
export const createFamilySchema = z.enum(CREATE_FAMILIES);

/**
 * How the brief was authored. `prompt` is today's hero and survives
 * unchanged (spec R2 — the wizard is an offer, never a wall); `wizard` is
 * the deterministic staged path. Recorded for provenance: an eval row wants
 * to know which door produced the draft it is grading.
 */
export const CREATE_MODES = ["prompt", "wizard"] as const;
export type CreateMode = (typeof CREATE_MODES)[number];
export const createModeSchema = z.enum(CREATE_MODES);

/**
 * Run lifecycle words — deliberately the SAME four as `FANOUT_RUN_STATUSES`,
 * with the same doctrine: operator telemetry, never a control-flow input.
 * Nothing may branch on run status, so its writer enforces no transition
 * graph — bookkeeping must never veto a live generation run.
 */
export const CREATE_RUN_STATUSES = ["pending", "running", "complete", "failed"] as const;
export type CreateRunStatus = (typeof CREATE_RUN_STATUSES)[number];
export const createRunStatusSchema = z.enum(CREATE_RUN_STATUSES);

/**
 * What a Create run can point AT, grounded in what the family engines
 * actually produce rather than in the spec's prose sketch:
 *
 *  - every family lands through the shared single-draft spine or the
 *    fan-out, and `drafts.fanout_run_id` is NOT NULL — so a `fanout_run`
 *    anchor and one or more `draft` rows exist for post, page and email
 *    alike (`runWebPageGeneration` / `runOutreachEmail` both return a
 *    `runId` + `draft` for exactly this reason);
 *  - staged video additionally owns a `video_project`.
 *
 * Kept as `kind` + `id` rather than a column of FKs per family (spec
 * Decision 6): the run surfaces read loosely, and four nullable FKs would
 * encode a shape the product does not have.
 */
export const CREATE_CHILD_KINDS = ["fanout_run", "draft", "video_project"] as const;
export type CreateChildKind = (typeof CREATE_CHILD_KINDS)[number];

/**
 * Why plan derivation refused a platform. Coded as well as worded so the
 * lane's "every refusal reason pinned by a test" is pinnable on something
 * stable — the message is the operator's sentence and may be reworded
 * freely; the code is the contract.
 */
export const CREATE_REFUSAL_CODES = [
  /** The destination is not a platform this engine knows at all. */
  "unknown_platform",
  /** Known platform, no connected channel — the fix is the connect dance. */
  "channel_not_connected",
  /** The D0 capability matrix says this family cannot ride this platform. */
  "family_platform_mismatch",
  /** The platform refuses text-only posts and the brief carries no use-role media. */
  "media_required",
] as const;
export type CreateRefusalCode = (typeof CREATE_REFUSAL_CODES)[number];

/* ------------------------------------------------------------------ */
/* The brief — what the operator asked for.                             */
/* ------------------------------------------------------------------ */

/**
 * Media attached to a run, with its role REQUIRED.
 *
 * This is the one place the two-role model is not optional, and the
 * asymmetry is deliberate. `mediaRefEnvelopeSchema.role` is optional so
 * every pre-window envelope still parses (absence reads as `use`, today's
 * behavior); but at the Create attach door the operator is making a
 * licensing-relevant declaration, and spec R4 says it is explicit at attach
 * time. Inferring it from context was considered and rejected (Decision 4):
 * silent inference on licensing semantics is exactly the kind of guess that
 * is invisible until it is expensive.
 */
export const createBriefMediaSchema = mediaRefEnvelopeSchema.extend({
  role: z.enum(MEDIA_ROLES),
});
export type CreateBriefMedia = z.infer<typeof createBriefMediaSchema>;

export const createBriefSchema = z.strictObject({
  family: createFamilySchema,
  mode: createModeSchema,
  /** The operator's prompt. Absent on a pure-wizard brief whose slots carry the intent. */
  prompt: z.string().min(1).optional(),
  /**
   * Intel context that seeded this run (the CreateContext a pick chip
   * carries). Open shape on purpose — per-family vocabulary is DATA, the
   * `intel.ts` convention.
   */
  context: z.record(z.string(), z.unknown()).optional(),
  /** Destinations the operator asked for, before routing defaults and the matrix have their say. */
  platforms: z.array(z.string().min(1)).default([]),
  /** Grounding picks (`sources.id`) the judge will hold the output to. */
  sourceRefs: z.array(z.string().min(1)).default([]),
  media: z.array(createBriefMediaSchema).default([]),
  /** Wizard slot values, when mode is `wizard`. Open shape — slots are config. */
  wizard: z.record(z.string(), z.unknown()).optional(),
});
export type CreateBrief = z.infer<typeof createBriefSchema>;
export type CreateBriefInput = z.input<typeof createBriefSchema>;

/* ------------------------------------------------------------------ */
/* The plan — what the run WILL do, shown before it spends.             */
/* ------------------------------------------------------------------ */

export const createRefusalSchema = z.strictObject({
  code: z.enum(CREATE_REFUSAL_CODES),
  /**
   * The operator-facing sentence. House rule R10: it says why AND names the
   * fix — a refusal that only says "no" sends the operator hunting.
   */
  message: z.string().min(1),
});
export type CreateRefusal = z.infer<typeof createRefusalSchema>;

/**
 * One destination's verdict. `admitted` and `refusal` are bound to each
 * other by `createPlanSchema`'s refinement rather than by convention: an
 * admitted platform carrying a refusal (or a refused one carrying none) is
 * a shape that cannot be stored, so no consumer has to defend against it.
 */
export const platformPlanSchema = z.strictObject({
  platform: z.string().min(1),
  admitted: z.boolean(),
  refusal: createRefusalSchema.optional(),
});
export type PlatformPlan = z.infer<typeof platformPlanSchema>;

/**
 * What the run will cost, shown BEFORE spend (spec R6 — HubSpot's
 * review-outline pattern). `unestimated` is the honesty valve: a family that
 * cannot price itself says so in words, because a missing number rendered as
 * `0` would read as "free" — the exact fabricated-default the house rules
 * forbid (R10).
 */
export const costPreviewSchema = z.strictObject({
  /** Mint credits the run will spend, when the family can estimate them. */
  credits: z.number().min(0).optional(),
  /** Metered gateway calls the run will make. */
  meteredCalls: z.number().int().min(0).optional(),
  /** Named reasons a cost is absent. Non-empty whenever a number above is missing. */
  unestimated: z.array(z.string().min(1)).default([]),
});
export type CostPreview = z.infer<typeof costPreviewSchema>;

/**
 * s70c blog-mirror pairing, recorded by derivation so the Composer and the
 * Approve queue can show the article and its social set as ONE decision
 * rather than as unrelated drafts that happen to share a run.
 */
export const blogMirrorPlanSchema = z.strictObject({
  /** The destination that carries the article itself. */
  articlePlatform: z.string().min(1),
  /** The destinations whose posts mirror it. */
  mirrorPlatforms: z.array(z.string().min(1)).default([]),
});
export type BlogMirrorPlan = z.infer<typeof blogMirrorPlanSchema>;

export const createPlanSchema = z
  .strictObject({
    platforms: z.array(platformPlanSchema).default([]),
    /** Judge gates this run must clear — NAMES only; the harness owns the lenses. */
    judgeGates: z.array(z.string().min(1)).default([]),
    /** Discoverability terms threaded into generation (the fan-out's targetTerms). */
    targetTerms: z.array(z.string().min(1)).default([]),
    costPreview: costPreviewSchema.optional(),
    blogMirror: blogMirrorPlanSchema.optional(),
    /** Per-family plan detail (video beat estimate, page shape…). Open — each family owns its own. */
    family: z.record(z.string(), z.unknown()).default({}),
  })
  .superRefine((plan, ctx) => {
    for (const [i, entry] of plan.platforms.entries()) {
      if (entry.admitted && entry.refusal !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["platforms", i, "refusal"],
          message: `platform "${entry.platform}" is admitted and cannot also carry a refusal`,
        });
      }
      if (!entry.admitted && entry.refusal === undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["platforms", i, "refusal"],
          message: `platform "${entry.platform}" is refused and must say why (R10: name the reason and the fix)`,
        });
      }
    }
  });
export type CreatePlan = z.infer<typeof createPlanSchema>;
export type CreatePlanInput = z.input<typeof createPlanSchema>;

/** The destinations a derived plan will actually generate for. */
export function admittedPlatforms(plan: CreatePlan): string[] {
  return plan.platforms.filter((p) => p.admitted).map((p) => p.platform);
}

/* ------------------------------------------------------------------ */
/* Children — what the run produced.                                    */
/* ------------------------------------------------------------------ */

export const createChildRefSchema = z.strictObject({
  kind: z.enum(CREATE_CHILD_KINDS),
  id: z.string().min(1),
  /**
   * The verbatim failure when this child refused. Absent = it ran. Spec
   * Error Behavior: one child failing is RECORDED and the others proceed —
   * a partial run is a real state, not an exception to swallow.
   */
  error: z.string().min(1).optional(),
});
export type CreateChildRef = z.infer<typeof createChildRefSchema>;

export const createChildRefsSchema = z.array(createChildRefSchema);

/* ------------------------------------------------------------------ */
/* Routing — family → default destinations, per tenant.                 */
/* ------------------------------------------------------------------ */

/**
 * ⚠ **THIS IS NOT `routingTableSchema`, and collapsing the two would be a
 * real defect.** They are both "name → platforms" maps and they answer
 * different questions:
 *
 *  - `routing` (B7.e, shipped) is keyed by **content bucket** — tenant
 *    vocabulary, free-form topics and pillars — and it answers *"a post
 *    about X goes where?"*. It is read by the fan-out, per request.
 *  - `platformRouting` (this) is keyed by **Create family** — a CLOSED,
 *    code-level list — and it answers *"a video goes where, by default?"*.
 *    It is read by plan derivation, to PREFILL the wizard's platform step
 *    before the operator has said anything.
 *
 * A tenant can hold both without contradiction: family routing seeds the
 * defaults, bucket routing decides the individual run. Keys here are
 * validated against `CREATE_FAMILIES` at the write door — an unroutable
 * family name is a typo, not data.
 *
 * Destination VALUES stay free-form strings, deliberately: the engine is
 * generic, and a tenant's destinations include things that are not social
 * platform keys (their own site, a mailing list, a video host we have not
 * built a driver for yet). Plan derivation is where an unreachable
 * destination earns its `unknown_platform` refusal — storage does not
 * pre-judge it.
 *
 * ⚠ `partialRecord`, NOT `record`, and the difference is not cosmetic:
 * zod 4's `z.record()` over an enum key is EXHAUSTIVE — it would demand
 * every family be routed at once, so a tenant who routes only `video` would
 * fail to parse. `socialPublishConfigSchema` documents this same trap and
 * dodges it with explicit optional fields; here the key space is closed and
 * small, so `partialRecord` says it directly. (Caught by this window's own
 * test rather than by reading: the first cut used `record` and every
 * partial map was refused.)
 */
export const platformRoutingSchema = z.partialRecord(
  createFamilySchema,
  z.array(z.string().min(1)),
);
export type PlatformRouting = z.infer<typeof platformRoutingSchema>;

/**
 * The generic demo tenant's defaults, shaped after the Kompozy teardown's
 * routing table. Two honest omissions rather than an aspirational table:
 *
 *  - `page` and `email` carry exactly ONE destination each (the tenant's own
 *    site; their list), so "routing" them is a choice with one option —
 *    absence is more truthful than a one-element array pretending to decide.
 *  - Kompozy routes video to YouTube first. We still don't: the `youtube`
 *    platform key EXISTS (s90 lane — capability rows, settings schema,
 *    disarmed driver) but the video PUBLISH path does not (the publish
 *    door's media envelope is image-only, so every youtube draft fails fit
 *    with `video_required`). Prefilling it would seed every video run with
 *    a destination that refuses — a default that generates its own error
 *    message is worse than no default. Add it here when the video-arc
 *    publish wiring lands.
 */
export const DEFAULT_PLATFORM_ROUTING: PlatformRouting = {
  post: ["linkedin", "facebook", "x", "bluesky"],
  video: ["tiktok", "instagram", "facebook"],
};
