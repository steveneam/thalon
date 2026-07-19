import {
  brandIdentitySchema,
  directionDocDraftMetaSchema,
  edlSchema,
  type Edl,
  type TenantCtx,
} from "@thalon/contracts";
import {
  InvalidStateError,
  stableStringify,
  type Draft,
  type Repos,
  type VideoCutRow,
  type VideoProjectRow,
  type VideoTakeRow,
} from "@thalon/db";
import {
  deriveDirectionExport,
  renderDirectionSrt,
  type DirectionExport,
} from "../direction/export";
import { compileEdl } from "../edl/compile";
import { ingestSource, type IngestDeps } from "../ingest/ingest";
import {
  assertSpecRenderable,
  compositionSpecFromDirectionExport,
} from "../render/composition";
import {
  runVideoStagesOnePrompt,
  type OnePromptJudgeDeps,
  type StagedVideoDeps,
  type StagedVideoStageOutcome,
} from "./staged-video";

/**
 * B-vid.7 (Sprint 8 "Arm It Live" §③): the ONE-PROMPT AUTO-RUN — the film's
 * hand-driven production path made part of the engine. One operator prompt
 * (+ optional source URL) in; the EXISTING seams do everything else, in the
 * manual path's order:
 *
 *   ingest (one prompt source) → staged drafts (storyboard → direction doc,
 *   judged between stages — `runVideoStagesOnePrompt`, ONE CODE PATH with
 *   advanced mode) → video project → takes plan (one planned take per
 *   timeline cue, the per-beat mint brief on record) → EDL → cut v1 (draft).
 *
 * The judged direction_doc draft lands `queued` in the approve queue like
 * any other judged content; the project tree records through the frozen
 * B-ve.1 repos only, so every transition leaves the same events/rows the
 * manual path leaves and the Runs/Videos surfaces stay honest.
 *
 * RENDER/MINT SPEND IS STRUCTURALLY IMPOSSIBLE HERE (bucket invariant):
 * this module's only render-seam contact is PURE — the direction export is
 * mapped through `compositionSpecFromDirectionExport` and gated by
 * `assertSpecRenderable` (the render seam's own lint, zero spend), and the
 * EDL is compile-gated by `compileEdl` (pure lowering, the manual save
 * door's gate). No `RenderTarget` is ever invoked, `executePlan` is never
 * imported, and no vendor client exists on this path; the cut lands status
 * "draft" with takes PLANNED (provenance stays `{}` until a real mint pins
 * it), so any later render rides the existing armed doors unchanged
 * (approve gate + the videos render route's media-root requirement).
 *
 * Failure honesty: a blocked stage halts with the blocked draft in triage
 * and NOTHING project-side persisted; an irrecoverable generation throws
 * with the run row marked failed (single-draft spine); a doc that fails the
 * direction contract or the render lint throws BEFORE the project exists.
 * Nothing downstream of a failure point is ever half-persisted.
 */

/** The auto-run's cut name — versions bump under it (a re-edit is a new version, never a mutation). */
export const ONE_PROMPT_CUT_NAME = "one-prompt";

/** The beat-lane crossfade the planned cut chains with (the film recipe; the compiler refuses hard cuts). Clamped so a short beat is never swallowed by its own fade. */
export const ONE_PROMPT_XFADE_S = 0.5;

export interface OnePromptVideoInput {
  /** The operator brief — the flow's only required input. */
  prompt: string;
  /** Optional grounding URL: rides into the ingested brief (and its meta) so the judge grounds against it. */
  sourceUrl?: string;
}

export interface OnePromptVideoDeps {
  ctx: TenantCtx;
  repos: Repos;
  /** Judge drivers for the between-stage gates (scripted fakes in tests; the gateway driver in production callers). */
  judge: OnePromptJudgeDeps;
  /** Stage-generation drivers (fakes in tests; omitted = the staged pipeline's gateway defaults). */
  staged?: StagedVideoDeps;
  ingest?: IngestDeps;
}

/** One planned beat: the take row plus the cue it stages — the mint brief a later (armed) mint seat executes. */
export interface OnePromptTakePlan {
  take: VideoTakeRow;
  slot: string;
}

export type OnePromptVideoResult =
  | {
      /** A stage's judge gate said no — the blocked draft is in the triage queue; nothing project-side persisted. */
      status: "blocked";
      promptSourceId: string;
      stages: StagedVideoStageOutcome[];
      draft: Draft;
      blockedStageKey: string;
    }
  | {
      status: "queued";
      promptSourceId: string;
      stages: StagedVideoStageOutcome[];
      /** The final judged direction_doc draft — queued in the approve queue. */
      draft: Draft;
      project: VideoProjectRow;
      takes: OnePromptTakePlan[];
      /** The planned cut (status "draft", never rendered here). */
      cut: VideoCutRow;
      /** The deterministic SRT for the doc's timeline — derivable any time; returned, never stored. */
      srt: string;
    };

/** beat-01, beat-02, … — the reference tree's slot grammar (B-ve.2 import classifier). */
function beatSlot(index: number): string {
  return `beat-${String(index + 1).padStart(2, "0")}`;
}

/** Where the reference tree puts a slot's keeper — the planned mint's landing ref. */
function beatRef(index: number): string {
  return `keepers/${beatSlot(index)}.mp4`;
}

/**
 * The planned EDL: one clip per timeline cue over the planned take refs,
 * chained with the beat-lane crossfade (the compiler's rule — hard cuts
 * arrive additively). Offsets derive from durations; the output duration is
 * the ASSEMBLED lane (sum of durations minus fade overlaps), the compiler's
 * own math.
 */
function planEdl(exported: DirectionExport): Edl {
  const durations = exported.timeline.cues.map((cue) => (cue.endMs - cue.startMs) / 1000);
  const fadeInto = (i: number): number =>
    Math.min(ONE_PROMPT_XFADE_S, durations[i - 1] / 2, durations[i] / 2);
  const laneDuration = durations.reduce(
    (acc, duration, i) => acc + duration - (i > 0 ? fadeInto(i) : 0),
    0,
  );
  return edlSchema.parse({
    name: ONE_PROMPT_CUT_NAME,
    output: {
      width: exported.width,
      height: exported.height,
      fps: exported.fps,
      duration: laneDuration,
    },
    video: exported.timeline.cues.map((cue, i) => ({
      name: beatSlot(i),
      source: { kind: "take", ref: beatRef(i) },
      duration: durations[i],
      ...(i > 0 ? { transitionIn: { type: "xfade", duration: fadeInto(i) } } : {}),
    })),
  });
}

export async function runOnePromptVideo(
  deps: OnePromptVideoDeps,
  input: OnePromptVideoInput,
  now: Date,
): Promise<OnePromptVideoResult> {
  const { ctx, repos } = deps;
  const prompt = input.prompt.trim();
  if (!prompt) {
    throw new InvalidStateError(
      "one-prompt video needs a non-empty prompt — the brief is the flow's only operator input",
    );
  }
  const sourceUrl = input.sourceUrl?.trim() || undefined;

  // 1) The brief becomes THE prompt source (one ingest door, outreach-brief
  // pattern): what the operator wrote is exactly what grounds every stage.
  const brief = sourceUrl ? `${prompt}\n\nSource: ${sourceUrl}` : prompt;
  const { sourceId: promptSourceId } = await ingestSource(
    ctx,
    repos,
    {
      kind: "prompt",
      prompt: brief,
      meta: { origin: "one_prompt_video", ...(sourceUrl ? { sourceUrl } : {}) },
    },
    deps.ingest,
  );

  // 2) The staged draft pipeline, auto-advanced — judged between stages by
  // the same structural gate advanced mode hits. A blocked stage HALTS the
  // flow here: the blocked draft is the operator's triage queue item, and
  // nothing project-side exists yet.
  const staged = await runVideoStagesOnePrompt(
    ctx,
    repos,
    { promptSourceId },
    deps.judge,
    deps.staged,
  );
  if (staged.status === "blocked") {
    return {
      status: "blocked",
      promptSourceId,
      stages: staged.stages,
      draft: staged.draft,
      blockedStageKey: staged.stages[staged.stages.length - 1].stageKey,
    };
  }

  // 3) The judged doc must satisfy the direction contract — fail loud
  // (nothing downstream persists) rather than stage a project over a doc
  // the export/render path would refuse.
  const finalMeta = directionDocDraftMetaSchema.parse(staged.draft.meta);
  const exported = deriveDirectionExport(finalMeta.doc);
  const srt = renderDirectionSrt(exported.timeline);

  // 4) Render-seam gate, PURE (zero spend): the composition spec this doc
  // will render through must be renderable NOW. Actual rendering stays
  // behind the existing armed doors — no RenderTarget is invoked here.
  const profile = await repos.brandProfiles.getActive(ctx);
  if (!profile) {
    throw new Error(`tenant ${ctx.tenantId} has no active brand profile — create one first`);
  }
  assertSpecRenderable(
    compositionSpecFromDirectionExport(
      exported,
      brandIdentitySchema.parse(profile.identity ?? {}),
    ),
  );

  // 5) The project — the manual path's tree root, same repo door, same event.
  const { project, created: projectCreated } = await repos.videoProjects.create(ctx, {
    name: finalMeta.doc.title,
    description: `One-prompt auto-run — direction draft ${staged.draft.id}`,
    meta: {
      onePrompt: {
        directionDraftId: staged.draft.id,
        promptSourceId,
        aspect: finalMeta.doc.aspect,
        fps: finalMeta.doc.fps,
        startedAt: now.toISOString(),
      },
    },
  });
  if (!projectCreated) {
    const stamped = (
      project.meta as { onePrompt?: { directionDraftId?: unknown } } | null
    )?.onePrompt?.directionDraftId;
    if (stamped !== staged.draft.id) {
      throw new InvalidStateError(
        `video project "${finalMeta.doc.title}" already exists from a different origin` +
          ` (direction draft ${typeof stamped === "string" ? stamped : "unknown"}) —` +
          ` the (tenant, name) key is first-origin-wins; retitle the doc or continue in that project by hand`,
      );
    }
  }

  // 6) The takes plan: one PLANNED take per timeline cue (scenes, then the
  // CTA endcard beat), slotted in the reference tree's beat grammar. The
  // cue's creative direction rides the take meta — the per-beat mint brief —
  // while provenance stays `{}`: it is pinned at mint (B7.1), and no mint
  // happens on this path. Idempotent on (project, ref): a replay re-records
  // nothing.
  const takes: OnePromptTakePlan[] = [];
  for (const [i, cue] of exported.timeline.cues.entries()) {
    const { take } = await repos.videoTakes.record(ctx, project.id, {
      slot: beatSlot(i),
      kind: "motion",
      ref: beatRef(i),
      meta: {
        onePrompt: {
          planned: true,
          cueKind: cue.kind,
          sceneIndex: cue.sceneIndex,
          heading: cue.heading,
          narration: cue.text,
          onScreenText: cue.onScreenText,
          visual: cue.visual,
          motion: cue.motion,
          durationMs: cue.endMs - cue.startMs,
        },
      },
    });
    takes.push({ take, slot: beatSlot(i) });
  }

  // 7) EDL → cut, compile-gated exactly like the manual save door (garbage
  // never stores). Replay returns the identical existing version; a doc
  // change under the same title lands as the NEXT version (an EDL is
  // immutable per version).
  const edl = planEdl(exported);
  compileEdl(edl);
  const siblings = (await repos.videoCuts.list(ctx, project.id)).filter(
    (c) => c.name === ONE_PROMPT_CUT_NAME,
  );
  const edlBytes = stableStringify(edl);
  const replay = siblings.find((c) => stableStringify(edlSchema.parse(c.edl)) === edlBytes);
  const cut =
    replay ??
    (
      await repos.videoCuts.create(ctx, project.id, {
        name: ONE_PROMPT_CUT_NAME,
        version: siblings.reduce((max, c) => Math.max(max, c.version), 0) + 1,
        edl,
        meta: {
          onePrompt: {
            directionDraftId: staged.draft.id,
            promptSourceId,
            at: now.toISOString(),
          },
        },
      })
    ).cut;

  return {
    status: "queued",
    promptSourceId,
    stages: staged.stages,
    draft: staged.draft,
    project,
    takes,
    cut,
    srt,
  };
}
