import { sha256Hex } from "@thalon/db";

/**
 * Chunking config, passed explicitly — no hidden state (SPINE §1: state
 * lives in the core). `targetTokens` is approximated as whitespace-delimited
 * words: deterministic and dependency-free. Swapping in a real tokenizer
 * later is a config/driver change, not a rewrite of this function.
 */
export interface ChunkConfig {
  targetTokens: number;
}

export const DEFAULT_CHUNK_CONFIG: ChunkConfig = { targetTokens: 500 };

export interface TextChunk {
  seq: number;
  text: string;
  tokenCount: number;
  contentHash: string;
}

/**
 * Pure core fn (SPINE §1 doctrine): given the same text and config, always
 * the same sequential chunks. No I/O, no clock, no randomness.
 */
export function chunkText(
  text: string,
  config: ChunkConfig = DEFAULT_CHUNK_CONFIG,
): TextChunk[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const target = Math.max(1, Math.floor(config.targetTokens));
  const chunks: TextChunk[] = [];
  for (let start = 0, seq = 0; start < words.length; start += target, seq += 1) {
    const slice = words.slice(start, start + target);
    const body = slice.join(" ");
    chunks.push({
      seq,
      text: body,
      tokenCount: slice.length,
      contentHash: sha256Hex(body),
    });
  }
  return chunks;
}
