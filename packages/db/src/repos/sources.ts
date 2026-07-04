import type { SourceKind, TenantCtx } from "@thalon/contracts";
import { and, eq, inArray } from "drizzle-orm";
import { sources } from "../schema";
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
