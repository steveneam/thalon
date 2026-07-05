import type { TenantCtx } from "@thalon/contracts";
import { and, asc, eq } from "drizzle-orm";
import { trendSnapshots } from "../schema";
import type { Db } from "../types";
import { appendEvent } from "./events";

/** One watched item's engagement counters at one capture instant (B4.3) — append-only. */
export type TrendSnapshot = typeof trendSnapshots.$inferSelect;

export interface AppendSnapshotInput {
  source: string;
  externalId: string;
  account: string;
  publishedAt: Date;
  metrics: Record<string, number>;
  capturedAt: Date;
}

export function trendSnapshotsRepo(db: Db) {
  return {
    /**
     * Append-only capture. Idempotent on the structural key
     * `(tenant, source, externalId, capturedAt)`: replaying the same sweep
     * appends nothing and reports `created: false` — history rows are never
     * updated, so an account's stored baseline can't be rewritten.
     */
    async append(
      ctx: TenantCtx,
      input: AppendSnapshotInput,
    ): Promise<{ snapshot: TrendSnapshot; created: boolean }> {
      return db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(trendSnapshots)
          .values({
            tenantId: ctx.tenantId,
            source: input.source,
            externalId: input.externalId,
            account: input.account,
            publishedAt: input.publishedAt,
            metrics: input.metrics,
            capturedAt: input.capturedAt,
          })
          .onConflictDoNothing({
            target: [
              trendSnapshots.tenantId,
              trendSnapshots.source,
              trendSnapshots.externalId,
              trendSnapshots.capturedAt,
            ],
          })
          .returning();
        if (!inserted) {
          const [existing] = await tx
            .select()
            .from(trendSnapshots)
            .where(
              and(
                eq(trendSnapshots.tenantId, ctx.tenantId),
                eq(trendSnapshots.source, input.source),
                eq(trendSnapshots.externalId, input.externalId),
                eq(trendSnapshots.capturedAt, input.capturedAt),
              ),
            )
            .limit(1);
          if (!existing) {
            throw new Error(
              `trend snapshot (${input.source}, ${input.externalId}, ${input.capturedAt.toISOString()}) conflicted but cannot be read back — cross-tenant key collision?`,
            );
          }
          return { snapshot: existing, created: false };
        }
        await appendEvent(tx, ctx, {
          entityType: "trend_snapshot",
          entityId: inserted.id,
          event: "trend_snapshot.captured",
          payload: { source: input.source, externalId: input.externalId, account: input.account },
        });
        return { snapshot: inserted, created: true };
      });
    },

    /** One watched item's history in capture order — the Δ-velocity read. */
    async listByItem(
      ctx: TenantCtx,
      filter: { source: string; externalId: string },
    ): Promise<TrendSnapshot[]> {
      return db
        .select()
        .from(trendSnapshots)
        .where(
          and(
            eq(trendSnapshots.tenantId, ctx.tenantId),
            eq(trendSnapshots.source, filter.source),
            eq(trendSnapshots.externalId, filter.externalId),
          ),
        )
        .orderBy(asc(trendSnapshots.capturedAt));
    },

    /** An account's full stored history in capture order — the longitudinal baseline read. */
    async listByAccount(
      ctx: TenantCtx,
      filter: { source: string; account: string },
    ): Promise<TrendSnapshot[]> {
      return db
        .select()
        .from(trendSnapshots)
        .where(
          and(
            eq(trendSnapshots.tenantId, ctx.tenantId),
            eq(trendSnapshots.source, filter.source),
            eq(trendSnapshots.account, filter.account),
          ),
        )
        .orderBy(asc(trendSnapshots.capturedAt));
    },
  };
}

export type TrendSnapshotsRepo = ReturnType<typeof trendSnapshotsRepo>;
