import { sweepScheduleConfigSchema, type TenantCtx } from "@thalon/contracts";
import { eq } from "drizzle-orm";
import { NotFoundError } from "../errors";
import { sweepSchedules } from "../schema";
import type { Db } from "../types";
import { appendEvent } from "./events";

/** The per-tenant sweep-timer config row (Sprint-8 window, B-arm.1) — at most one per tenant. */
export type SweepSchedule = typeof sweepSchedules.$inferSelect;

export function sweepSchedulesRepo(db: Db) {
  return {
    /** Null = the tenant has never configured a schedule (the scheduler treats it as disabled). */
    async get(ctx: TenantCtx): Promise<SweepSchedule | null> {
      const [row] = await db
        .select()
        .from(sweepSchedules)
        .where(eq(sweepSchedules.tenantId, ctx.tenantId))
        .limit(1);
      return row ?? null;
    },

    /**
     * Create-or-update the tenant's one schedule row — validated at the
     * write door (contracts bounds: 15 min floor, 24 h ceiling). Writing
     * the values the row already holds is an idempotent replay (no write,
     * no event); a real change emits in the same transaction.
     */
    async upsert(
      ctx: TenantCtx,
      input: { enabled?: boolean; cadenceMinutes?: number },
    ): Promise<SweepSchedule> {
      const valid = sweepScheduleConfigSchema.parse(input);
      return db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(sweepSchedules)
          .where(eq(sweepSchedules.tenantId, ctx.tenantId))
          .limit(1);
        if (
          existing &&
          existing.enabled === valid.enabled &&
          existing.cadenceMinutes === valid.cadenceMinutes
        ) {
          return existing;
        }
        const [row] = await tx
          .insert(sweepSchedules)
          .values({
            tenantId: ctx.tenantId,
            enabled: valid.enabled,
            cadenceMinutes: valid.cadenceMinutes,
          })
          .onConflictDoUpdate({
            target: sweepSchedules.tenantId,
            set: {
              enabled: valid.enabled,
              cadenceMinutes: valid.cadenceMinutes,
              updatedAt: new Date(),
            },
          })
          .returning();
        await appendEvent(tx, ctx, {
          entityType: "sweep_schedule",
          entityId: row.id,
          event: "sweep.schedule_updated",
          payload: { enabled: valid.enabled, cadenceMinutes: valid.cadenceMinutes },
        });
        return row;
      });
    },

    /**
     * The scheduler's honest clock — recorded only when a sweep actually
     * ran (the runner calls this after persisting its bundles). The clock
     * is passed in, never read here (deterministic-core convention).
     */
    async markSwept(ctx: TenantCtx, at: Date): Promise<SweepSchedule> {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .update(sweepSchedules)
          .set({ lastSweepAt: at, updatedAt: new Date() })
          .where(eq(sweepSchedules.tenantId, ctx.tenantId))
          .returning();
        if (!row) throw new NotFoundError("sweep_schedule", ctx.tenantId);
        await appendEvent(tx, ctx, {
          entityType: "sweep_schedule",
          entityId: row.id,
          event: "sweep.schedule_swept",
          payload: { at: at.toISOString() },
        });
        return row;
      });
    },
  };
}

export type SweepSchedulesRepo = ReturnType<typeof sweepSchedulesRepo>;
