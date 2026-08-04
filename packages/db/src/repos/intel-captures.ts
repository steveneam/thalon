import {
  intelCaptureSchema,
  type CaptureKind,
  type IntelCaptureInput,
  type TenantCtx,
} from "@thalon/contracts";
import { and, desc, eq } from "drizzle-orm";
import { intelCaptures } from "../schema";
import type { Db } from "../types";
import { appendEvent } from "./events";

/** One recorded operator action on an intel surface (Phase-I window, s61). */
export type IntelCaptureRow = typeof intelCaptures.$inferSelect;

export function intelCapturesRepo(db: Db) {
  return {
    /**
     * Record one capture — promote/dismiss/target-this/lead-promote each
     * call this once per operator action. Deliberately NOT idempotent:
     * every action is its own capture (two promotes of the same card are
     * two intents), so there is no natural replay key.
     */
    async record(ctx: TenantCtx, input: IntelCaptureInput): Promise<IntelCaptureRow> {
      const parsed = intelCaptureSchema.parse(input);
      return db.transaction(async (tx) => {
        const [row] = await tx
          .insert(intelCaptures)
          .values({ tenantId: ctx.tenantId, kind: parsed.kind, payload: parsed.payload })
          .returning();
        await appendEvent(tx, ctx, {
          entityType: "intel_capture",
          entityId: row.id,
          event: "intel.capture_recorded",
          payload: { kind: row.kind },
        });
        return row;
      });
    },

    /** The Create context door's resolve read. */
    async get(ctx: TenantCtx, id: string): Promise<IntelCaptureRow | null> {
      const [row] = await db
        .select()
        .from(intelCaptures)
        .where(and(eq(intelCaptures.id, id), eq(intelCaptures.tenantId, ctx.tenantId)))
        .limit(1);
      return row ?? null;
    },

    /**
     * Station 02's list read: newest first, bounded (the Bounded-List Rule is
     * a UI law — the door caps too).
     *
     * `kind` filters in SQL rather than in the caller, because filtering after
     * the bound silently under-reports: the pipeline board wants the recent
     * PICKS, and a tenant whose last 200 captures are mostly dismissals would
     * hand it a short list that reads as "you picked nothing" (s102).
     */
    async listRecent(
      ctx: TenantCtx,
      opts?: { limit?: number; kind?: CaptureKind },
    ): Promise<IntelCaptureRow[]> {
      const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
      return db
        .select()
        .from(intelCaptures)
        .where(
          opts?.kind
            ? and(eq(intelCaptures.tenantId, ctx.tenantId), eq(intelCaptures.kind, opts.kind))
            : eq(intelCaptures.tenantId, ctx.tenantId),
        )
        .orderBy(desc(intelCaptures.createdAt))
        .limit(limit);
    },
  };
}

export type IntelCapturesRepo = ReturnType<typeof intelCapturesRepo>;
