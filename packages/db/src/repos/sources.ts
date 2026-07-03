import type { SourceKind, TenantCtx } from "@thalon/contracts";
import { and, eq } from "drizzle-orm";
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
  };
}

export type SourcesRepo = ReturnType<typeof sourcesRepo>;
