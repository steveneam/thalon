import type { TenantCtx } from "@thalon/contracts";
import { and, desc, eq } from "drizzle-orm";
import { fanoutRuns } from "../schema";
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
