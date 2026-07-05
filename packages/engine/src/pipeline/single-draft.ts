import type { TenantCtx } from "@thalon/contracts";
import {
  IrrecoverableGenerationError,
  sha256Hex,
  stableStringify,
  type Draft,
  type Repos,
} from "@thalon/db";

/**
 * THE single-draft origination spine (B4.1 — one deterministic core;
 * origination/webpage/storyboard parameterize it by format plan). Owns the
 * repeated block those three proved by repetition:
 *
 *   pinned key material -> sha256(stableStringify(...)) generation key
 *   -> idempotency fast path (a repeat call with the draft already persisted
 *      returns it with ZERO shell calls, before ever reaching the gateway)
 *   -> backfill (a run row without its draft — a prior irrecoverable failure
 *      — regenerates the single missing draft, reusing the same run)
 *   -> bounded validated generation (the caller's `generate`, expected to be
 *      metered through withGatewayGuard and the shared repair loop)
 *   -> draft persisted in status "generated" only, generation key
 *      sha256(`${runKey}:${format}`) — the judge harness is the only path
 *      onward.
 *
 * Key material and both key compositions are BYTE-PINNED by
 * src/__tests__/key-stability.test.ts (CHARTER A10): change nothing here
 * that changes bytes.
 */

export interface SingleDraftResult {
  runId: string;
  /** false whenever the run row itself already existed. */
  created: boolean;
  draft: Draft;
}

export interface SingleDraftPlan<TOut> {
  /** Draft `format` — also the pinned `:format` suffix of the draft generation key. */
  format: string;
  /** The format's PINNED generation-key field set — hashed exactly as before B4.1. */
  keyMaterial: Record<string, unknown>;
  /** `fanout_runs` row fields for a fresh run (the fast path never writes one). */
  run: {
    sourceId: string;
    brandProfileId: string;
    brandProfileVersion: number;
    platforms: string[];
    promptVersion: string;
    model: string;
    params?: Record<string, unknown>;
  };
  /** Label for the irrecoverable-generation error, e.g. "pillar-script generation". */
  irrecoverableLabel: string;
  /**
   * Assembles context and runs the guarded shell through the bounded repair
   * loop. Called ONLY when no persisted draft exists — the fast path does no
   * reads beyond the run/draft lookups and never touches the gateway.
   */
  generate: () => Promise<{ output: TOut | null; attempts: number; lastError?: string }>;
  /**
   * Builds the draft row from the validated output. May persist a pre-draft
   * artifact first (webpage writes its content-addressed HTML here, so a
   * draft can never reference bytes that aren't durably in the store).
   */
  toDraft: (output: TOut) => Promise<{ platform: string; body: string; meta: Record<string, unknown> }>;
}

export async function runSingleDraftPipeline<TOut>(
  ctx: TenantCtx,
  repos: Repos,
  plan: SingleDraftPlan<TOut>,
): Promise<SingleDraftResult> {
  const generationKey = sha256Hex(stableStringify(plan.keyMaterial));

  // Fast-path idempotency check: a repeat call skips generation entirely,
  // before ever reaching the gateway — UNLESS a prior call created the run
  // but never persisted its draft (backfill below).
  const existingRun = await repos.fanoutRuns.getByGenerationKey(ctx, generationKey);

  let runId: string;
  let runGenerationKey: string;
  let created: boolean;

  if (existingRun) {
    const existingDrafts = await repos.drafts.listByRun(ctx, existingRun.id);
    if (existingDrafts.length > 0) {
      return { runId: existingRun.id, created: false, draft: existingDrafts[0] };
    }
    runId = existingRun.id;
    runGenerationKey = existingRun.generationKey;
    created = false;
  } else {
    const run = await repos.fanoutRuns.create(ctx, { ...plan.run, generationKey });
    runId = run.id;
    runGenerationKey = run.generationKey;
    created = true;
  }

  const result = await plan.generate();
  if (!result.output) {
    const error = new IrrecoverableGenerationError(
      `${plan.irrecoverableLabel} was irrecoverable after ${result.attempts} attempt(s): ${result.lastError ?? "malformed shell output"}`,
      result.attempts,
      result.lastError,
    );
    // B4.5: the run row keeps the failure for operator triage — recorded
    // BEFORE the throw so a caller that crashes still leaves the trail.
    await repos.fanoutRuns.recordLastError(ctx, runId, error.message);
    throw error;
  }

  const { platform, body, meta } = await plan.toDraft(result.output);
  const draft = await repos.drafts.create(ctx, {
    fanoutRunId: runId,
    sourceId: plan.run.sourceId,
    platform,
    body,
    format: plan.format,
    generationKey: sha256Hex(`${runGenerationKey}:${plan.format}`),
    meta,
  });

  // B4.5: a successful backfill clears the stale failure record (only the
  // backfill path can carry one — a freshly created run never had it).
  if (existingRun?.lastError) {
    await repos.fanoutRuns.recordLastError(ctx, runId, null);
  }

  return { runId, created, draft };
}
