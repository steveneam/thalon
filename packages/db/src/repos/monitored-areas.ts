import {
  monitoredAreaConfigSchema,
  type MonitoredAreaConfig,
  type MonitoredAreaStatus,
  type TenantCtx,
} from "@thalon/contracts";
import { and, eq } from "drizzle-orm";
import { NotFoundError } from "../errors";
import { monitoredAreas } from "../schema";
import type { Db } from "../types";
import { appendEvent } from "./events";

/** One monitored area row (B6.4) — durable per-tenant runtime config for intel v2. */
export type MonitoredArea = typeof monitoredAreas.$inferSelect;

export function monitoredAreasRepo(db: Db) {
  return {
    /** Config is zod-validated here at the single write door — invalid config fails loud, never stores. */
    async create(
      ctx: TenantCtx,
      input: { name: string; description: string; config?: MonitoredAreaConfig },
    ): Promise<MonitoredArea> {
      const config = monitoredAreaConfigSchema.parse(input.config ?? {});
      return db.transaction(async (tx) => {
        const [row] = await tx
          .insert(monitoredAreas)
          .values({
            tenantId: ctx.tenantId,
            name: input.name,
            description: input.description,
            config,
          })
          .returning();
        await appendEvent(tx, ctx, {
          entityType: "monitored_area",
          entityId: row.id,
          event: "monitored_area.created",
          payload: { name: row.name },
        });
        return row;
      });
    },

    async get(ctx: TenantCtx, id: string): Promise<MonitoredArea | null> {
      const [row] = await db
        .select()
        .from(monitoredAreas)
        .where(and(eq(monitoredAreas.id, id), eq(monitoredAreas.tenantId, ctx.tenantId)))
        .limit(1);
      return row ?? null;
    },

    async list(ctx: TenantCtx, filter?: { status?: MonitoredAreaStatus }): Promise<MonitoredArea[]> {
      return db
        .select()
        .from(monitoredAreas)
        .where(
          and(
            eq(monitoredAreas.tenantId, ctx.tenantId),
            ...(filter?.status ? [eq(monitoredAreas.status, filter.status)] : []),
          ),
        );
    },

    /** Pause instead of delete — a paused area stops expanding into queries but keeps its history. */
    async update(
      ctx: TenantCtx,
      id: string,
      patch: {
        name?: string;
        description?: string;
        config?: MonitoredAreaConfig;
        status?: MonitoredAreaStatus;
      },
    ): Promise<MonitoredArea> {
      const config = patch.config ? monitoredAreaConfigSchema.parse(patch.config) : undefined;
      return db.transaction(async (tx) => {
        const [row] = await tx
          .update(monitoredAreas)
          .set({
            ...(patch.name ? { name: patch.name } : {}),
            ...(patch.description ? { description: patch.description } : {}),
            ...(config ? { config } : {}),
            ...(patch.status ? { status: patch.status } : {}),
            updatedAt: new Date(),
          })
          .where(and(eq(monitoredAreas.id, id), eq(monitoredAreas.tenantId, ctx.tenantId)))
          .returning();
        if (!row) throw new NotFoundError("monitored_area", id);
        await appendEvent(tx, ctx, {
          entityType: "monitored_area",
          entityId: row.id,
          event: "monitored_area.updated",
          payload: { keys: Object.keys(patch) },
        });
        return row;
      });
    },
  };
}

export type MonitoredAreasRepo = ReturnType<typeof monitoredAreasRepo>;
