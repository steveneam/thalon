import {
  DRAFT_FORMAT_REGISTRY,
  DIRECTION_DOC_VERSION,
  directionDocDraftMetaSchema,
  directionDocSchema,
  storyboardDraftMetaSchema,
  type DirectionDoc,
  type StageDef,
  type StoryboardDraftMeta,
} from "@thalon/contracts";
import type { DraftDetail, FeedRun, GridDraft, PanelJudgeResult } from "@/lib/approve-queue/types";
import {
  FIXTURE_POLISH_THEMES,
  FIXTURE_SCENES_THEMES,
  FIXTURE_STAGE_PLAN,
  FIXTURE_STAGED_BASE_MS,
  FIXTURE_STAGED_PLATFORM,
  FIXTURE_STAGED_PLATFORM_PROFILE_VERSION,
  FIXTURE_STAGED_RUN_ID,
  FIXTURE_STAGED_TENANT_ID,
  FIXTURE_STORYBOARD_DRAFT_ID,
  fixtureStoryboardMeta,
  fixtureStylePresets,
  type PolishCandidateTheme,
  type ScenesCandidateTheme,
} from "./fixtures";
import { applyPatch, type Rfc6902Op } from "./patch";
import type {
  CapturedEdit,
  FlowStage,
  StageCandidate,
  StagedEditRequest,
  StagedFlowState,
  StoryboardContent,
} from "./types";

/**
 * The staged-flow FAKE DRIVER (B5.4, amendment A11): an in-memory,
 * deterministic stand-in for the B5.2 staged pipeline so the advanced-mode
 * experience is felt end-to-end with zero engine dependency and zero live
 * spend (the architecture pin: apps/web stays engine-free; stage
 * generation/advance flows are mocked against contract-shaped fixtures).
 *
 * What it keeps honest, on purpose:
 *  - every stage draft's meta parses against the FROZEN pinned schemas, and
 *    its body is derived through DRAFT_FORMAT_REGISTRY.expectedBody (the I1
 *    body_hash convention) - never hand-written;
 *  - the structural advance gate is enforced with the engine's own rule
 *    (a stage advances only from a queued/approved draft) and error wording;
 *  - every operator interaction records a CapturedEdit whose RFC-6902 patch
 *    is stored VERBATIM - the exact payload pass 3 hands the existing
 *    capture path (approvals.record, edit_diffs + eval_cases).
 *
 * What it fakes, on purpose:
 *  - the judge always passes (instant queued + pass verdicts) - blocked-path
 *    UX already exists in the classic queue and stays out of B5.4 scope;
 *  - one fixture chain, one run row for the whole chain (the real engine
 *    creates a run per stage), fake body hashes (only property needed:
 *    change when the body changes);
 *  - candidate generation is deterministic fixture data (scenes themes /
 *    polish refinements) built over the operator's CURRENT artifact, the
 *    way prefill + a creative fill would be.
 *
 * Pass 3 replaces this module behind the same /api/staged endpoints with
 * startVideoStages/advanceVideoStage + the real judge lane.
 */

interface StageSlot {
  def: StageDef;
  draft: GridDraft | null;
  judgeResults: PanelJudgeResult[];
  candidates: StageCandidate[] | null;
}

interface StoreState {
  run: FeedRun;
  slots: StageSlot[];
  captures: CapturedEdit[];
  /** Deterministic clock/id counter - the fake seam never reads Date.now(). */
  tick: number;
}

/** Loud, typed store failure - the seam maps it to a 4xx with the message intact (see ./http.ts). */
export class StagedFlowError extends Error {
  constructor(
    message: string,
    /** 404 for unknown ids, 409 for gate violations, 400 for bad payloads. */
    public readonly httpStatus: 400 | 404 | 409 = 400,
  ) {
    super(message);
    this.name = "StagedFlowError";
  }
}

/** Fake-driver hash: its only required property is changing when the body changes (judge badges match on it). */
function fakeBodyHash(body: string): string {
  let h = 5381;
  for (let i = 0; i < body.length; i++) h = ((h * 33) ^ body.charCodeAt(i)) >>> 0;
  return `fake-${h.toString(16).padStart(8, "0")}`;
}

/** The prefill normalization rule (storyboard free text to strict single direction line). */
function collapseLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Fake-driver fallback for operator-added scenes without a duration hint (the engine derives this from reading speed). */
const FALLBACK_SCENE_DURATION_MS = 4000;

function nextTick(): string {
  state.tick += 1;
  return new Date(FIXTURE_STAGED_BASE_MS + state.tick * 1000).toISOString();
}

function passVerdicts(draftId: string, bodyHash: string, at: string): PanelJudgeResult[] {
  return ["g1", "g3_screen", "g3_final"].map((gate) => ({
    id: `staged-${draftId}-${gate}-${bodyHash}`,
    tenantId: FIXTURE_STAGED_TENANT_ID,
    draftId,
    gate,
    verdict: "pass",
    bodyHash,
    evidence: { claims: [] },
    model: "fake/staged-judge",
    promptVersion: "judge.v1",
    latencyMs: 1,
    createdAt: at,
  }));
}

function storyboardContent(meta: StoryboardDraftMeta): StoryboardContent {
  return { title: meta.title, scenes: meta.scenes, cta: meta.cta };
}

/** What the deterministic prefill pins for every candidate (aspect/fps/pacing come from the active profile's platform config - see fixtures). */
const PREFILL = { aspect: "16:9", fps: 30, pacing: "medium" } as const;

function buildScenesCandidates(storyboard: StoryboardContent): StageCandidate[] {
  return FIXTURE_SCENES_THEMES.map((theme: ScenesCandidateTheme) => ({
    id: theme.id,
    label: theme.label,
    summary: theme.summary,
    doc: directionDocSchema.parse({
      docVersion: DIRECTION_DOC_VERSION,
      title: collapseLine(storyboard.title),
      aspect: PREFILL.aspect,
      fps: PREFILL.fps,
      pacing: PREFILL.pacing,
      scenes: storyboard.scenes.map((scene, i) => ({
        sceneIndex: i,
        heading: collapseLine(scene.heading),
        narration: collapseLine(scene.narration),
        onScreenText: scene.onScreenText ? collapseLine(scene.onScreenText) : null,
        visual: theme.visuals[Math.min(i, theme.visuals.length - 1)],
        motion: theme.motion,
        durationMs: scene.durationHintMs ?? FALLBACK_SCENE_DURATION_MS,
      })),
      cta: storyboard.cta ? collapseLine(storyboard.cta) : null,
    }),
  }));
}

function buildPolishCandidates(doc: DirectionDoc): StageCandidate[] {
  return FIXTURE_POLISH_THEMES.map((theme: PolishCandidateTheme) => ({
    id: theme.id,
    label: theme.label,
    summary: theme.summary,
    doc: directionDocSchema.parse({
      ...doc,
      title: theme.title ?? doc.title,
      cta: theme.cta ?? doc.cta,
      scenes: doc.scenes.map((scene) => ({
        ...scene,
        onScreenText: theme.onScreenText?.[scene.sceneIndex] ?? scene.onScreenText,
        narration: theme.narration?.[scene.sceneIndex] ?? scene.narration,
      })),
    }),
  }));
}

function seed(): StoreState {
  const createdAt = new Date(FIXTURE_STAGED_BASE_MS).toISOString();
  const body = DRAFT_FORMAT_REGISTRY.storyboard.expectedBody(fixtureStoryboardMeta);
  const bodyHash = fakeBodyHash(body);
  const storyboardDraft: GridDraft = {
    id: FIXTURE_STORYBOARD_DRAFT_ID,
    tenantId: FIXTURE_STAGED_TENANT_ID,
    fanoutRunId: FIXTURE_STAGED_RUN_ID,
    sourceId: fixtureStoryboardMeta.groundingSourceIds[0],
    platform: FIXTURE_STAGED_PLATFORM,
    format: "storyboard",
    body,
    bodyHash,
    meta: fixtureStoryboardMeta,
    status: "queued",
    generationKey: "gen-staged-structure",
    createdAt,
    updatedAt: createdAt,
  };
  const slots: StageSlot[] = FIXTURE_STAGE_PLAN.stages.map((def, i) => ({
    def,
    draft: i === 0 ? storyboardDraft : null,
    judgeResults: i === 0 ? passVerdicts(storyboardDraft.id, bodyHash, createdAt) : [],
    // The operator lands mid-flow: structure is judged, scenes/effects is
    // already offering its takes - visible artifacts, never a blank box.
    candidates: i === 1 ? buildScenesCandidates(storyboardContent(fixtureStoryboardMeta)) : null,
  }));
  return {
    run: {
      id: FIXTURE_STAGED_RUN_ID,
      tenantId: FIXTURE_STAGED_TENANT_ID,
      sourceId: fixtureStoryboardMeta.groundingSourceIds[0],
      brandProfileId: "profile-staged-fixture",
      brandProfileVersion: 1,
      platforms: [FIXTURE_STAGED_PLATFORM],
      promptVersion: FIXTURE_STAGE_PLAN.stages[0].promptSlug,
      model: "fake/staged",
      params: { family: FIXTURE_STAGE_PLAN.family, stageKey: FIXTURE_STAGE_PLAN.stages[0].key },
      generationKey: "gen-staged-run",
      status: "complete",
      lastError: null,
      createdAt,
      draftsComplete: true,
    },
    slots,
    captures: [],
    tick: 0,
  };
}

// Initialized here (not next to the type declarations) so seed() runs after
// every module-level const it reads is past its temporal dead zone.
let state: StoreState = seed();

/** Test isolation: re-seed the chain (wired into the global test setup's afterEach). */
export function resetStagedFlowStore(): void {
  state = seed();
}

export function getStagedRunForFeed(): FeedRun {
  return state.run;
}

/** Grid drafts for the staged run - null when the id isn't the staged fixture run (callers fall through to their real source). */
export function listStagedRunDrafts(runId: string): GridDraft[] | null {
  if (runId !== state.run.id) return null;
  return state.slots.flatMap((slot) => (slot.draft ? [slot.draft] : []));
}

export function getStagedDraftDetail(draftId: string): DraftDetail | null {
  const slot = state.slots.find((s) => s.draft?.id === draftId);
  return slot?.draft ? { draft: slot.draft, judgeResults: slot.judgeResults } : null;
}

export function isStagedDraftId(draftId: string): boolean {
  return state.slots.some((slot) => slot.draft?.id === draftId);
}

function currentIndex(): number {
  let index = 0;
  state.slots.forEach((slot, i) => {
    if (slot.draft || slot.candidates) index = i;
  });
  return index;
}

/** The flow, anchored at ANY of its stage drafts; null when the id belongs to no staged chain. */
export function getStagedFlow(draftId: string): StagedFlowState | null {
  if (!isStagedDraftId(draftId)) return null;
  const current = currentIndex();
  const stages: FlowStage[] = state.slots.map((slot, i) => ({
    def: slot.def,
    status: i < current ? "done" : i === current ? "current" : "locked",
    draft: slot.draft,
    judgeResults: slot.judgeResults,
    candidates: slot.candidates,
  }));
  return {
    family: FIXTURE_STAGE_PLAN.family,
    plan: FIXTURE_STAGE_PLAN,
    stages,
    currentIndex: current,
    presets: fixtureStylePresets,
    captures: state.captures,
  };
}

function recordCapture(
  draftId: string,
  stageKey: string,
  kind: CapturedEdit["kind"],
  patch: Rfc6902Op[],
  note: string | null,
  at: string,
): void {
  state.captures.push({
    id: `staged-edit-${state.captures.length + 1}`,
    draftId,
    stageKey,
    kind,
    // Verbatim - this array IS the edit_diff payload (JSON.parse(JSON.stringify)
    // guards the store against callers mutating the ops after the fact).
    patch: JSON.parse(JSON.stringify(patch)) as Rfc6902Op[],
    note,
    capturedAt: at,
  });
}

/** Fake judge: instant pass - refreshes verdicts against the new body hash and lands the draft on queued. */
function fakeJudge(slot: StageSlot, at: string): void {
  if (!slot.draft) return;
  slot.draft = { ...slot.draft, status: "queued" };
  slot.judgeResults = passVerdicts(slot.draft.id, slot.draft.bodyHash, at);
}

/**
 * Operator picks one of a stage's candidates: the stage draft comes to exist
 * (status honest to the real pipeline: generated, fake-judged, queued) and
 * the pick is captured as a whole-document add patch.
 */
export function pickStagedCandidate(anchorDraftId: string, candidateId: string): StagedFlowState {
  if (!isStagedDraftId(anchorDraftId)) {
    throw new StagedFlowError(`draft "${anchorDraftId}" belongs to no staged flow`, 404);
  }
  const slotIndex = state.slots.findIndex((s) => s.candidates?.some((c) => c.id === candidateId));
  if (slotIndex === -1) {
    throw new StagedFlowError(`candidate "${candidateId}" is not on offer for any stage`, 404);
  }
  const slot = state.slots[slotIndex];
  const candidate = slot.candidates!.find((c) => c.id === candidateId)!;
  const prior = slotIndex > 0 ? state.slots[slotIndex - 1].draft : null;
  const at = nextTick();

  let meta: Record<string, unknown>;
  let body: string;
  if (slot.def.produces === "direction_doc") {
    if (!candidate.doc) throw new StagedFlowError(`candidate "${candidateId}" carries no direction doc`);
    if (!prior) throw new StagedFlowError(`stage "${slot.def.key}" has no prior stage draft to advance from`, 409);
    const parsed = directionDocDraftMetaSchema.parse({
      doc: candidate.doc,
      family: FIXTURE_STAGE_PLAN.family,
      stageKey: slot.def.key,
      stageIndex: slotIndex,
      priorDraftId: prior.id,
      groundingSourceIds: fixtureStoryboardMeta.groundingSourceIds,
      promptVersion: slot.def.promptSlug,
      brandProfileVersion: 1,
      platformProfileVersion: FIXTURE_STAGED_PLATFORM_PROFILE_VERSION,
    });
    meta = parsed as unknown as Record<string, unknown>;
    body = DRAFT_FORMAT_REGISTRY.direction_doc.expectedBody(parsed);
  } else {
    if (!candidate.storyboard) throw new StagedFlowError(`candidate "${candidateId}" carries no storyboard`);
    const parsed = storyboardDraftMetaSchema.parse({
      ...candidate.storyboard,
      family: FIXTURE_STAGE_PLAN.family,
      stageKey: slot.def.key,
      stageIndex: slotIndex,
      groundingSourceIds: fixtureStoryboardMeta.groundingSourceIds,
      promptVersion: slot.def.promptSlug,
      brandProfileVersion: 1,
      platformProfileVersion: FIXTURE_STAGED_PLATFORM_PROFILE_VERSION,
    });
    meta = parsed as unknown as Record<string, unknown>;
    body = DRAFT_FORMAT_REGISTRY.storyboard.expectedBody(parsed);
  }

  const bodyHash = fakeBodyHash(body);
  slot.draft = {
    id: `staged-draft-${slot.def.key}-${state.tick}`,
    tenantId: FIXTURE_STAGED_TENANT_ID,
    fanoutRunId: state.run.id,
    sourceId: state.run.sourceId,
    platform: FIXTURE_STAGED_PLATFORM,
    format: slot.def.produces,
    body,
    bodyHash,
    meta,
    status: "generated",
    generationKey: `gen-staged-${slot.def.key}-${state.tick}`,
    createdAt: at,
    updatedAt: at,
  };
  slot.candidates = null;
  fakeJudge(slot, at);
  recordCapture(
    slot.draft.id,
    slot.def.key,
    "pick",
    [{ op: "add", path: "", value: candidate.doc ?? candidate.storyboard }],
    `${candidate.id} - ${candidate.label}`,
    at,
  );
  return getStagedFlow(anchorDraftId)!;
}

/**
 * One operator interaction on a stage draft's creative document. The patch
 * applies to the storyboard's {title, scenes, cta} or the direction doc,
 * the result must still parse against the FROZEN meta schema (loud
 * otherwise - a patch can never wedge an invalid document into the store),
 * the body re-derives through the registry, the fake judge re-passes, and
 * the patch is captured verbatim. `accept` is capture-only by definition
 * (an explicit "reviewed, unchanged" signal - patch must be empty).
 */
export function applyStagedEdit(draftId: string, request: StagedEditRequest): StagedFlowState {
  const slot = state.slots.find((s) => s.draft?.id === draftId);
  if (!slot?.draft) throw new StagedFlowError(`draft "${draftId}" belongs to no staged flow`, 404);
  const draft = slot.draft;
  const at = nextTick();

  if (request.kind === "accept") {
    if (request.patch.length > 0) {
      throw new StagedFlowError('an "accept" is a no-change signal - its patch must be empty');
    }
    recordCapture(draftId, slot.def.key, "accept", [], request.note ?? null, at);
    return getStagedFlow(draftId)!;
  }
  if (request.patch.length === 0) {
    throw new StagedFlowError(`a "${request.kind}" edit carries at least one patch op`);
  }

  let meta: Record<string, unknown>;
  let body: string;
  if (draft.format === "storyboard") {
    const current = storyboardDraftMetaSchema.parse(draft.meta);
    const patched = applyPatch(storyboardContent(current), request.patch) as StoryboardContent;
    // Explicit field-by-field rebuild: a patch that removed a required field
    // must fail the schema parse, not be resurrected by a spread of `current`.
    const parsed = storyboardDraftMetaSchema.parse({
      ...current,
      title: patched.title,
      scenes: patched.scenes,
      cta: patched.cta,
    });
    meta = parsed as unknown as Record<string, unknown>;
    body = DRAFT_FORMAT_REGISTRY.storyboard.expectedBody(parsed);
  } else {
    const current = directionDocDraftMetaSchema.parse(draft.meta);
    const patched = applyPatch(current.doc, request.patch);
    const parsed = directionDocDraftMetaSchema.parse({ ...current, doc: patched });
    meta = parsed as unknown as Record<string, unknown>;
    body = DRAFT_FORMAT_REGISTRY.direction_doc.expectedBody(parsed);
  }

  slot.draft = { ...draft, meta, body, bodyHash: fakeBodyHash(body), updatedAt: at };
  fakeJudge(slot, at);
  recordCapture(draftId, slot.def.key, request.kind, request.patch, request.note ?? null, at);
  return getStagedFlow(draftId)!;
}

/** Statuses a stage draft may hold for the next stage to generate - the engine's ADVANCE_READY, mirrored verbatim. */
const ADVANCE_READY: readonly string[] = ["queued", "approved"];

/**
 * Generate the next stage's candidates. THE STRUCTURAL GATE (engine rule,
 * engine wording): a stage advances only after its draft passes the judge.
 */
export function advanceStagedFlow(anchorDraftId: string): StagedFlowState {
  if (!isStagedDraftId(anchorDraftId)) {
    throw new StagedFlowError(`draft "${anchorDraftId}" belongs to no staged flow`, 404);
  }
  const index = currentIndex();
  const slot = state.slots[index];
  if (!slot.draft) {
    throw new StagedFlowError(`stage "${slot.def.key}" has no draft yet - pick a candidate first`, 409);
  }
  if (!ADVANCE_READY.includes(slot.draft.status)) {
    throw new StagedFlowError(
      `stage "${slot.def.key}" draft "${slot.draft.id}" is status "${slot.draft.status}" - a stage advances only after its draft passes the judge (queued/approved)`,
      409,
    );
  }
  const next = state.slots[index + 1];
  if (!next) {
    throw new StagedFlowError(
      `draft "${slot.draft.id}" is the final stage ("${slot.def.key}") - there is nothing to advance to; export is deterministic core, never a stage`,
      409,
    );
  }
  if (slot.draft.format === "storyboard") {
    next.candidates = buildScenesCandidates(
      storyboardContent(storyboardDraftMetaSchema.parse(slot.draft.meta)),
    );
  } else {
    next.candidates = buildPolishCandidates(directionDocDraftMetaSchema.parse(slot.draft.meta).doc);
  }
  return getStagedFlow(anchorDraftId)!;
}
