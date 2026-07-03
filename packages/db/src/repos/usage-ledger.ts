import type { TenantCtx } from "@thalon/contracts";
import { and, eq, sql } from "drizzle-orm";
import { BudgetExceededError } from "../errors";
import { usageLedger } from "../schema";
import type { Db } from "../types";
import { appendEvent } from "./events";

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function usageLedgerRepo(db: Db) {
  return {
    /** Accumulates one gateway call into the tenant × day × model row. */
    async record(
      ctx: TenantCtx,
      input: {
        model: string;
        tokensIn: number;
        tokensOut: number;
        costEstimate?: number;
        day?: string;
      },
    ): Promise<void> {
      await db
        .insert(usageLedger)
        .values({
          tenantId: ctx.tenantId,
          day: input.day ?? todayUtc(),
          model: input.model,
          tokensIn: input.tokensIn,
          tokensOut: input.tokensOut,
          costEstimate: input.costEstimate ?? 0,
        })
        .onConflictDoUpdate({
          target: [usageLedger.tenantId, usageLedger.day, usageLedger.model],
          set: {
            tokensIn: sql`${usageLedger.tokensIn} + excluded.tokens_in`,
            tokensOut: sql`${usageLedger.tokensOut} + excluded.tokens_out`,
            costEstimate: sql`${usageLedger.costEstimate} + excluded.cost_estimate`,
          },
        });
    },

    async totalForDay(
      ctx: TenantCtx,
      day: string = todayUtc(),
    ): Promise<{ tokensIn: number; tokensOut: number; costEstimate: number }> {
      const [row] = await db
        .select({
          tokensIn: sql<number>`coalesce(sum(${usageLedger.tokensIn}), 0)::bigint`,
          tokensOut: sql<number>`coalesce(sum(${usageLedger.tokensOut}), 0)::bigint`,
          costEstimate: sql<number>`coalesce(sum(${usageLedger.costEstimate}), 0)::float8`,
        })
        .from(usageLedger)
        .where(and(eq(usageLedger.tenantId, ctx.tenantId), eq(usageLedger.day, day)));
      return {
        tokensIn: Number(row?.tokensIn ?? 0),
        tokensOut: Number(row?.tokensOut ?? 0),
        costEstimate: Number(row?.costEstimate ?? 0),
      };
    },

    /**
     * The gateway wrapper calls this BEFORE every shell call (amendment A2).
     * Over budget ⇒ emit a budget.exceeded event and hard-stop — fail loud,
     * never silently degrade. The event is written outside any transaction so
     * it survives the throw.
     */
    async assertWithinBudget(
      ctx: TenantCtx,
      input: { capTokens: number; day?: string },
    ): Promise<{ totalTokens: number; capTokens: number }> {
      const day = input.day ?? todayUtc();
      const totals = await this.totalForDay(ctx, day);
      const totalTokens = totals.tokensIn + totals.tokensOut;
      if (totalTokens >= input.capTokens) {
        await appendEvent(db, ctx, {
          entityType: "tenant",
          entityId: ctx.tenantId,
          event: "budget.exceeded",
          payload: { day, totalTokens, capTokens: input.capTokens },
        });
        throw new BudgetExceededError(ctx.tenantId, day, totalTokens, input.capTokens);
      }
      return { totalTokens, capTokens: input.capTokens };
    },
  };
}

export type UsageLedgerRepo = ReturnType<typeof usageLedgerRepo>;
