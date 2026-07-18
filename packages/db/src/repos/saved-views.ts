import {
  savedViewPatchSchema,
  savedViewSchema,
  type SavedViewInput,
  type SavedViewPatch,
  type TenantCtx,
} from "@thalon/contracts";
import { and, asc, eq } from "drizzle-orm";
import { NotFoundError } from "../errors";
import { savedViews } from "../schema";
import type { Db } from "../types";
import { appendEvent } from "./events";

/** One tenant-wide named view config (Phase-I window, s61) — the board/calendar view tabs. */
export type SavedViewRow = typeof savedViews.$inferSelect;

export function savedViewsRepo(db: Db) {
  return {
    /** Create a named view. (tenant, surface, name) unique — a duplicate name fails loud (the operator renames, we never silently overwrite a view). */
    async create(ctx: TenantCtx, input: SavedViewInput): Promise<SavedViewRow> {
      const parsed = savedViewSchema.parse(input);
      return db.transaction(async (tx) => {
        const [row] = await tx
          .insert(savedViews)
          .values({
            tenantId: ctx.tenantId,
            surface: parsed.surface,
            name: parsed.name,
            config: parsed.config,
            position: parsed.position,
          })
          .returning();
        await appendEvent(tx, ctx, {
          entityType: "saved_view",
          entityId: row.id,
          event: "saved_view.created",
          payload: { surface: row.surface, name: row.name },
        });
        return row;
      });
    },

    /** Patch name/config/position. Explicit-partial contract shape (the zod-4 .partial() trap stays out). */
    async update(ctx: TenantCtx, id: string, patch: SavedViewPatch): Promise<SavedViewRow> {
      const parsed = savedViewPatchSchema.parse(patch);
      return db.transaction(async (tx) => {
        const [row] = await tx
          .update(savedViews)
          .set({
            ...(parsed.name !== undefined ? { name: parsed.name } : {}),
            ...(parsed.config !== undefined ? { config: parsed.config } : {}),
            ...(parsed.position !== undefined ? { position: parsed.position } : {}),
            updatedAt: new Date(),
          })
          .where(and(eq(savedViews.id, id), eq(savedViews.tenantId, ctx.tenantId)))
          .returning();
        if (!row) throw new NotFoundError("saved view", id);
        await appendEvent(tx, ctx, {
          entityType: "saved_view",
          entityId: row.id,
          event: "saved_view.updated",
          payload: { surface: row.surface, name: row.name },
        });
        return row;
      });
    },

    async remove(ctx: TenantCtx, id: string): Promise<void> {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .delete(savedViews)
          .where(and(eq(savedViews.id, id), eq(savedViews.tenantId, ctx.tenantId)))
          .returning();
        if (!row) throw new NotFoundError("saved view", id);
        await appendEvent(tx, ctx, {
          entityType: "saved_view",
          entityId: row.id,
          event: "saved_view.deleted",
          payload: { surface: row.surface, name: row.name },
        });
      });
    },

    /** A surface's tabs in tab order (position, then name — ties stay stable). */
    async list(ctx: TenantCtx, surface: string): Promise<SavedViewRow[]> {
      return db
        .select()
        .from(savedViews)
        .where(and(eq(savedViews.tenantId, ctx.tenantId), eq(savedViews.surface, surface)))
        .orderBy(asc(savedViews.position), asc(savedViews.name));
    },
  };
}

export type SavedViewsRepo = ReturnType<typeof savedViewsRepo>;
