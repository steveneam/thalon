import { plannedSlotSchema, type PlannedSlotInput, type TenantCtx } from "@thalon/contracts";
import { and, eq, gte, lt } from "drizzle-orm";
import { NotFoundError } from "../errors";
import { drafts, plannedSlots } from "../schema";
import type { Db } from "../types";
import { appendEvent } from "./events";

/** One operator-planned publish slot (Phase-I window, s61) — the calendar's drag target. */
export type PlannedSlotRow = typeof plannedSlots.$inferSelect;

export function plannedSlotsRepo(db: Db) {
  return {
    /**
     * Plan or re-plan a draft's slot — the ONE write door the calendar
     * drag uses. (tenant, draft) unique makes this an upsert: first call
     * creates (`draft.slot_planned`), a later call moves it
     * (`draft.slot_replanned`). The draft must be the tenant's own —
     * foreign drafts read as absent (tenancy wall).
     */
    async plan(ctx: TenantCtx, input: PlannedSlotInput): Promise<PlannedSlotRow> {
      const parsed = plannedSlotSchema.parse(input);
      return db.transaction(async (tx) => {
        const [draft] = await tx
          .select({ id: drafts.id })
          .from(drafts)
          .where(and(eq(drafts.id, parsed.draftId), eq(drafts.tenantId, ctx.tenantId)))
          .limit(1);
        if (!draft) throw new NotFoundError("draft", parsed.draftId);

        const [existing] = await tx
          .select()
          .from(plannedSlots)
          .where(
            and(eq(plannedSlots.tenantId, ctx.tenantId), eq(plannedSlots.draftId, parsed.draftId)),
          )
          .limit(1);

        if (existing) {
          const [row] = await tx
            .update(plannedSlots)
            .set({
              scheduledFor: new Date(parsed.scheduledFor),
              note: parsed.note ?? existing.note,
              updatedAt: new Date(),
            })
            .where(eq(plannedSlots.id, existing.id))
            .returning();
          await appendEvent(tx, ctx, {
            entityType: "draft",
            entityId: parsed.draftId,
            event: "draft.slot_replanned",
            payload: { from: existing.scheduledFor.toISOString(), to: parsed.scheduledFor },
          });
          return row;
        }

        const [row] = await tx
          .insert(plannedSlots)
          .values({
            tenantId: ctx.tenantId,
            draftId: parsed.draftId,
            scheduledFor: new Date(parsed.scheduledFor),
            note: parsed.note,
          })
          .returning();
        await appendEvent(tx, ctx, {
          entityType: "draft",
          entityId: parsed.draftId,
          event: "draft.slot_planned",
          payload: { scheduledFor: parsed.scheduledFor },
        });
        return row;
      });
    },

    /** Remove a draft's plan (the calendar's un-schedule). Idempotent-loud: no slot = NotFoundError, never a silent no-op. */
    async unplan(ctx: TenantCtx, draftId: string): Promise<void> {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .delete(plannedSlots)
          .where(and(eq(plannedSlots.tenantId, ctx.tenantId), eq(plannedSlots.draftId, draftId)))
          .returning();
        if (!row) throw new NotFoundError("planned slot for draft", draftId);
        await appendEvent(tx, ctx, {
          entityType: "draft",
          entityId: draftId,
          event: "draft.slot_unplanned",
          payload: { scheduledFor: row.scheduledFor.toISOString() },
        });
      });
    },

    async getForDraft(ctx: TenantCtx, draftId: string): Promise<PlannedSlotRow | null> {
      const [row] = await db
        .select()
        .from(plannedSlots)
        .where(and(eq(plannedSlots.tenantId, ctx.tenantId), eq(plannedSlots.draftId, draftId)))
        .limit(1);
      return row ?? null;
    },

    /** The calendar's range read: every slot in [from, to). */
    async listRange(ctx: TenantCtx, range: { from: Date; to: Date }): Promise<PlannedSlotRow[]> {
      return db
        .select()
        .from(plannedSlots)
        .where(
          and(
            eq(plannedSlots.tenantId, ctx.tenantId),
            gte(plannedSlots.scheduledFor, range.from),
            lt(plannedSlots.scheduledFor, range.to),
          ),
        )
        .orderBy(plannedSlots.scheduledFor);
    },
  };
}

export type PlannedSlotsRepo = ReturnType<typeof plannedSlotsRepo>;
