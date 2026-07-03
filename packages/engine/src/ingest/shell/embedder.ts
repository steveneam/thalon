import { createHash } from "node:crypto";
import { embedMany } from "ai";
import { getGateway } from "@thalon/platform";
import { embedShellOutputSchema, type EmbedShellOutput } from "../schemas";

/**
 * The embedding shell (SPINE §1: shell is read-only). This module only ever
 * RETURNS candidate vectors — it never imports @thalon/db and never writes
 * anywhere; the core caller (../embed.ts) validates the output against
 * embedShellOutputSchema and is the one that persists it.
 */
export interface EmbeddingDriver {
  readonly model: string;
  embed(texts: string[]): Promise<EmbedShellOutput>;
}

/**
 * Real driver: routes through this project's OWN gateway wiring
 * (@thalon/platform getGateway) via `ai`'s textEmbeddingModel/embedMany.
 * Never called by tests (ground rule: keyless + networkless) — only reached
 * when a caller doesn't inject a driver and AI_GATEWAY_API_KEY is set.
 */
export function createGatewayEmbeddingDriver(model: string): EmbeddingDriver {
  return {
    model,
    async embed(texts) {
      const gateway = getGateway();
      const { embeddings, usage } = await embedMany({
        model: gateway.textEmbeddingModel(model),
        values: texts,
      });
      return embedShellOutputSchema.parse({
        vectors: embeddings,
        model,
        tokensIn: usage.tokens,
        tokensOut: 0,
      });
    },
  };
}

function hashToUnitVector(seed: string, dims: number): number[] {
  const vector: number[] = [];
  let block = createHash("sha256").update(seed).digest();
  while (vector.length < dims) {
    for (let i = 0; i + 4 <= block.length && vector.length < dims; i += 4) {
      vector.push(block.readUInt32BE(i) / 0xffffffff - 0.5);
    }
    block = createHash("sha256").update(block).digest();
  }
  return vector;
}

/**
 * Deterministic fake for tests: identical text -> identical fixed-dimension
 * vector, always. No network, no AI_GATEWAY_API_KEY required — this is what
 * keeps every ingest test keyless and networkless.
 */
export function createFakeEmbeddingDriver(dims = 1536): EmbeddingDriver {
  return {
    model: "fake/hash-embedding-v1",
    async embed(texts) {
      return embedShellOutputSchema.parse({
        vectors: texts.map((t) => hashToUnitVector(t, dims)),
        model: "fake/hash-embedding-v1",
        tokensIn: texts.reduce((sum, t) => sum + t.split(/\s+/).filter(Boolean).length, 0),
        tokensOut: 0,
      });
    },
  };
}
