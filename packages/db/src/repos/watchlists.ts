import type { TenantCtx } from "@thalon/contracts";
import { and, eq } from "drizzle-orm";
import { NotFoundError } from "../errors";
import { watchlists } from "../schema";
import type { Db } from "../types";
import { appendEvent } from "./events";

/** One tenant watchlist row (B4.3) — durable runtime config for the trend intake. */
export type Watchlist = typeof watchlists.$inferSelect;

export function watchlistsRepo(db: Db) {
  return {
    async create(
      ctx: TenantCtx,
      input: { source: string; accounts?: string[]; queries?: string[] },
    ): Promise<Watchlist> {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .insert(watchlists)
          .values({
            tenantId: ctx.tenantId,
            source: input.source,
            accounts: input.accounts ?? [],
            queries: input.queries ?? [],
          })
          .returning();
        await appendEvent(tx, ctx, {
          entityType: "watchlist",
          entityId: row.id,
          event: "watchlist.created",
          payload: { source: row.source },
        });
        return row;
      });
    },

    async get(ctx: TenantCtx, id: string): Promise<Watchlist | null> {
      const [row] = await db
        .select()
        .from(watchlists)
        .where(and(eq(watchlists.id, id), eq(watchlists.tenantId, ctx.tenantId)))
        .limit(1);
      return row ?? null;
    },

    /** The pass-3 poller loop's fan-out read: every watchlist a driver serves for a tenant. */
    async listBySource(ctx: TenantCtx, source: string): Promise<Watchlist[]> {
      return db
        .select()
        .from(watchlists)
        .where(and(eq(watchlists.tenantId, ctx.tenantId), eq(watchlists.source, source)));
    },

    async list(ctx: TenantCtx): Promise<Watchlist[]> {
      return db.select().from(watchlists).where(eq(watchlists.tenantId, ctx.tenantId));
    },

    async update(
      ctx: TenantCtx,
      id: string,
      patch: { accounts?: string[]; queries?: string[] },
    ): Promise<Watchlist> {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .update(watchlists)
          .set({
            ...(patch.accounts ? { accounts: patch.accounts } : {}),
            ...(patch.queries ? { queries: patch.queries } : {}),
            updatedAt: new Date(),
          })
          .where(and(eq(watchlists.id, id), eq(watchlists.tenantId, ctx.tenantId)))
          .returning();
        if (!row) throw new NotFoundError("watchlist", id);
        await appendEvent(tx, ctx, {
          entityType: "watchlist",
          entityId: row.id,
          event: "watchlist.updated",
          payload: { keys: Object.keys(patch) },
        });
        return row;
      });
    },
  };
}

export type WatchlistsRepo = ReturnType<typeof watchlistsRepo>;
