import {
  directionDocDraftMetaSchema,
  resolveStagePlan,
  storyboardDraftMetaSchema,
  type TenantCtx,
} from "@thalon/contracts";
import { NotFoundError, type Draft, type JudgeResult, type Repos } from "@thalon/db";
import type { GridDraft, PanelJudgeResult } from "@/lib/approve-queue/types";
import type { FlowStage, StagedFlowState } from "./types";
import { isStagedDraftFormat } from "./types";

/**
 * s67 (the founder's s66 find): one-prompt video chains are REAL stage
 * drafts in the database, but the staged-flow endpoints served only the
 * B5.4 in-memory demo store — so every real storyboard/direction_doc draft
 * in Approve answered "belongs to no staged flow" and the operator could
 * not inspect a blocked pillar chain. This module is the READ half of the
 * pass-3 swap: a `StagedFlowState` projection built from the drafts table
 * (chain walked via `meta.priorDraftId`), served behind the same GET.
 *
 * Deliberately read-only: candidates are always null (a one-prompt run
 * picks internally), presets/captures are empty, and the surface renders
 * without interactive affordances (`source: "live"`). Stage EDITING for
 * live chains — pick/edit/advance against the engine pipeline — is the
 * write half of pass 3 and stays a bucket, not a side effect of this fix;
 * approve/reject/re-judge already work through the draft panel's own doors.
 */

const toGridDraft = (draft: Draft): GridDraft => ({
  ...draft,
  createdAt: draft.createdAt.toISOString(),
  updatedAt: draft.updatedAt.toISOString(),
});

const toPanelJudgeResult = (row: JudgeResult): PanelJudgeResult => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
});

/** Latest-created wins: a re-advance after an upstream edit keys a NEW child; the projection follows the newest branch. */
function latest(drafts: readonly Draft[]): Draft {
  return drafts.reduce((a, b) => (b.createdAt.getTime() >= a.createdAt.getTime() ? b : a));
}

function stageIndexOf(draft: Draft): number | null {
  const meta = draft.meta as { stageIndex?: unknown } | null;
  return meta && typeof meta.stageIndex === "number" ? meta.stageIndex : null;
}

/**
 * The live projection, anchored at any stage draft of a chain. Returns null
 * when the draft doesn't exist, isn't a stage format, or its meta doesn't
 * parse — the route keeps its existing honest 404.
 */
export async function getLiveStagedFlow(
  repos: Repos,
  ctx: TenantCtx,
  draftId: string,
): Promise<StagedFlowState | null> {
  let anchor: Draft;
  try {
    anchor = await repos.drafts.get(ctx, draftId);
  } catch (err) {
    if (err instanceof NotFoundError) return null;
    throw err;
  }
  if (!isStagedDraftFormat(anchor.format)) return null;

  // Walk BACK to the storyboard (stage 0) via priorDraftId. A missing prior
  // (pruned) ends the walk — the partial chain still projects honestly.
  const chain: Draft[] = [anchor];
  let head = anchor;
  while (head.format === "direction_doc") {
    const meta = directionDocDraftMetaSchema.safeParse(head.meta);
    if (!meta.success) return null;
    try {
      head = await repos.drafts.get(ctx, meta.data.priorDraftId);
    } catch (err) {
      if (err instanceof NotFoundError) break;
      throw err;
    }
    chain.unshift(head);
  }

  const headMeta =
    head.format === "storyboard"
      ? storyboardDraftMetaSchema.safeParse(head.meta)
      : directionDocDraftMetaSchema.safeParse(head.meta);
  if (!headMeta.success) return null;
  const family = headMeta.data.family;
  const plan = resolveStagePlan(family);

  // Walk FORWARD: index every direction_doc by its prior, follow the newest.
  const docs = await repos.drafts.listByFormat(ctx, "direction_doc");
  const childrenOf = new Map<string, Draft[]>();
  for (const doc of docs) {
    const meta = directionDocDraftMetaSchema.safeParse(doc.meta);
    if (!meta.success) continue;
    const kids = childrenOf.get(meta.data.priorDraftId) ?? [];
    kids.push(doc);
    childrenOf.set(meta.data.priorDraftId, kids);
  }
  let tail = chain[chain.length - 1];
  const seen = new Set(chain.map((d) => d.id));
  for (;;) {
    const kids = childrenOf.get(tail.id)?.filter((d) => !seen.has(d.id));
    if (!kids?.length) break;
    tail = latest(kids);
    chain.push(tail);
    seen.add(tail.id);
  }

  const byIndex = new Map<number, Draft>();
  for (const draft of chain) {
    const index = stageIndexOf(draft);
    if (index !== null) byIndex.set(index, draft);
  }
  if (byIndex.size === 0) return null;
  const currentIndex = Math.min(Math.max(...byIndex.keys()), plan.stages.length - 1);

  const stages: FlowStage[] = await Promise.all(
    plan.stages.map(async (def, i): Promise<FlowStage> => {
      const draft = byIndex.get(i) ?? null;
      const judgeResults = draft ? await repos.judgeResults.listForDraft(ctx, draft.id) : [];
      return {
        def,
        status: i < currentIndex ? "done" : i === currentIndex ? "current" : "locked",
        draft: draft ? toGridDraft(draft) : null,
        judgeResults: judgeResults.map(toPanelJudgeResult),
        candidates: null,
      };
    }),
  );

  return {
    source: "live",
    family,
    plan,
    stages,
    currentIndex,
    presets: [],
    captures: [],
  };
}
