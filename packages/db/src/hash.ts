import { createHash } from "node:crypto";

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

/** JSON with recursively sorted object keys — the same value always hashes the same, whatever property order the caller used. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, sortKeys(v)]),
    );
  }
  return value;
}

/** llm_cache key: identical generations skip the gateway (SPINE §2.5). */
export function llmCacheKey(parts: {
  promptVersion: string;
  model: string;
  params: unknown;
  inputHash: string;
}): string {
  return sha256Hex(stableStringify(parts));
}

/** retrieval_cache key. */
export function retrievalCacheKey(parts: {
  sourceSetHash: string;
  queryHash: string;
}): string {
  return sha256Hex(stableStringify(parts));
}
