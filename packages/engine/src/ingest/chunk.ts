import { sha256Hex } from "@thalon/db";
import type { TimedSegment } from "./captions";

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

export interface TimedTextChunk extends TextChunk {
  /** Media time of the chunk's first/last timed segment; absent when the source carries no timings. */
  startMs?: number;
  endMs?: number;
}

/**
 * B2.2: pure core chunking for time-coded sources. Segments are the atomic
 * unit — a chunk is a run of consecutive segments, never a split inside one,
 * so every chunk's [startMs, endMs] window is honest media time (the anchor
 * B2.3 clip plans ground to). Greedy packing toward `targetTokens`; a single
 * over-length segment stays whole. Same input, same chunks — no I/O, no
 * clock, no randomness.
 */
export function chunkTimedSegments(
  segments: TimedSegment[],
  config: ChunkConfig = DEFAULT_CHUNK_CONFIG,
): TimedTextChunk[] {
  const target = Math.max(1, Math.floor(config.targetTokens));
  const chunks: TimedTextChunk[] = [];
  let group: TimedSegment[] = [];
  let groupTokens = 0;

  const flush = () => {
    if (group.length === 0) return;
    const body = group
      .map((s) => s.text.trim())
      .filter(Boolean)
      .join(" ");
    if (!body) {
      group = [];
      groupTokens = 0;
      return;
    }
    const timed = group.filter((s) => s.startMs !== undefined || s.endMs !== undefined);
    chunks.push({
      seq: chunks.length,
      text: body,
      tokenCount: body.split(/\s+/).filter(Boolean).length,
      contentHash: sha256Hex(body),
      startMs: timed[0]?.startMs,
      endMs: timed.at(-1)?.endMs,
    });
    group = [];
    groupTokens = 0;
  };

  for (const segment of segments) {
    const tokens = segment.text.split(/\s+/).filter(Boolean).length;
    if (tokens === 0) continue;
    if (group.length > 0 && groupTokens + tokens > target) flush();
    group.push(segment);
    groupTokens += tokens;
  }
  flush();
  return chunks;
}
