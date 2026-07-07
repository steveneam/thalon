import type { TenantCtx } from "@thalon/contracts";
import { sha256Hex, type Repos } from "@thalon/db";
import { getObjectStore, getTracer, modelTiers, type ObjectStore, type Tracer } from "@thalon/platform";
import { cosineSimilarity } from "../trend/ranker";
import { embedChunks } from "./embed";
import { createGatewayEmbeddingDriver, type EmbeddingDriver } from "./shell/embedder";

/**
 * B6.6 rider (session-19 Library UX mini-contract): relevance of an
 * ingested source to the tenant's ACTIVE monitored areas —
 * `meta.areaRelevance: {areaId, areaName, score, reason}[]`. The B6.4
 * ranker's embedding path, reused not reinvented: area descriptions embed
 * through the EXISTING metered embedChunks choke point (content-addressed
 * cache — an unchanged description is a cache hit after its first sweep,
 * never fresh spend; NO new gateway call-site), the source is represented
 * by the CENTROID of its already-computed chunk vectors, and the score is
 * the ranker's cosine→[0,1] relevance with its reason grammar preserved
 * verbatim. Honest degrades: no active areas, or a source with no
 * embeddings, yields `undefined` — the key is simply absent, like every
 * pre-rider row.
 */

export interface AreaRelevance {
  areaId: string;
  areaName: string;
  /** The ranker's relevance signal: embedding cosine vs the area description, mapped to [0,1]. */
  score: number;
  /** One line in the B6.4 ranker's reason grammar — the operator sees WHY. */
  reason: string;
}

export interface AreaRelevanceInput {
  /** The source's chunk embedding vectors, already computed at ingest. */
  vectors: readonly (readonly number[])[];
  capTokens: number;
}

export interface AreaRelevanceDeps {
  embedder?: EmbeddingDriver;
  tracer?: Tracer;
  objectStore?: ObjectStore;
}

/** Same rounding the ranker applies (its helpers are module-private; the grammar parity is test-pinned). */
const round2 = (n: number): number => Math.round(n * 100) / 100;
const round4 = (n: number): number => Math.round(n * 10_000) / 10_000;

/** Per-dimension mean of the chunk vectors — one deterministic vector for the whole source. */
export function centroid(vectors: readonly (readonly number[])[]): number[] {
  const dims = vectors[0].length;
  const sum = new Array<number>(dims).fill(0);
  for (const vector of vectors) {
    for (let i = 0; i < dims; i++) sum[i] += vector[i];
  }
  return sum.map((v) => v / vectors.length);
}

export async function scoreAreaRelevance(
  ctx: TenantCtx,
  repos: Repos,
  input: AreaRelevanceInput,
  deps: AreaRelevanceDeps = {},
): Promise<AreaRelevance[] | undefined> {
  if (input.vectors.length === 0) return undefined;
  const areas = await repos.monitoredAreas.list(ctx, { status: "active" });
  if (areas.length === 0) return undefined;

  // One embed call through the EXISTING ingest choke point (budget checked,
  // usage recorded, content-addressed cache) — the same chunk shape the
  // B6.4 intake builds for its area descriptions, so the cache keys match.
  const chunks = areas.map((area, seq) => ({
    seq,
    text: area.description,
    tokenCount: area.description.split(/\s+/).filter(Boolean).length,
    contentHash: sha256Hex(area.description),
  }));
  const model = modelTiers().embedding;
  const embedded = await embedChunks(
    ctx,
    repos,
    { chunks, model, capTokens: input.capTokens },
    {
      driver: deps.embedder ?? createGatewayEmbeddingDriver(model),
      tracer: deps.tracer ?? getTracer(),
      objectStore: deps.objectStore ?? getObjectStore(),
    },
  );

  const sourceVector = centroid(input.vectors);
  return areas
    .map((area, i) => {
      const cosine = cosineSimilarity(sourceVector, embedded[i].embedding);
      const score = round4((cosine + 1) / 2);
      return {
        areaId: area.id,
        areaName: area.name,
        score,
        reason: `relevance ${round2(score)} to area "${area.name}" (embedding cosine ${round2(cosine)})`,
      };
    })
    .sort((a, b) => b.score - a.score || (a.areaId < b.areaId ? -1 : a.areaId > b.areaId ? 1 : 0));
}
