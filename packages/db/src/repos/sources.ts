import type { SourceKind, TenantCtx } from "@thalon/contracts";
import { and, count, eq, inArray } from "drizzle-orm";
import { InvalidStateError, NotFoundError } from "../errors";
import { drafts, fanoutRuns, sourceChunks, sourceMetrics, sources } from "../schema";
import { appendEvent } from "./events";
import type { Db, Source } from "../types";

export function sourcesRepo(db: Db) {
  return {
    async create(
      ctx: TenantCtx,
      input: {
        kind: SourceKind;
        contentHash: string;
        uri?: string;
        rawRef?: string;
        meta?: Record<string, unknown>;
      },
    ): Promise<Source> {
      const [row] = await db
        .insert(sources)
        .values({
          tenantId: ctx.tenantId,
          kind: input.kind,
          uri: input.uri,
          rawRef: input.rawRef,
          contentHash: input.contentHash,
          meta: input.meta ?? {},
        })
        .returning();
      return row;
    },

    async get(ctx: TenantCtx, id: string): Promise<Source | null> {
      const [row] = await db
        .select()
        .from(sources)
        .where(and(eq(sources.id, id), eq(sources.tenantId, ctx.tenantId)))
        .limit(1);
      return row ?? null;
    },

    /** Fast-path idempotency check (B1.1): lets a caller skip extraction/chunking/embedding entirely on a repeat ingest before ever reaching the gateway. */
    async getByContentHash(ctx: TenantCtx, contentHash: string): Promise<Source | null> {
      const [row] = await db
        .select()
        .from(sources)
        .where(and(eq(sources.tenantId, ctx.tenantId), eq(sources.contentHash, contentHash)))
        .limit(1);
      return row ?? null;
    },

    /** B4.6: tenant-scoped enumeration for the object-store orphan sweep (collects every `raw_ref` still referenced by a source row). */
    async list(ctx: TenantCtx): Promise<Source[]> {
      return db.select().from(sources).where(eq(sources.tenantId, ctx.tenantId));
    },

    /**
     * Library delete (founder direction, session 39): removes a source and
     * its chunks/metrics in one transaction, with a `source.deleted` audit
     * row (I4). A source any fan-out run or draft grounds on is REFUSED —
     * deleting it would orphan the provenance/evidence trail, so the honest
     * answer is "this transcript is in use", never a silent cascade. The
     * object-store `raw_ref` is left for the B4.6 orphan sweep.
     */
    async remove(ctx: TenantCtx, id: string): Promise<void> {
      await db.transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(sources)
          .where(and(eq(sources.id, id), eq(sources.tenantId, ctx.tenantId)))
          .limit(1);
        if (!row) throw new NotFoundError("source", id);
        const [{ value: runRefs }] = await tx
          .select({ value: count() })
          .from(fanoutRuns)
          .where(and(eq(fanoutRuns.tenantId, ctx.tenantId), eq(fanoutRuns.sourceId, id)));
        const [{ value: draftRefs }] = await tx
          .select({ value: count() })
          .from(drafts)
          .where(and(eq(drafts.tenantId, ctx.tenantId), eq(drafts.sourceId, id)));
        if (runRefs > 0 || draftRefs > 0) {
          throw new InvalidStateError(
            `This source grounds ${draftRefs} draft${draftRefs === 1 ? "" : "s"} across ${runRefs} run${runRefs === 1 ? "" : "s"} — it can't be deleted while that provenance exists.`,
          );
        }
        await tx
          .delete(sourceChunks)
          .where(and(eq(sourceChunks.tenantId, ctx.tenantId), eq(sourceChunks.sourceId, id)));
        await tx
          .delete(sourceMetrics)
          .where(and(eq(sourceMetrics.tenantId, ctx.tenantId), eq(sourceMetrics.sourceId, id)));
        await tx.delete(sources).where(and(eq(sources.id, id), eq(sources.tenantId, ctx.tenantId)));
        await appendEvent(tx, ctx, {
          entityType: "source",
          entityId: id,
          event: "source.deleted",
          payload: { kind: row.kind, uri: row.uri },
          actor: "operator",
        });
      });
    },

    /** B2.4: scopes exemplar retrieval to ONLY the tenant's sources of these kinds (e.g. exemplar/voice_sample) — never a fan-out's own pillar source. */
    async listByKind(ctx: TenantCtx, kinds: SourceKind[]): Promise<Source[]> {
      if (kinds.length === 0) return [];
      return db
        .select()
        .from(sources)
        .where(and(eq(sources.tenantId, ctx.tenantId), inArray(sources.kind, kinds)));
    },
  };
}

export type SourcesRepo = ReturnType<typeof sourcesRepo>;
