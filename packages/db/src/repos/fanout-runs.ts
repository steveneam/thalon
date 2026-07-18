import type { TenantCtx } from "@thalon/contracts";
import { and, desc, eq } from "drizzle-orm";
import { NotFoundError } from "../errors";
import { FANOUT_RUN_STATUSES, fanoutRuns, type FanoutRunStatus } from "../schema";
import type { Db, FanoutRun } from "../types";
import { appendEvent } from "./events";

export function fanoutRunsRepo(db: Db) {
  return {
    /**
     * Idempotent by generation_key (SPINE §1 doctrine: run it twice, get one
     * result) — a retried invocation returns the original row untouched.
     */
    async create(
      ctx: TenantCtx,
      input: {
        sourceId: string;
        brandProfileId: string;
        brandProfileVersion: number;
        platforms: string[];
        promptVersion: string;
        model: string;
        params?: Record<string, unknown>;
        generationKey: string;
      },
    ): Promise<FanoutRun> {
      return db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(fanoutRuns)
          .values({
            tenantId: ctx.tenantId,
            sourceId: input.sourceId,
            brandProfileId: input.brandProfileId,
            brandProfileVersion: input.brandProfileVersion,
            platforms: input.platforms,
            promptVersion: input.promptVersion,
            model: input.model,
            params: input.params ?? {},
            generationKey: input.generationKey,
          })
          .onConflictDoNothing({ target: fanoutRuns.generationKey })
          .returning();
        if (inserted) {
          await appendEvent(tx, ctx, {
            entityType: "fanout_run",
            entityId: inserted.id,
            event: "fanout_run.created",
            payload: { generationKey: input.generationKey },
          });
          return inserted;
        }
        const [existing] = await tx
          .select()
          .from(fanoutRuns)
          .where(
            and(
              eq(fanoutRuns.generationKey, input.generationKey),
              eq(fanoutRuns.tenantId, ctx.tenantId),
            ),
          )
          .limit(1);
        if (!existing) {
          throw new Error(
            `generation_key "${input.generationKey}" exists under another tenant — keys must be tenant-salted`,
          );
        }
        return existing;
      });
    },

    /**
     * B4.5 operator triage: record the LAST irrecoverable failure on this
     * run (or clear it with `null` once a later pass succeeds). The single
     * writer of `last_error` — audited in the same transaction (I4).
     */
    async recordLastError(
      ctx: TenantCtx,
      runId: string,
      message: string | null,
    ): Promise<FanoutRun> {
      return db.transaction(async (tx) => {
        const [updated] = await tx
          .update(fanoutRuns)
          .set({ lastError: message })
          .where(and(eq(fanoutRuns.id, runId), eq(fanoutRuns.tenantId, ctx.tenantId)))
          .returning();
        if (!updated) throw new NotFoundError("fanout_run", runId);
        await appendEvent(tx, ctx, {
          entityType: "fanout_run",
          entityId: runId,
          event:
            message === null
              ? "fanout_run.last_error_cleared"
              : "fanout_run.last_error_recorded",
          payload: message === null ? {} : { message },
        });
        return updated;
      });
    },

    /**
     * THE one writer of `fanout_runs.status` (the lifecycle words in
     * FANOUT_RUN_STATUSES). Validates the word and audits the change (I4)
     * but deliberately enforces NO transition graph — run status is operator
     * telemetry, never a control-flow input, so bookkeeping must never veto
     * a live generation run. Same-status calls are idempotent no-ops (no
     * write, no event) so replayed orchestrations don't spam the events spine.
     */
    async setStatus(ctx: TenantCtx, runId: string, status: FanoutRunStatus): Promise<FanoutRun> {
      if (!FANOUT_RUN_STATUSES.includes(status)) {
        throw new Error(
          `unknown fanout_run status "${status}" — expected one of: ${FANOUT_RUN_STATUSES.join(", ")}`,
        );
      }
      return db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(fanoutRuns)
          .where(and(eq(fanoutRuns.id, runId), eq(fanoutRuns.tenantId, ctx.tenantId)))
          .limit(1);
        if (!current) throw new NotFoundError("fanout_run", runId);
        if (current.status === status) return current;
        const [updated] = await tx
          .update(fanoutRuns)
          .set({ status })
          .where(and(eq(fanoutRuns.id, runId), eq(fanoutRuns.tenantId, ctx.tenantId)))
          .returning();
        await appendEvent(tx, ctx, {
          entityType: "fanout_run",
          entityId: runId,
          event: "fanout_run.status_changed",
          payload: { from: current.status, to: status },
        });
        return updated;
      });
    },

    async get(ctx: TenantCtx, id: string): Promise<FanoutRun | null> {
      const [row] = await db
        .select()
        .from(fanoutRuns)
        .where(and(eq(fanoutRuns.id, id), eq(fanoutRuns.tenantId, ctx.tenantId)))
        .limit(1);
      return row ?? null;
    },

    /** Fast-path idempotency check (mirrors sourcesRepo.getByContentHash): lets a caller skip every generation call entirely on a repeat fan-out before ever reaching the gateway. */
    async getByGenerationKey(ctx: TenantCtx, generationKey: string): Promise<FanoutRun | null> {
      const [row] = await db
        .select()
        .from(fanoutRuns)
        .where(
          and(
            eq(fanoutRuns.generationKey, generationKey),
            eq(fanoutRuns.tenantId, ctx.tenantId),
          ),
        )
        .limit(1);
      return row ?? null;
    },

    /**
     * Bulk, newest-first list for one tenant (B2.6: closes the Sprint-1
     * follow-up noted in the B1.5 handoff — apps/web previously hydrated its
     * feed via the events spine as a workaround for this not existing yet).
     */
    async list(ctx: TenantCtx, opts: { limit?: number } = {}): Promise<FanoutRun[]> {
      return db
        .select()
        .from(fanoutRuns)
        .where(eq(fanoutRuns.tenantId, ctx.tenantId))
        .orderBy(desc(fanoutRuns.createdAt))
        .limit(opts.limit ?? 50);
    },
  };
}

export type FanoutRunsRepo = ReturnType<typeof fanoutRunsRepo>;
