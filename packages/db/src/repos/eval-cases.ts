import type { TenantCtx } from "@thalon/contracts";
import { and, asc, eq } from "drizzle-orm";
import { evalCases } from "../schema";
import type { Db, EvalCase } from "../types";

/**
 * Read side only: eval_cases rows are WRITTEN exclusively by mechanisms
 * (approvals.record on operator edits, golden/manual importers later) —
 * never ad hoc. The eval suite consumes them via this list.
 */
export function evalCasesRepo(db: Db) {
  return {
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
