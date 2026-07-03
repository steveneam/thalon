import {
  judgeEvidenceSchema,
  type JudgeEvidence,
  type TenantCtx,
  type Verdict,
} from "@thalon/contracts";
import { and, eq } from "drizzle-orm";
import { judgeResults } from "../schema";
import type { Db, JudgeResult } from "../types";
import { getDraftScoped } from "./drafts";

/** Append-only: verdicts are never updated, a re-judge appends new rows for the new body hash. */
export function judgeResultsRepo(db: Db) {
  return {
    async append(
      ctx: TenantCtx,
      input: {
        draftId: string;
        gate: string;
        verdict: Verdict;
        /** Defaults to the draft's CURRENT body hash — pass explicitly only when recording a verdict computed against older content. */
        bodyHash?: string;
        evidence?: JudgeEvidence;
        model?: string;
        promptVersion?: string;
        latencyMs?: number;
      },
    ): Promise<JudgeResult> {
      const draft = await getDraftScoped(db, ctx, input.draftId);
      const evidence = input.evidence
        ? judgeEvidenceSchema.parse(input.evidence)
        : { claims: [] };
      const [row] = await db
        .insert(judgeResults)
        .values({
          tenantId: ctx.tenantId,
          draftId: input.draftId,
          gate: input.gate,
          verdict: input.verdict,
          bodyHash: input.bodyHash ?? draft.bodyHash,
          evidence,
          model: input.model,
          promptVersion: input.promptVersion,
          latencyMs: input.latencyMs,
        })
        .returning();
      return row;
    },

    async listForDraft(ctx: TenantCtx, draftId: string): Promise<JudgeResult[]> {
      return db
        .select()
        .from(judgeResults)
        .where(
          and(
            eq(judgeResults.tenantId, ctx.tenantId),
            eq(judgeResults.draftId, draftId),
          ),
        );
    },
  };
}

export type JudgeResultsRepo = ReturnType<typeof judgeResultsRepo>;
