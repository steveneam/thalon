import type { TenantCtx } from "@thalon/contracts";
import { and, asc, eq } from "drizzle-orm";
import { sourceMetrics } from "../schema";
import type { Db, SourceMetric } from "../types";

export interface SourceMetricInput {
  sourceId: string;
  /** Generic by rule (SPINE §4.1): platform metric names arrive as tenant data, never hard-coded. */
  metricName: string;
  metricValue: number;
}

/**
 * B2.2 (A5): append-only per-source engagement metrics. Readers: exemplar
 * retrieval (B2.4) and the analytics join (B3.5). Rows are never updated —
 * re-capturing a metric appends a fresh row (`captured_at` orders them).
 */
export function sourceMetricsRepo(db: Db) {
  return {
    async add(ctx: TenantCtx, input: SourceMetricInput): Promise<SourceMetric> {
      const [row] = await db
        .insert(sourceMetrics)
        .values({
          tenantId: ctx.tenantId,
          sourceId: input.sourceId,
          metricName: input.metricName,
          metricValue: input.metricValue,
        })
        .returning();
      return row;
    },

    async listBySource(ctx: TenantCtx, sourceId: string): Promise<SourceMetric[]> {
      return db
        .select()
        .from(sourceMetrics)
        .where(and(eq(sourceMetrics.tenantId, ctx.tenantId), eq(sourceMetrics.sourceId, sourceId)))
        .orderBy(asc(sourceMetrics.capturedAt), asc(sourceMetrics.id));
    },
  };
}

export type SourceMetricsRepo = ReturnType<typeof sourceMetricsRepo>;
