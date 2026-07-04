import type { SourceKind, TenantCtx } from "@thalon/contracts";
import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { sourceChunks, sources } from "../schema";
import type { Db, Source, SourceChunk } from "../types";
import { appendEvent } from "./events";

export interface IngestChunkInput {
  seq: number;
  text: string;
  tokenCount: number;
  contentHash: string;
  embedding?: number[];
  /** B2.2 time-coded sources: milliseconds into the media; omit for untimed text. */
  startMs?: number;
  endMs?: number;
}

export interface IngestSourceInput {
  kind: SourceKind;
  contentHash: string;
  uri?: string;
  rawRef?: string;
  /** B2.2: defaults to "text"; the B3.7 visual tier supplies "visual" + visualRef. */
  modality?: string;
  visualRef?: string;
  meta?: Record<string, unknown>;
  chunks: IngestChunkInput[];
}

export interface IngestSourceResult {
  source: Source;
  chunks: SourceChunk[];
  created: boolean;
}

export interface TopKInput {
  sourceIds: string[];
  queryEmbedding: number[];
  k: number;
}

export interface TopKRow {
  chunkId: string;
  sourceId: string;
  seq: number;
  text: string;
  score: number;
}

function vectorLiteral(embedding: number[]): string {
  const parts = embedding.map((n) => {
    if (!Number.isFinite(n)) {
      throw new Error("embedding vector must contain only finite numbers");
    }
    return n;
  });
  return `[${parts.join(",")}]`;
}

/**
 * The grounding index's writer (B1.1). `ingest` is idempotent on
 * content_hash inside ONE transaction — the engine's fast-path check
 * (sourcesRepo.getByContentHash) avoids wasted embedding calls, but this is
 * the safety net that actually guarantees "run it twice, get one result"
 * (SPINE §1).
 */
export function sourceChunksRepo(db: Db) {
  return {
    async listBySource(ctx: TenantCtx, sourceId: string): Promise<SourceChunk[]> {
      return db
        .select()
        .from(sourceChunks)
        .where(and(eq(sourceChunks.tenantId, ctx.tenantId), eq(sourceChunks.sourceId, sourceId)))
        .orderBy(asc(sourceChunks.seq));
    },

    async ingest(ctx: TenantCtx, input: IngestSourceInput): Promise<IngestSourceResult> {
      return db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(sources)
          .where(
            and(eq(sources.tenantId, ctx.tenantId), eq(sources.contentHash, input.contentHash)),
          )
          .limit(1);
        if (existing) {
          const chunks = await tx
            .select()
            .from(sourceChunks)
            .where(
              and(
                eq(sourceChunks.tenantId, ctx.tenantId),
                eq(sourceChunks.sourceId, existing.id),
              ),
            )
            .orderBy(asc(sourceChunks.seq));
          return { source: existing, chunks, created: false };
        }

        const [source] = await tx
          .insert(sources)
          .values({
            tenantId: ctx.tenantId,
            kind: input.kind,
            uri: input.uri,
            rawRef: input.rawRef,
            modality: input.modality ?? "text",
            visualRef: input.visualRef,
            contentHash: input.contentHash,
            meta: input.meta ?? {},
          })
          .returning();

        const chunkRows = input.chunks.length
          ? await tx
              .insert(sourceChunks)
              .values(
                input.chunks.map((chunk) => ({
                  tenantId: ctx.tenantId,
                  sourceId: source.id,
                  seq: chunk.seq,
                  text: chunk.text,
                  startMs: chunk.startMs,
                  endMs: chunk.endMs,
                  tokenCount: chunk.tokenCount,
                  contentHash: chunk.contentHash,
                  embedding: chunk.embedding,
                })),
              )
              .returning()
          : [];

        await appendEvent(tx, ctx, {
          entityType: "source",
          entityId: source.id,
          event: "source.ingested",
          payload: { kind: input.kind, chunkCount: chunkRows.length },
        });

        return { source, chunks: chunkRows, created: true };
      });
    },

    /**
     * The grounding retrieval helper the judge lane consumes (SPINE §2.7:
     * materialized at ingest, never re-embedded per judge call). Cosine
     * distance via the same HNSW index the schema already declares.
     */
    async topKBySimilarity(ctx: TenantCtx, input: TopKInput): Promise<TopKRow[]> {
      if (input.sourceIds.length === 0) return [];
      const distance = sql<number>`${sourceChunks.embedding} <=> ${sql.raw(
        `'${vectorLiteral(input.queryEmbedding)}'::vector`,
      )}`;
      const rows = await db
        .select({
          chunkId: sourceChunks.id,
          sourceId: sourceChunks.sourceId,
          seq: sourceChunks.seq,
          text: sourceChunks.text,
          distance,
        })
        .from(sourceChunks)
        .where(
          and(
            eq(sourceChunks.tenantId, ctx.tenantId),
            inArray(sourceChunks.sourceId, input.sourceIds),
            isNotNull(sourceChunks.embedding),
          ),
        )
        .orderBy(distance)
        .limit(input.k);
      return rows.map((row) => ({
        chunkId: row.chunkId,
        sourceId: row.sourceId,
        seq: row.seq,
        text: row.text,
        score: 1 - Number(row.distance),
      }));
    },
  };
}

export type SourceChunksRepo = ReturnType<typeof sourceChunksRepo>;
