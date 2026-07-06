import type { TenantCtx } from "@thalon/contracts";
import { and, asc, eq } from "drizzle-orm";
import { searchSnapshots } from "../schema";
import type { Db } from "../types";
import { appendEvent } from "./events";

/** One query's search-performance counters at one capture instant (B6.8) — append-only. */
export type SearchSnapshot = typeof searchSnapshots.$inferSelect;

export interface AppendSearchSnapshotInput {
  source: string;
  query: string;
  /** Page/URL dimension; omit for the site-level aggregate. */
  page?: string;
  metrics: Record<string, number>;
  capturedAt: Date;
}

export function searchSnapshotsRepo(db: Db) {
  return {
    /**
     * Append-only capture, mirroring trendSnapshots.append. Idempotent on
     * the structural key `(tenant, source, query, page, capturedAt)`:
     * replaying the same sweep appends nothing and reports `created: false`
     * — history rows are never updated, so the horizon math's stored
     * baseline can't be rewritten.
     */
    async append(
      ctx: TenantCtx,
      input: AppendSearchSnapshotInput,
    ): Promise<{ snapshot: SearchSnapshot; created: boolean }> {
      const page = input.page ?? "";
      return db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(searchSnapshots)
          .values({
            tenantId: ctx.tenantId,
            source: input.source,
            query: input.query,
            page,
            metrics: input.metrics,
            capturedAt: input.capturedAt,
          })
          .onConflictDoNothing({
            target: [
              searchSnapshots.tenantId,
              searchSnapshots.source,
              searchSnapshots.query,
              searchSnapshots.page,
              searchSnapshots.capturedAt,
            ],
          })
          .returning();
        if (!inserted) {
          const [existing] = await tx
            .select()
            .from(searchSnapshots)
            .where(
              and(
                eq(searchSnapshots.tenantId, ctx.tenantId),
                eq(searchSnapshots.source, input.source),
                eq(searchSnapshots.query, input.query),
                eq(searchSnapshots.page, page),
                eq(searchSnapshots.capturedAt, input.capturedAt),
              ),
            )
            .limit(1);
          if (!existing) {
            throw new Error(
              `search snapshot (${input.source}, "${input.query}", ${input.capturedAt.toISOString()}) conflicted but cannot be read back — cross-tenant key collision?`,
            );
          }
          return { snapshot: existing, created: false };
        }
        await appendEvent(tx, ctx, {
          entityType: "search_snapshot",
          entityId: inserted.id,
          event: "search_snapshot.captured",
          payload: { source: input.source, query: input.query, page },
        });
        return { snapshot: inserted, created: true };
      });
    },

    /** One query's history (all pages) in capture order — the horizon math's per-query read. */
    async listByQuery(
      ctx: TenantCtx,
      filter: { source: string; query: string },
    ): Promise<SearchSnapshot[]> {
      return db
        .select()
        .from(searchSnapshots)
        .where(
          and(
            eq(searchSnapshots.tenantId, ctx.tenantId),
            eq(searchSnapshots.source, filter.source),
            eq(searchSnapshots.query, filter.query),
          ),
        )
        .orderBy(asc(searchSnapshots.capturedAt));
    },

    /** A driver's full stored history in capture order — the cross-query sweep read. */
    async listBySource(ctx: TenantCtx, source: string): Promise<SearchSnapshot[]> {
      return db
        .select()
        .from(searchSnapshots)
        .where(and(eq(searchSnapshots.tenantId, ctx.tenantId), eq(searchSnapshots.source, source)))
        .orderBy(asc(searchSnapshots.capturedAt));
    },
  };
}

export type SearchSnapshotsRepo = ReturnType<typeof searchSnapshotsRepo>;
