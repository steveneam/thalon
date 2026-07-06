import {
  searchTargetSchema,
  type SearchTargetInput,
  type SearchTargetStatus,
  type TenantCtx,
} from "@thalon/contracts";
import { and, eq } from "drizzle-orm";
import { NotFoundError } from "../errors";
import { searchTargets } from "../schema";
import type { Db } from "../types";
import { appendEvent } from "./events";

/** One compiled keyword target (B6.8) — the search half of intel's runtime config. */
export type SearchTarget = typeof searchTargets.$inferSelect;

export function searchTargetsRepo(db: Db) {
  return {
    /**
     * Idempotent on the structural key `(tenant, keyword)` — recompiling the
     * profile-seeded list replays cleanly (`created: false`, the existing row
     * returned UNCHANGED: first origin wins, a dismissal survives recompiles).
     * Input is zod-validated at this single write door.
     */
    async add(
      ctx: TenantCtx,
      input: SearchTargetInput,
    ): Promise<{ target: SearchTarget; created: boolean }> {
      const parsed = searchTargetSchema.parse(input);
      return db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(searchTargets)
          .values({
            tenantId: ctx.tenantId,
            keyword: parsed.keyword,
            origin: parsed.origin,
            meta: parsed.meta,
          })
          .onConflictDoNothing({ target: [searchTargets.tenantId, searchTargets.keyword] })
          .returning();
        if (!inserted) {
          const [existing] = await tx
            .select()
            .from(searchTargets)
            .where(
              and(
                eq(searchTargets.tenantId, ctx.tenantId),
                eq(searchTargets.keyword, parsed.keyword),
              ),
            )
            .limit(1);
          if (!existing) {
            throw new Error(
              `search target "${parsed.keyword}" conflicted but cannot be read back — cross-tenant key collision?`,
            );
          }
          return { target: existing, created: false };
        }
        await appendEvent(tx, ctx, {
          entityType: "search_target",
          entityId: inserted.id,
          event: "search_target.created",
          payload: { keyword: parsed.keyword, origin: parsed.origin },
        });
        return { target: inserted, created: true };
      });
    },

    async get(ctx: TenantCtx, id: string): Promise<SearchTarget | null> {
      const [row] = await db
        .select()
        .from(searchTargets)
        .where(and(eq(searchTargets.id, id), eq(searchTargets.tenantId, ctx.tenantId)))
        .limit(1);
      return row ?? null;
    },

    /** Generation context + the Search tab read the ACTIVE targets. */
    async list(ctx: TenantCtx, filter?: { status?: SearchTargetStatus }): Promise<SearchTarget[]> {
      return db
        .select()
        .from(searchTargets)
        .where(
          and(
            eq(searchTargets.tenantId, ctx.tenantId),
            ...(filter?.status ? [eq(searchTargets.status, filter.status)] : []),
          ),
        );
    },

    /** Dismissed, never deleted — the operator's dismissal is signal (→ eval row at the caller). */
    async setStatus(
      ctx: TenantCtx,
      id: string,
      status: SearchTargetStatus,
    ): Promise<SearchTarget> {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .update(searchTargets)
          .set({ status, updatedAt: new Date() })
          .where(and(eq(searchTargets.id, id), eq(searchTargets.tenantId, ctx.tenantId)))
          .returning();
        if (!row) throw new NotFoundError("search_target", id);
        await appendEvent(tx, ctx, {
          entityType: "search_target",
          entityId: row.id,
          event: "search_target.status_changed",
          payload: { status },
        });
        return row;
      });
    },
  };
}

export type SearchTargetsRepo = ReturnType<typeof searchTargetsRepo>;
