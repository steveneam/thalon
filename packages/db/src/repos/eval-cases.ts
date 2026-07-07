import type { TenantCtx } from "@thalon/contracts";
import { and, asc, eq } from "drizzle-orm";
import { evalCases } from "../schema";
import type { Db, EvalCase } from "../types";
import { appendEvent } from "./events";

/**
 * eval_cases rows are WRITTEN exclusively by mechanisms (approvals.record
 * on operator edits; recordIntelDismiss on intel triage) — never ad hoc.
 * The eval suite consumes them via list.
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
