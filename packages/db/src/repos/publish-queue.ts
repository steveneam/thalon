import {
  assertPublishQueueTransition,
  publishQueueEnqueueSchema,
  tenantCtx,
  type PublishQueueEnqueueInput,
  type PublishQueueStatus,
  type SocialPlatform,
  type TenantCtx,
} from "@thalon/contracts";
import { and, asc, eq, inArray, isNull, lt, lte, or } from "drizzle-orm";
import { InvalidStateError, NotFoundError } from "../errors";
import { sha256Hex } from "../hash";
import { drafts, publishQueue } from "../schema";
import type { Db } from "../types";
import { appendEvent } from "./events";

/** One committed publish intent (s82 window) — the Schedule verb's row. */
export type PublishQueueRow = typeof publishQueue.$inferSelect;

/**
 * The structural idempotency key: replaying the exact same schedule appends
 * nothing. It is hashed rather than concatenated because the column is
 * GLOBALLY unique (a column-level `.unique()` since B0.3, exempt from the
 * tenant-salted-index ratchet by that shape) — so the tenant id must be
 * *inside* the key, or two tenants scheduling their own drafts could collide
 * across the tenancy wall.
 */
function enqueueKey(parts: {
  tenantId: string;
  draftId: string;
  platform: string;
  scheduledAt: Date;
}): string {
  return sha256Hex(
    `publish-queue:${parts.tenantId}:${parts.draftId}:${parts.platform}:${parts.scheduledAt.toISOString()}`,
  );
}

/** Rows that still intend to publish — the set a second enqueue must not duplicate. */
const LIVE_STATUSES: readonly PublishQueueStatus[] = ["pending", "processing"];

/**
 * The shared state-change body: tenancy wall → contracts rulebook → row →
 * event, all in one transaction. Every terminal verb goes through it, so no
 * caller can invent a transition the rulebook forbids. A module function
 * rather than a method: repos are plain objects, and a `this`-bound helper
 * would break the moment one was destructured.
 */
async function transition(
  db: Db,
  ctx: TenantCtx,
  id: string,
  to: PublishQueueStatus,
  emit: { event: string; payload?: Record<string, unknown>; lastError?: string },
): Promise<PublishQueueRow> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(publishQueue)
      .where(and(eq(publishQueue.id, id), eq(publishQueue.tenantId, ctx.tenantId)))
      .limit(1);
    if (!current) throw new NotFoundError("publish_queue row", id);
    assertPublishQueueTransition(current.status as PublishQueueStatus, to);
    const [row] = await tx
      .update(publishQueue)
      .set({
        status: to,
        updatedAt: new Date(),
        ...(emit.lastError === undefined ? {} : { lastError: emit.lastError }),
      })
      .where(and(eq(publishQueue.id, id), eq(publishQueue.tenantId, ctx.tenantId)))
      .returning();
    await appendEvent(tx, ctx, {
      entityType: "publish_queue",
      entityId: row.id,
      event: emit.event,
      payload: { ...(emit.payload ?? {}), from: current.status, to },
    });
    return row;
  });
}

/**
 * s82 window (W1). The queue's ONE write door, over a table dormant since
 * B0.3. Every verb here moves a row between statuses the contracts rulebook
 * allows and emits its event in the same transaction; nothing in this file
 * reaches a platform — the consumer hands claimed rows to the publish door,
 * which keeps its whole refusal ladder.
 *
 * Two verbs are deliberately SYSTEM-level (`listDue`, `releaseStale`), not
 * tenant-walled: due-math across every tenant is the consumer's question, the
 * `sweepSchedules.listAll` precedent. Nothing tenant-facing may call them,
 * and each derives its event context from the row's own tenant so an audit
 * trail still lands on the right side of the wall.
 */
export function publishQueueRepo(db: Db) {
  return {
    /**
     * The Schedule verb's write. Idempotent on (tenant, draft, platform,
     * scheduledAt): the identical schedule replays to the existing row
     * untouched, `created: false`.
     *
     * A DIFFERENT time for a draft already queued on that platform is refused
     * rather than added. Two live rows for one draft+platform would race to
     * post the same content twice; the publish door's duplicate rung would
     * catch the second, but only after spending a live call to fail. The
     * operator cancels and re-schedules — an explicit act, and the refusal
     * names the row standing in the way.
     */
    async enqueue(
      ctx: TenantCtx,
      input: PublishQueueEnqueueInput,
    ): Promise<{ row: PublishQueueRow; created: boolean }> {
      const parsed = publishQueueEnqueueSchema.parse(input);
      const scheduledAt = new Date(parsed.scheduledAt);
      return db.transaction(async (tx) => {
        const [draft] = await tx
          .select({ id: drafts.id })
          .from(drafts)
          .where(and(eq(drafts.id, parsed.draftId), eq(drafts.tenantId, ctx.tenantId)))
          .limit(1);
        if (!draft) throw new NotFoundError("draft", parsed.draftId);

        const key = enqueueKey({
          tenantId: ctx.tenantId,
          draftId: parsed.draftId,
          platform: parsed.platform,
          scheduledAt,
        });

        const live = await tx
          .select()
          .from(publishQueue)
          .where(
            and(
              eq(publishQueue.tenantId, ctx.tenantId),
              eq(publishQueue.draftId, parsed.draftId),
              eq(publishQueue.platform, parsed.platform),
              inArray(publishQueue.status, [...LIVE_STATUSES]),
            ),
          );
        const replay = live.find((row) => row.idempotencyKey === key);
        if (replay) return { row: replay, created: false };
        const clash = live[0];
        if (clash) {
          throw new InvalidStateError(
            `draft "${parsed.draftId}" is already queued for ${parsed.platform} at ` +
              `${clash.scheduledAt?.toISOString() ?? "an unspecified time"} (queue row ${clash.id}, ${clash.status}) — ` +
              `cancel that row before scheduling a different time`,
          );
        }

        const [inserted] = await tx
          .insert(publishQueue)
          .values({
            tenantId: ctx.tenantId,
            draftId: parsed.draftId,
            platform: parsed.platform,
            scheduledAt,
            status: "pending",
            idempotencyKey: key,
          })
          .onConflictDoNothing({ target: publishQueue.idempotencyKey })
          .returning();
        if (!inserted) {
          // The key exists but carries no LIVE row — a prior attempt at this
          // exact schedule already reached a terminal state. Read it back:
          // replaying a published/cancelled schedule must return that history,
          // never quietly open a second window onto the same moment.
          const [existing] = await tx
            .select()
            .from(publishQueue)
            .where(
              and(
                eq(publishQueue.tenantId, ctx.tenantId),
                eq(publishQueue.idempotencyKey, key),
              ),
            )
            .limit(1);
          if (!existing) {
            throw new Error(
              `publish queue row for draft "${parsed.draftId}" on ${parsed.platform} conflicted but cannot be read back — cross-tenant key collision?`,
            );
          }
          return { row: existing, created: false };
        }

        await appendEvent(tx, ctx, {
          entityType: "publish_queue",
          entityId: inserted.id,
          event: "publish_queue.enqueued",
          payload: {
            draftId: parsed.draftId,
            platform: parsed.platform,
            scheduledAt: scheduledAt.toISOString(),
          },
        });
        return { row: inserted, created: true };
      });
    },

    async get(ctx: TenantCtx, id: string): Promise<PublishQueueRow | null> {
      const [row] = await db
        .select()
        .from(publishQueue)
        .where(and(eq(publishQueue.id, id), eq(publishQueue.tenantId, ctx.tenantId)))
        .limit(1);
      return row ?? null;
    },

    /** The queue surface's read: this tenant's rows, newest schedule first, optionally by status. */
    async list(
      ctx: TenantCtx,
      filter?: { status?: PublishQueueStatus; platform?: SocialPlatform },
    ): Promise<PublishQueueRow[]> {
      return db
        .select()
        .from(publishQueue)
        .where(
          and(
            eq(publishQueue.tenantId, ctx.tenantId),
            ...(filter?.status ? [eq(publishQueue.status, filter.status)] : []),
            ...(filter?.platform ? [eq(publishQueue.platform, filter.platform)] : []),
          ),
        )
        .orderBy(asc(publishQueue.scheduledAt));
    },

    /**
     * SYSTEM-level (the `sweepSchedules.listAll` precedent): every tenant's
     * pending rows whose time has come, oldest first. A NULL `scheduled_at`
     * counts as due — the column is nullable from B0.3 and a row must never
     * be able to hide from the consumer by lacking a time.
     */
    async listDue(at: Date, limit = 50): Promise<PublishQueueRow[]> {
      return db
        .select()
        .from(publishQueue)
        .where(
          and(
            eq(publishQueue.status, "pending"),
            or(isNull(publishQueue.scheduledAt), lte(publishQueue.scheduledAt, at)),
          ),
        )
        .orderBy(asc(publishQueue.scheduledAt))
        .limit(limit);
    },

    /**
     * SYSTEM-level: take a row for this tick. The `status = 'pending'`
     * predicate lives in the UPDATE itself, so two consumers racing the same
     * row resolve in the database — the loser gets `null` and moves on rather
     * than both proceeding to publish. The clock is passed in, never read
     * here (deterministic-core convention).
     */
    async claim(id: string, at: Date): Promise<PublishQueueRow | null> {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .update(publishQueue)
          .set({ status: "processing", updatedAt: at })
          .where(and(eq(publishQueue.id, id), eq(publishQueue.status, "pending")))
          .returning();
        if (!row) return null;
        await appendEvent(tx, tenantCtx(row.tenantId), {
          entityType: "publish_queue",
          entityId: row.id,
          event: "publish_queue.claimed",
          payload: { at: at.toISOString(), platform: row.platform },
        });
        return row;
      });
    },

    /**
     * The row published. `externalPostId` is the platform's own id, the same
     * one the `social_publications` ledger records — this stamps the queue's
     * copy of that fact so a queue view needs no join to prove the row
     * finished, while the ledger stays the audit answer.
     */
    async complete(
      ctx: TenantCtx,
      id: string,
      result: { externalPostId: string },
    ): Promise<PublishQueueRow> {
      return transition(db, ctx, id, "published", {
        event: "publish_queue.published",
        payload: { externalPostId: result.externalPostId },
      });
    },

    /**
     * The row failed, terminally, and says why on its face. The reason lands
     * VERBATIM (the B1.5 lesson: an operational failure and a refused post
     * look identical unless the actual text survives).
     */
    async fail(ctx: TenantCtx, id: string, input: { reason: string }): Promise<PublishQueueRow> {
      return transition(db, ctx, id, "failed", {
        event: "publish_queue.failed",
        payload: { reason: input.reason },
        lastError: input.reason,
      });
    },

    /** The operator's un-schedule. Only a row that has not yet been claimed can be withdrawn — mid-flight is not a decision the operator can still make. */
    async cancel(ctx: TenantCtx, id: string): Promise<PublishQueueRow> {
      return transition(db, ctx, id, "cancelled", { event: "publish_queue.cancelled" });
    },

    /**
     * SYSTEM-level recovery: rows claimed before `staleBefore` and never
     * finished go back to `pending` for the next tick. A consumer that was
     * killed mid-publish is the case this exists for; without it those rows
     * are stranded in `processing` with nothing able to move them.
     *
     * NOTE the release is honest about what it does NOT know: whether the
     * platform call happened. The publish door's own duplicate rung (e) is
     * what makes a re-run safe — it refuses a draft already recorded on that
     * platform — so a released row either publishes once or fails loudly, and
     * never silently double-posts.
     */
    async releaseStale(staleBefore: Date, at: Date): Promise<PublishQueueRow[]> {
      return db.transaction(async (tx) => {
        const stale = await tx
          .select()
          .from(publishQueue)
          .where(
            and(eq(publishQueue.status, "processing"), lt(publishQueue.updatedAt, staleBefore)),
          );
        const released: PublishQueueRow[] = [];
        for (const row of stale) {
          const [updated] = await tx
            .update(publishQueue)
            .set({ status: "pending", updatedAt: at })
            .where(eq(publishQueue.id, row.id))
            .returning();
          await appendEvent(tx, tenantCtx(row.tenantId), {
            entityType: "publish_queue",
            entityId: row.id,
            event: "publish_queue.released",
            payload: { claimedAt: row.updatedAt.toISOString(), staleBefore: staleBefore.toISOString() },
          });
          released.push(updated);
        }
        return released;
      });
    },
  };
}

export type PublishQueueRepo = ReturnType<typeof publishQueueRepo>;
