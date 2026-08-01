import type { TenantCtx } from "@thalon/contracts";
import { and, asc, eq } from "drizzle-orm";
import { evalCases } from "../schema";
import type { Db, EvalCase } from "../types";
import { appendEvent } from "./events";

/**
 * eval_cases rows are WRITTEN exclusively by mechanisms (approvals.record
 * on operator edits AND rejects-with-reason (s90 window, origin
 * 'approve_reject'); recordIntelDismiss on intel triage; recordLeadTriage
 * on the leads queue; recordCutDiffReview on editor proposals) — never ad
 * hoc. The eval suite consumes them via list.
 */
export function evalCasesRepo(db: Db) {
  return {
    /**
     * B6.7 (carried from ADR 0005): the intel-triage learning door — a
     * dismissal is SIGNAL, captured durably with its own origin
     * ('intel_dismiss'; check-constraint enforced) so the taxonomy
     * separating mechanism-written from human-authored rows stays honest.
     * `expected` records only the ground truth (the operator dismissed) —
     * never an invented semantic label; a future ranker-tuning harness
     * interprets it. One transaction with the audit event (invariant I4).
     */
    async recordIntelDismiss(
      ctx: TenantCtx,
      input: { kind: string; input: Record<string, unknown>; sourceRef?: string },
    ): Promise<EvalCase> {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .insert(evalCases)
          .values({
            tenantId: ctx.tenantId,
            kind: input.kind,
            input: input.input,
            expected: { operatorAction: "dismissed" },
            origin: "intel_dismiss",
            sourceRef: input.sourceRef,
          })
          .returning();
        await appendEvent(tx, ctx, {
          entityType: "eval_case",
          entityId: row.id,
          event: "eval_case.recorded",
          payload: { kind: input.kind, origin: "intel_dismiss", sourceRef: input.sourceRef ?? null },
        });
        return row;
      });
    },

    /**
     * B-crm.2 (window-1a): the leads-queue learning door — a dismissal or
     * pin of a ranked lead is operator signal on the SCORING, captured with
     * its own origin ('lead_triage', check-constraint enforced). `expected`
     * records only the ground truth (what the operator did) — the future
     * weight-tuning harness (B-crm.5) interprets it. Same transaction as
     * the audit event (invariant I4).
     */
    async recordLeadTriage(
      ctx: TenantCtx,
      input: {
        kind: string;
        input: Record<string, unknown>;
        action: "dismissed" | "pinned" | "unpinned";
        sourceRef?: string;
      },
    ): Promise<EvalCase> {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .insert(evalCases)
          .values({
            tenantId: ctx.tenantId,
            kind: input.kind,
            input: input.input,
            expected: { operatorAction: input.action },
            origin: "lead_triage",
            sourceRef: input.sourceRef,
          })
          .returning();
        await appendEvent(tx, ctx, {
          entityType: "eval_case",
          entityId: row.id,
          event: "eval_case.recorded",
          payload: { kind: input.kind, origin: "lead_triage", sourceRef: input.sourceRef ?? null },
        });
        return row;
      });
    },

    /**
     * B-ve.4 (half-window amendment): the editor's proposal learning door —
     * an operator REJECTING an agent-proposed EDL diff is a correction on
     * the proposer, captured with its own origin ('cut_diff_review',
     * check-constraint enforced) and the reject discipline of the take
     * tables: the reason is REQUIRED, it is the learning material.
     * `expected` records only the ground truth (rejected + why) — a future
     * proposer-tuning harness interprets it. Same transaction as the audit
     * event (invariant I4).
     */
    async recordCutDiffReview(
      ctx: TenantCtx,
      input: {
        kind: string;
        input: Record<string, unknown>;
        reason: string;
        sourceRef?: string;
      },
    ): Promise<EvalCase> {
      if (!input.reason.trim()) {
        throw new Error("a rejected proposal must carry its reason (the learning material)");
      }
      return db.transaction(async (tx) => {
        const [row] = await tx
          .insert(evalCases)
          .values({
            tenantId: ctx.tenantId,
            kind: input.kind,
            input: input.input,
            expected: { operatorAction: "rejected", reason: input.reason },
            origin: "cut_diff_review",
            sourceRef: input.sourceRef,
          })
          .returning();
        await appendEvent(tx, ctx, {
          entityType: "eval_case",
          entityId: row.id,
          event: "eval_case.recorded",
          payload: {
            kind: input.kind,
            origin: "cut_diff_review",
            sourceRef: input.sourceRef ?? null,
          },
        });
        return row;
      });
    },

    async list(
      ctx: TenantCtx,
      filter: { origin?: string; kind?: string; limit?: number } = {},
    ): Promise<EvalCase[]> {
      const conditions = [eq(evalCases.tenantId, ctx.tenantId)];
      if (filter.origin) conditions.push(eq(evalCases.origin, filter.origin));
      if (filter.kind) conditions.push(eq(evalCases.kind, filter.kind));
      return db
        .select()
        .from(evalCases)
        .where(and(...conditions))
        .orderBy(asc(evalCases.createdAt), asc(evalCases.id))
        .limit(filter.limit ?? 1000);
    },
  };
}

export type EvalCasesRepo = ReturnType<typeof evalCasesRepo>;
