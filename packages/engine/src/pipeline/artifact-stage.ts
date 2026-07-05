import type { TenantCtx } from "@thalon/contracts";
import { InvalidStateError, type Draft, type Repos } from "@thalon/db";

/**
 * THE post-approval artifact stage (B4.1 — one helper behind the
 * render/deploy/capture trio). Owns the shape those three proved by
 * repetition:
 *
 *   approved-only gate (asserted up front — post-approval-only work, never
 *   speculative spend) -> pinned meta parse -> `updatedAt` snapshot ->
 *   format-specific seam-driver middle (`execute`) -> ONE
 *   optimistic-concurrency `updateMeta` patch recording the stage's outcome
 *   (success ref or failed+null — the meta must reflect the LATEST attempt's
 *   truth; a concurrent stage run of the same draft loses as a loud
 *   `ConcurrentUpdateError`, never a silent clobber).
 *
 * `execute` returns the meta patch plus a result mapper; it THROWS to abort
 * with NO meta write — the invariant-break path (a missing generation-path
 * artifact, a success-path teardown failure) where recording "failed" would
 * itself be a lie.
 */

export interface ArtifactStageSpec<TMeta, TResult> {
  /** Optional format gate (render/deploy assert it; capture relies on the meta parse). */
  format?: { expected: string; mismatchMessage: (draft: Draft) => string };
  notApprovedMessage: (draft: Draft) => string;
  parseMeta: (meta: unknown) => TMeta;
  execute: (
    draft: Draft,
    meta: TMeta,
  ) => Promise<{ patch: Record<string, unknown>; finish: (updated: Draft) => TResult }>;
}

export async function runArtifactStage<TMeta, TResult>(
  ctx: TenantCtx,
  repos: Repos,
  draftId: string,
  spec: ArtifactStageSpec<TMeta, TResult>,
): Promise<TResult> {
  const draft = await repos.drafts.get(ctx, draftId);
  if (spec.format && draft.format !== spec.format.expected) {
    throw new InvalidStateError(spec.format.mismatchMessage(draft));
  }
  if (draft.status !== "approved") {
    throw new InvalidStateError(spec.notApprovedMessage(draft));
  }
  const meta = spec.parseMeta(draft.meta);
  const expectedUpdatedAt = draft.updatedAt;

  const { patch, finish } = await spec.execute(draft, meta);
  const updated = await repos.drafts.updateMeta(ctx, draftId, expectedUpdatedAt, patch);
  return finish(updated);
}
