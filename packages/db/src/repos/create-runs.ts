import {
  CREATE_RUN_STATUSES,
  createBriefSchema,
  createChildRefsSchema,
  createFamilySchema,
  createModeSchema,
  createPlanSchema,
  type CreateBriefInput,
  type CreateChildRef,
  type CreatePlanInput,
  type CreateRunStatus,
  type TenantCtx,
} from "@thalon/contracts";
import { and, desc, eq } from "drizzle-orm";
import { NotFoundError } from "../errors";
import { createRuns } from "../schema";
import type { CreateRun, Db } from "../types";
import { appendEvent } from "./events";

/**
 * s87 window (B-create.1): the Create run ledger. Every verb validates its
 * config at the write door (invalid brief/plan fails loud, nothing stores)
 * and is tenancy-walled — a foreign run answers exactly like one that never
 * existed.
 */
export function createRunsRepo(db: Db) {
  return {
    /**
     * Idempotent by generation_key — the SPINE doctrine ("run it twice, get
     * one result") with money attached: a Create run spends, so a
     * double-clicked Generate must return the FIRST run rather than start a
     * second one.
     */
    async create(
      ctx: TenantCtx,
      input: {
        family: string;
        mode: string;
        brief: CreateBriefInput;
        plan?: CreatePlanInput;
        generationKey: string;
      },
    ): Promise<CreateRun> {
      const family = createFamilySchema.parse(input.family);
      const mode = createModeSchema.parse(input.mode);
      const brief = createBriefSchema.parse(input.brief);
      // A run may exist before its plan is derived; an INVALID plan may not.
      const plan = input.plan === undefined ? {} : createPlanSchema.parse(input.plan);
      if (brief.family !== family) {
        throw new Error(
          `brief.family "${brief.family}" contradicts the run's family "${family}" — one run, one family`,
        );
      }
      return db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(createRuns)
          .values({
            tenantId: ctx.tenantId,
            family,
            mode,
            brief,
            plan,
            generationKey: input.generationKey,
          })
          .onConflictDoNothing({ target: createRuns.generationKey })
          .returning();
        if (inserted) {
          await appendEvent(tx, ctx, {
            entityType: "create_run",
            entityId: inserted.id,
            event: "create_run.created",
            payload: { family, mode, generationKey: input.generationKey },
          });
          return inserted;
        }
        const [existing] = await tx
          .select()
          .from(createRuns)
          .where(
            and(
              eq(createRuns.generationKey, input.generationKey),
              eq(createRuns.tenantId, ctx.tenantId),
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
     * THE one writer of `status`. Validates the word and audits the change,
     * but enforces NO transition graph — run status is operator telemetry,
     * never a control-flow input, so bookkeeping can never veto a live run
     * (the `fanoutRuns.setStatus` doctrine). Same-status calls are
     * idempotent no-ops so replayed orchestrations don't spam the spine.
     */
    async setStatus(ctx: TenantCtx, runId: string, status: CreateRunStatus): Promise<CreateRun> {
      if (!CREATE_RUN_STATUSES.includes(status)) {
        throw new Error(
          `unknown create_run status "${status}" — expected one of: ${CREATE_RUN_STATUSES.join(", ")}`,
        );
      }
      return db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(createRuns)
          .where(and(eq(createRuns.id, runId), eq(createRuns.tenantId, ctx.tenantId)))
          .limit(1);
        if (!current) throw new NotFoundError("create_run", runId);
        if (current.status === status) return current;
        const [updated] = await tx
          .update(createRuns)
          .set({ status })
          .where(and(eq(createRuns.id, runId), eq(createRuns.tenantId, ctx.tenantId)))
          .returning();
        await appendEvent(tx, ctx, {
          entityType: "create_run",
          entityId: runId,
          event: "create_run.status_changed",
          payload: { from: current.status, to: status },
        });
        return updated;
      });
    },

    /**
     * Record the plan once derivation has run (when the run row was opened
     * before the plan existed). Validated, audited, and deliberately NOT a
     * merge: a plan is one coherent derivation, so it is replaced whole
     * rather than patched field-by-field into a state no derivation produced.
     */
    async recordPlan(ctx: TenantCtx, runId: string, planInput: CreatePlanInput): Promise<CreateRun> {
      const plan = createPlanSchema.parse(planInput);
      return db.transaction(async (tx) => {
        const [updated] = await tx
          .update(createRuns)
          .set({ plan })
          .where(and(eq(createRuns.id, runId), eq(createRuns.tenantId, ctx.tenantId)))
          .returning();
        if (!updated) throw new NotFoundError("create_run", runId);
        await appendEvent(tx, ctx, {
          entityType: "create_run",
          entityId: runId,
          event: "create_run.plan_recorded",
          payload: { platforms: plan.platforms.map((p) => p.platform) },
        });
        return updated;
      });
    },

    /**
     * Record what the dispatch produced — the FULL child set the orchestrator
     * holds, replacing whatever was there. Replacement rather than append is
     * what makes a retried dispatch converge: re-recording the same set is a
     * no-op instead of doubling the list, and a partial run that later
     * completes states its whole truth in one write.
     *
     * A child that refused rides its verbatim `error` (spec Error Behavior:
     * one child failing is recorded, the others proceed) — a partial run is
     * a real state, so nothing here treats it as an exception.
     */
    async recordChildren(
      ctx: TenantCtx,
      runId: string,
      children: CreateChildRef[],
    ): Promise<CreateRun> {
      const parsed = createChildRefsSchema.parse(children);
      return db.transaction(async (tx) => {
        const [updated] = await tx
          .update(createRuns)
          .set({ children: parsed })
          .where(and(eq(createRuns.id, runId), eq(createRuns.tenantId, ctx.tenantId)))
          .returning();
        if (!updated) throw new NotFoundError("create_run", runId);
        await appendEvent(tx, ctx, {
          entityType: "create_run",
          entityId: runId,
          event: "create_run.children_recorded",
          payload: {
            kinds: parsed.map((c) => c.kind),
            failed: parsed.filter((c) => c.error !== undefined).length,
          },
        });
        return updated;
      });
    },

    /** Operator triage: the last irrecoverable failure on the run itself, or `null` to clear it. */
    async recordLastError(
      ctx: TenantCtx,
      runId: string,
      message: string | null,
    ): Promise<CreateRun> {
      return db.transaction(async (tx) => {
        const [updated] = await tx
          .update(createRuns)
          .set({ lastError: message })
          .where(and(eq(createRuns.id, runId), eq(createRuns.tenantId, ctx.tenantId)))
          .returning();
        if (!updated) throw new NotFoundError("create_run", runId);
        await appendEvent(tx, ctx, {
          entityType: "create_run",
          entityId: runId,
          event:
            message === null
              ? "create_run.last_error_cleared"
              : "create_run.last_error_recorded",
          payload: message === null ? {} : { message },
        });
        return updated;
      });
    },

    async get(ctx: TenantCtx, id: string): Promise<CreateRun | null> {
      const [row] = await db
        .select()
        .from(createRuns)
        .where(and(eq(createRuns.id, id), eq(createRuns.tenantId, ctx.tenantId)))
        .limit(1);
      return row ?? null;
    },

    /** Fast-path idempotency check: skip the whole dispatch (and its spend) on a repeat run. */
    async getByGenerationKey(ctx: TenantCtx, generationKey: string): Promise<CreateRun | null> {
      const [row] = await db
        .select()
        .from(createRuns)
        .where(
          and(
            eq(createRuns.generationKey, generationKey),
            eq(createRuns.tenantId, ctx.tenantId),
          ),
        )
        .limit(1);
      return row ?? null;
    },

    /** Create home's "Latest runs" and the Runs surface — newest first. */
    async list(ctx: TenantCtx, opts: { limit?: number } = {}): Promise<CreateRun[]> {
      return db
        .select()
        .from(createRuns)
        .where(eq(createRuns.tenantId, ctx.tenantId))
        .orderBy(desc(createRuns.createdAt))
        .limit(opts.limit ?? 50);
    },
  };
}

export type CreateRunsRepo = ReturnType<typeof createRunsRepo>;
