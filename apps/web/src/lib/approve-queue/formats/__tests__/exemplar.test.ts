import { describe, expect, it } from "vitest";
import { EXEMPLAR_OVERLAP_GATE, parseExemplarIds } from "../exemplar";

describe("parseExemplarIds", () => {
  it("parses a valid exemplarIds meta shape", () => {
    const ids = [{ sourceId: "src-1", chunkId: "chunk-1" }];
    expect(parseExemplarIds({ exemplarIds: ids })).toEqual(ids);
  });

  it("returns null when exemplarIds is absent (a plain, non-exemplar-aware run)", () => {
    expect(parseExemplarIds({})).toBeNull();
  });

  it("returns null when exemplarIds is an empty array", () => {
    expect(parseExemplarIds({ exemplarIds: [] })).toBeNull();
  });

  it("returns null for a different format's meta", () => {
    expect(parseExemplarIds({ hook: "x" })).toBeNull();
  });
});

describe("EXEMPLAR_OVERLAP_GATE", () => {
  it("mirrors packages/engine/src/exemplar/overlap-gate.ts's constant", () => {
    expect(EXEMPLAR_OVERLAP_GATE).toBe("exemplar_overlap");
  });
});
