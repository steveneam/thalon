import type { TenantCtx } from "@thalon/contracts";
import { eq, sql } from "drizzle-orm";
import { llmCache, retrievalCache } from "../schema";
import type { Db } from "../types";

/**
 * Content-addressed caches (SPINE §2.7): keys are pure functions of the
 * inputs (see hash.ts helpers), so re-runs are ~free — which is what makes
 * dogfooding and evals cheap enough to run constantly. tenant_id is
 * accounting only; a hit is a hit whoever warmed it.
 */
export function cachesRepo(db: Db) {
  return {
    llm: {
      async get(key: string): Promise<{ valueRef: string; hitCount: number } | null> {
        const [row] = await db
          .update(llmCache)
          .set({
            hitCount: sql`${llmCache.hitCount} + 1`,
            lastHitAt: new Date(),
          })
          .where(eq(llmCache.key, key))
          .returning({ valueRef: llmCache.valueRef, hitCount: llmCache.hitCount });
        return row ?? null;
      },

      async put(ctx: TenantCtx, input: { key: string; valueRef: string }): Promise<void> {
        // Content-addressed: an existing key already holds the same value.
        await db
          .insert(llmCache)
          .values({ key: input.key, tenantId: ctx.tenantId, valueRef: input.valueRef })
          .onConflictDoNothing({ target: llmCache.key });
      },
    },

    retrieval: {
      async get(key: string): Promise<{ result: unknown; hitCount: number } | null> {
        const [row] = await db
          .update(retrievalCache)
          .set({
            hitCount: sql`${retrievalCache.hitCount} + 1`,
            lastHitAt: new Date(),
          })
          .where(eq(retrievalCache.key, key))
          .returning({
            result: retrievalCache.result,
            hitCount: retrievalCache.hitCount,
          });
        return row ?? null;
      },

      async put(ctx: TenantCtx, input: { key: string; result: unknown }): Promise<void> {
        await db
          .insert(retrievalCache)
          .values({ key: input.key, tenantId: ctx.tenantId, result: input.result })
          .onConflictDoNothing({ target: retrievalCache.key });
      },
    },
  };
}

export type CachesRepo = ReturnType<typeof cachesRepo>;
