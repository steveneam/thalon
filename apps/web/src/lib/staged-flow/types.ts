import {
  STAGED_DRAFT_FORMATS,
  type DirectionAspect,
  type DirectionDoc,
  type DirectionMotion,
  type DirectionPacing,
  type StageDef,
  type StagePlan,
  type StoryboardScene,
} from "@thalon/contracts";
import { z } from "zod";
import type { CapturedEditKind, Rfc6902Op } from "./patch";
import type { GridDraft, PanelJudgeResult } from "@/lib/approve-queue/types";

/**
 * Wire types for the B5.4 staged-flow surface. Everything here is shaped by
 * the FROZEN Sprint-5 contract (@thalon/contracts stage-registry /
 * direction-doc / format-registry) — the flow state is a projection of stage
 * drafts whose meta parses against the pinned schemas, served by the
 * fake-driver seam in ./store.ts until pass 3 wires the real staged pipeline
 * (packages/engine startVideoStages/advanceVideoStage) behind the same
 * endpoints.
 */

/**
 * One telemetry row per operator interaction — the edit_diff payload. The
 * `patch` is RFC-6902, stored VERBATIM (the same convention the Hyperframes
 * SDK's commit patches will arrive in), expressed against the stage draft's
 * creative document: the `{title, scenes, cta}` subset of a storyboard meta,
 * or the full DirectionDoc of a direction_doc meta. In pass 3 these rows land
 * through the existing capture path (approvals.record → edit_diffs +
 * eval_cases, one transaction) — advanced-mode telemetry is what trains
 * one-prompt mode's defaults, so an "accept" (empty patch) is as much signal
 * as a tweak.
 */
export interface CapturedEdit {
  id: string;
  /** The stage draft the interaction applied to. */
  draftId: string;
  stageKey: string;
  kind: CapturedEditKind;
  /** RFC-6902 ops, verbatim — [] for accept (an explicit no-change signal). */
  patch: Rfc6902Op[];
  /** Human-readable provenance: candidate id for picks, preset key for presets, beat index for chips. */
  note: string | null;
  capturedAt: string;
}

/**
 * A style preset the active profile offers (per-tenant runtime DATA under
 * `platformProfiles.<platform>.stylePresets` — the same free-form config
 * surface the engine's deterministic prefill reads aspect/fps/pacing/motion
 * from; presets are named bundles of those keys, never code).
 */
export const stylePresetSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  aspect: z.enum(["16:9", "9:16", "1:1"]).optional(),
  fps: z.number().int().min(1).max(120).optional(),
  pacing: z.enum(["fast", "medium", "slow"]).optional(),
  motion: z.enum(["smooth", "snappy", "bouncy", "dramatic"]).optional(),
});
export type StylePreset = z.infer<typeof stylePresetSchema> & {
  aspect?: DirectionAspect;
  fps?: number;
  pacing?: DirectionPacing;
  motion?: DirectionMotion;
};

/** The creative document of a structure-stage (storyboard) draft — the patch target for storyboard interactions. */
export interface StoryboardContent {
  title: string;
  scenes: StoryboardScene[];
  cta: string | null;
}

/**
 * One generation candidate for a stage — the operator picks from 2–3 of
 * these per stage instead of facing a blank prompt box. Exactly one of
 * `storyboard`/`doc` is set, matching the stage's `produces` format.
 */
export interface StageCandidate {
  id: string;
  label: string;
  /** One line the operator reads on the card — what makes this take different. */
  summary: string;
  storyboard?: StoryboardContent;
  doc?: DirectionDoc;
}

export type FlowStageStatus = "done" | "current" | "locked";

/** One stage of the plan, projected for the UI: its registry definition plus whatever artifact/candidates exist so far. */
export interface FlowStage {
  def: StageDef;
  status: FlowStageStatus;
  /** The stage's judged draft — null until a candidate is picked (or the stage generates). */
  draft: GridDraft | null;
  judgeResults: PanelJudgeResult[];
  /** Present while the stage awaits a pick; null once resolved (or not yet reached). */
  candidates: StageCandidate[] | null;
}

/** The whole staged flow, anchored at any of its stage drafts. */
export interface StagedFlowState {
  /**
   * Which half of the seam served this state: "demo" = the B5.4 in-memory
   * fixture store (interactive, fake drivers, no spend); "live" = the s67
   * read-only projection of a REAL one-prompt chain from the drafts table
   * (./live.ts) — the surface hides pick/edit/advance affordances, which
   * for live chains are the unbuilt write half of pass 3.
   */
  source: "demo" | "live";
  family: string;
  plan: StagePlan;
  stages: FlowStage[];
  currentIndex: number;
  /** Style presets from the ACTIVE profile's platform config (runtime data). */
  presets: StylePreset[];
  /** Every captured interaction so far, oldest first (the edit_diff telemetry). */
  captures: CapturedEdit[];
}

/** Runtime validation for patches arriving over the wire (the seam parses, the store applies). */
export const rfc6902OpSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add"), path: z.string(), value: z.unknown() }),
  z.object({ op: z.literal("remove"), path: z.string() }),
  z.object({ op: z.literal("replace"), path: z.string(), value: z.unknown() }),
  z.object({ op: z.literal("move"), from: z.string(), path: z.string() }),
  z.object({ op: z.literal("copy"), from: z.string(), path: z.string() }),
  z.object({ op: z.literal("test"), path: z.string(), value: z.unknown() }),
]);

/** The kinds an edit endpoint accepts — "pick" is excluded (it has its own endpoint and capture semantics). */
export const stagedEditKindSchema = z.enum(["tweak", "reorder", "accept", "preset", "raw_md"]);
export type StagedEditKind = z.infer<typeof stagedEditKindSchema>;

/** POST /api/staged/:draftId/edit request body. */
export const stagedEditRequestSchema = z.object({
  kind: stagedEditKindSchema,
  patch: z.array(rfc6902OpSchema),
  note: z.string().optional(),
});
export interface StagedEditRequest {
  kind: StagedEditKind;
  patch: Rfc6902Op[];
  note?: string;
}

/** POST /api/staged/:draftId/pick request body. */
export const stagedPickRequestSchema = z.object({ candidateId: z.string().min(1) });
export interface StagedPickRequest {
  candidateId: string;
}

/** True when a draft's format is a stage artifact — the approve queue swaps in the staged-flow surface for these. */
export function isStagedDraftFormat(format: string | null | undefined): boolean {
  return format != null && (STAGED_DRAFT_FORMATS as readonly string[]).includes(format);
}
