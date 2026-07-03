import type { TenantCtx } from "@thalon/contracts";
import { and, asc, eq } from "drizzle-orm";
import { events } from "../schema";
import type { Db, EventRow, Executor } from "../types";

export interface AppendEventInput {
  entityType: string;
  entityId: string;
  event: string;
  payload?: Record<string, unknown>;
  actor?: string;
}

/** Internal: called inside the same transaction as the state change it audits (invariant I4). */
export async function appendEvent(
  ex: Executor,
  ctx: TenantCtx,
  input: AppendEventInput,
): Promise<void> {
  await ex.insert(events).values({
    tenantId: ctx.tenantId,
    entityType: input.entityType,
    entityId: input.entityId,
    event: input.event,
    payload: input.payload ?? {},
    actor: input.actor,
  });
}

export function eventsRepo(db: Db) {
  return {
    /** The audit/debugging timeline, in append order. */
    async list(
      ctx: TenantCtx,
      filter: { entityType?: string; entityId?: string; limit?: number } = {},
    ): Promise<EventRow[]> {
      const conditions = [eq(events.tenantId, ctx.tenantId)];
      if (filter.entityType) conditions.push(eq(events.entityType, filter.entityType));
      if (filter.entityId) conditions.push(eq(events.entityId, filter.entityId));
      return db
        .select()
        .from(events)
        .where(and(...conditions))
        .orderBy(asc(events.seq))
        .limit(filter.limit ?? 100);
    },
  };
}

export type EventsRepo = ReturnType<typeof eventsRepo>;
