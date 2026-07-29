import {
  admittedPlatforms,
  type CreateBrief,
  type CreateChildRef,
  type CreateFamily,
  type CreatePlan,
  type TenantCtx,
} from "@thalon/contracts";
import { InvalidStateError, type Draft, type Repos } from "@thalon/db";
import { runJudgePipeline } from "@thalon/judge";
import { runFanout, type FanoutDeps } from "../fanout/fanout";
import type { IngestDeps } from "../ingest/ingest";
import { runOutreachEmail, type OutreachEmailDeps } from "../outreach/compose";
import { runOnePromptVideo, type OnePromptVideoDeps } from "../pipeline/one-prompt-video";
import {
  startVideoStages,
  type OnePromptJudgeDeps,
  type StagedVideoDeps,
} from "../pipeline/staged-video";
import { runWebPageGeneration, type WebPageDeps } from "../webpage/webpage";
import { readCreateContext } from "./plan";

/**
 * B-create.2, the **dispatch table**: one arm per Create family, each a thin
 * adapter over a generation engine that already exists and already judges.
 * Spec Decision 3 — *one orchestrator over existing engines, not a rewrite;
 * keep the orchestrator thin*. Nothing here generates anything: every arm
 * assembles the request its family engine already takes, hands over the
 * judge deps it was given, and reports what came back as child refs.
 *
 * TWO RULES THIS FILE EXISTS TO KEEP:
 *
 *  1. **The judge is never bypassed and never re-implemented.** Every arm
 *     either dispatches to an engine that judges internally (staged video)
 *     or runs the SAME shared harness the rest of the product runs
 *     (`runJudgePipeline`, via `judgeIfFresh` below) with the caller's own
 *     drivers, untouched. `CreateJudgeDeps` is literally the video
 *     pipeline's `OnePromptJudgeDeps` — one type flowing through, so
 *     "with its judge deps intact" is a thing the type system can hold.
 *  2. **Reference-role media never travels.** Arms receive a brief whose
 *     media has already passed `outputEligible` (see `run.ts`), so reference
 *     bytes are structurally absent from everything this file can reach. The
 *     references' *notes* arrive as text, inside the brief.
 *
 * WHERE GROUNDING RIDES, per arm, because the engines genuinely differ:
 * `runWebPageGeneration` and `startVideoStages` take a `groundingSourceIds`
 * list, so the operator's picks ride as IDS and the single-draft spine
 * grounds each one separately. `runFanout`, `runOutreachEmail` and
 * `runOnePromptVideo` take no such list — their grounding is the one source
 * they are given — so the picks are INLINED into the brief text instead.
 * Dropping them for those families would silently discard an operator input.
 */

/* ------------------------------------------------------------------ */
/* What an arm is given.                                                */
/* ------------------------------------------------------------------ */

/**
 * The judge drivers, threaded from the caller to whichever engine gates.
 * Deliberately the video pipeline's own type rather than a parallel one:
 * two structurally identical judge-dep shapes would be two places to forget
 * a tier.
 */
export type CreateJudgeDeps = OnePromptJudgeDeps;

/**
 * Per-family generation-driver overrides. Absent — the production case —
 * every engine falls back to its own gateway default, exactly as it does
 * when called directly. Tests pass fakes here and the whole dispatch stays
 * keyless and networkless.
 */
export interface CreateGenerationDeps {
  fanout?: FanoutDeps;
  webpage?: WebPageDeps;
  outreach?: OutreachEmailDeps;
  staged?: StagedVideoDeps;
  ingest?: IngestDeps;
}

/** How the operator's grounding picks reach an engine — see the file docblock. */
export type GroundingMode = "ids" | "inline";

export interface CreateDispatchInput {
  ctx: TenantCtx;
  repos: Repos;
  /**
   * The brief AS THE ARMS SEE IT: identical to the operator's, except that
   * `media` has been filtered through `outputEligible`. Reference envelopes
   * are gone by construction, not by discipline.
   */
  brief: CreateBrief;
  plan: CreatePlan;
  /**
   * The brief text an engine receives — the operator's prompt plus any
   * reference notes, plus (in `inline` mode) the picked sources' own text.
   * Memoized per mode: asking twice costs one assembly.
   */
  briefText: (grounding: GroundingMode) => Promise<string>;
  /** That same text, ingested as the run's ONE prompt source. Memoized per mode. */
  briefSource: (grounding: GroundingMode) => Promise<string>;
  judge: CreateJudgeDeps;
  generation: CreateGenerationDeps;
  /** Injected clock — the video path stamps rows with it (tests pin the time). */
  now: () => Date;
}

/**
 * One independently-failing piece of work. A run is a LIST of these because
 * spec Error Behavior requires that one destination failing does not take
 * the others with it: `run.ts` executes each unit inside its own boundary,
 * so a thrown unit costs exactly its own children.
 */
export interface CreateDispatchUnit {
  /** What this unit is, in the operator's vocabulary — a destination, or the family word when the run has one unit. */
  label: string;
  run: () => Promise<CreateChildRef[]>;
}

/** A family arm: pure planning of the work, so `run.ts` owns every failure boundary. */
export type CreateFamilyArm = (input: CreateDispatchInput) => CreateDispatchUnit[];

export type CreateDispatchTable = Readonly<Record<CreateFamily, CreateFamilyArm>>;

/* ------------------------------------------------------------------ */
/* The arms.                                                            */
/* ------------------------------------------------------------------ */

/**
 * post → the fan-out, **once per admitted destination**.
 *
 * `runFanout` takes N platforms and generates them in a loop that ABORTS on
 * the first irrecoverable one — correct for a fan-out (its replay backfills
 * the missing platforms), but it would make one bad destination cost the
 * whole Create run, which spec Error Behavior forbids. One call per
 * destination buys per-destination failure isolation at the price of one
 * `fanout_runs` row each. The price is real and worth naming: a four-
 * destination post run leaves four fan-out rows rather than one.
 *
 * Each call keeps the fan-out's own generation key intact, so a re-run
 * costs nothing for destinations that already produced their draft.
 */
const postArm: CreateFamilyArm = (input) =>
  admittedPlatforms(input.plan).map((platform) => ({
    label: platform,
    run: async () => {
      const sourceId = await input.briefSource("inline");
      const result = await runFanout(
        input.ctx,
        input.repos,
        {
          sourceId,
          platforms: [platform],
          // The plan's discoverability candidates (the Intel keyword). The
          // fan-out folds its own profile topics in after these — passing
          // them here too would promote them above their own priority rung.
          ...(input.plan.targetTerms.length > 0 ? { targetTerms: [...input.plan.targetTerms] } : {}),
        },
        input.generation.fanout ?? {},
      );
      return [
        { kind: "fanout_run" as const, id: result.runId },
        ...(await judgeAll(input, result.drafts)),
      ];
    },
  }));

/**
 * page → the web-page engine. One unit: a page run produces ONE artifact
 * however many destinations it will later deploy to, so per-destination
 * splitting would be inventing work.
 */
const pageArm: CreateFamilyArm = (input) => [
  {
    label: "page",
    run: async () => {
      const promptSourceId = await input.briefSource("ids");
      const result = await runWebPageGeneration(
        input.ctx,
        input.repos,
        {
          promptSourceId,
          ...(input.brief.sourceRefs.length > 0
            ? { groundingSourceIds: [...input.brief.sourceRefs] }
            : {}),
        },
        input.generation.webpage ?? {},
      );
      return [
        { kind: "fanout_run" as const, id: result.runId },
        ...(await judgeAll(input, [result.draft])),
      ];
    },
  },
];

/**
 * email → the outreach compose door.
 *
 * The recipient is NOT invented: `runOutreachEmail` resolves nothing itself
 * and the engine may never guess an address, so the lead comes from the
 * brief's Intel context (`context.leadId`, what a `lead_promote` capture
 * carries — apps/web `CreateContext`) and is read from the leads repo. A
 * brief without one is refused loudly BEFORE the run row exists, in
 * `run.ts`: there is nothing to write an email to.
 */
const emailArm: CreateFamilyArm = (input) => [
  {
    label: "email",
    run: async () => {
      const { leadId } = readCreateContext(input.brief.context);
      if (!leadId) throw missingLeadError();
      const lead = await input.repos.leads.get(input.ctx, leadId);
      if (!lead) {
        throw new InvalidStateError(
          `lead "${leadId}" not found for this tenant — an email run addresses a lead the CRM holds, never an address the engine invents`,
        );
      }
      const briefSourceId = await input.briefSource("inline");
      const result = await runOutreachEmail(
        input.ctx,
        input.repos,
        {
          briefSourceId,
          recipient: { leadId: lead.id, email: lead.email, name: lead.name },
        },
        input.generation.outreach ?? {},
      );
      return [
        { kind: "fanout_run" as const, id: result.runId },
        ...(await judgeAll(input, [result.draft])),
      ];
    },
  },
];

/**
 * video → one of two doors, chosen by the brief's own `mode`:
 *
 *  - `prompt` (the hero, armed today): the one-prompt auto-run — ingest →
 *    staged drafts judged BETWEEN stages → video project + takes plan +
 *    compile-gated draft cut. Judging is inside that engine; this arm hands
 *    it the drivers and reads the result.
 *  - `wizard`: the advanced staged mode the 2026-07-05 doctrine promised —
 *    stage 0 only, judged, with the operator advancing each later stage from
 *    the surface (`advanceVideoStage` refuses to advance past an unjudged
 *    stage, which is what makes the wizard a review flow rather than a
 *    slower auto-run).
 *
 * ⚠ The spec's dispatch sketch named `origination` for one-prompt video.
 * `runOrigination` produces a `pillar_script` draft — a real artifact, but
 * not the door Create's video family runs today: `apps/web/api/create/video`
 * calls `runOnePromptVideo`, which is what "one-prompt video, armed" in the
 * spec's own gap table refers to. Dispatching to the armed door is the
 * substitution; it is named here and in the lane wrap rather than made
 * silently.
 */
const videoArm: CreateFamilyArm = (input) => [
  {
    label: "video",
    run: async () =>
      input.brief.mode === "wizard" ? stagedVideo(input) : onePromptVideo(input),
  },
];

async function onePromptVideo(input: CreateDispatchInput): Promise<CreateChildRef[]> {
  const prompt = await input.briefText("inline");
  const { sourceUrl } = readCreateContext(input.brief.context);
  const deps: OnePromptVideoDeps = {
    ctx: input.ctx,
    repos: input.repos,
    // Threaded verbatim. The orchestrator has no opinion about judging and
    // no way to express one: it does not construct these, it forwards them.
    judge: input.judge,
    ...(input.generation.staged ? { staged: input.generation.staged } : {}),
    ...(input.generation.ingest ? { ingest: input.generation.ingest } : {}),
  };
  const result = await runOnePromptVideo(deps, { prompt, ...(sourceUrl ? { sourceUrl } : {}) }, input.now());
  if (result.status === "blocked") {
    // A judge block is an OUTCOME, not a crash: the blocked draft is a real
    // child in the operator's triage queue, and its reason rides verbatim so
    // the Composer can show the tab in words rather than as an empty state.
    return [
      {
        kind: "draft",
        id: result.draft.id,
        error: `judge blocked the "${result.blockedStageKey}" stage — the draft is in triage`,
      },
    ];
  }
  // The project and the final judged draft. The intermediate stage drafts
  // are the project's own chain (each reachable from it and from the approve
  // queue); listing them here would make "the run's children" mean something
  // different for video than for every other family.
  return [
    { kind: "video_project", id: result.project.id },
    { kind: "draft", id: result.draft.id },
  ];
}

async function stagedVideo(input: CreateDispatchInput): Promise<CreateChildRef[]> {
  const promptSourceId = await input.briefSource("ids");
  const started = await startVideoStages(
    input.ctx,
    input.repos,
    {
      promptSourceId,
      ...(input.brief.sourceRefs.length > 0
        ? { groundingSourceIds: [...input.brief.sourceRefs] }
        : {}),
    },
    input.generation.staged ?? {},
  );
  return [
    { kind: "fanout_run" as const, id: started.runId },
    ...(await judgeAll(input, [started.draft])),
  ];
}

export const DEFAULT_CREATE_DISPATCH: CreateDispatchTable = {
  post: postArm,
  video: videoArm,
  page: pageArm,
  email: emailArm,
};

/* ------------------------------------------------------------------ */
/* The judge, run the one way it is run everywhere else.                */
/* ------------------------------------------------------------------ */

async function judgeAll(
  input: CreateDispatchInput,
  drafts: readonly Draft[],
): Promise<CreateChildRef[]> {
  const refs: CreateChildRef[] = [];
  for (const draft of drafts) refs.push(await judgeIfFresh(input, draft));
  return refs;
}

/**
 * The `composeEmailDraft` pattern, verbatim: judge ONLY a draft that is
 * still `generated`. An idempotent replay returns drafts that may already be
 * queued, blocked or approved — re-judging those would re-spend gateway
 * calls and fight the state machine over a decision the operator already
 * has.
 *
 * A blocked draft is recorded as a child WITH its verbatim reason, never
 * dropped: the run produced it, the gate refused it, and both facts belong
 * on the record (spec Error Behavior — the Composer shows the refusal in
 * words).
 */
async function judgeIfFresh(input: CreateDispatchInput, draft: Draft): Promise<CreateChildRef> {
  if (draft.status !== "generated") return { kind: "draft", id: draft.id };
  const outcome = await runJudgePipeline(input.repos, {
    ctx: input.ctx,
    draftId: draft.id,
    screenDriver: input.judge.screenDriver,
    finalDriver: input.judge.finalDriver,
    ...(input.judge.capTokens === undefined ? {} : { capTokens: input.judge.capTokens }),
  });
  return outcome.status === "blocked"
    ? { kind: "draft", id: draft.id, error: `judge blocked: ${outcome.reason}` }
    : { kind: "draft", id: draft.id };
}

/** Shared between the pre-flight check in `run.ts` and the arm itself, so the sentence exists once. */
export function missingLeadError(): InvalidStateError {
  return new InvalidStateError(
    'an email run needs a lead: its brief carries no `context.leadId`. Reach Create through a lead card\'s "→ Email" exit so the recipient rides in — an email engine may never invent an address.',
  );
}
