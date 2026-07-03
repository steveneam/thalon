import { describe, expect, it } from "vitest";
import { chunkText, DEFAULT_CHUNK_CONFIG } from "../chunk";

describe("chunkText (pure core fn, deterministic)", () => {
  it("is deterministic: identical input always produces identical output", () => {
    const text = Array.from({ length: 1200 }, (_, i) => `word${i}`).join(" ");
    expect(chunkText(text)).toEqual(chunkText(text));
  });

  it("splits into sequential chunks around the target token size", () => {
    const text = Array.from({ length: 1200 }, (_, i) => `word${i}`).join(" ");
    const chunks = chunkText(text, { targetTokens: 500 });
    expect(chunks.map((c) => c.seq)).toEqual([0, 1, 2]);
    expect(chunks[0].tokenCount).toBe(500);
    expect(chunks[1].tokenCount).toBe(500);
    expect(chunks[2].tokenCount).toBe(200);
  });

  it("assigns a stable per-chunk content hash derived from the chunk text", () => {
    const chunks = chunkText("alpha beta gamma", { targetTokens: 2 });
    expect(chunks).toHaveLength(2);
    expect(chunks[0].text).toBe("alpha beta");
    expect(chunks[1].text).toBe("gamma");
    expect(chunks[0].contentHash).toHaveLength(64);
    expect(chunks[0].contentHash).not.toBe(chunks[1].contentHash);
  });

  it("returns no chunks for empty/whitespace-only text", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\t  ")).toEqual([]);
  });

  it("uses a ~500-token default when no config is passed", () => {
    expect(DEFAULT_CHUNK_CONFIG.targetTokens).toBe(500);
  });
});
