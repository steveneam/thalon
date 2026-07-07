import type { Source } from "@thalon/db";
import { describe, expect, it } from "vitest";
import { ingestMeta, videoIngestInputSchema } from "../ingest";
import { toLibraryRow } from "../serialize";

const BASE: Source = {
  id: "src-1",
  tenantId: "tenant-0",
  kind: "video_transcript",
  contentHash: "hash",
  uri: "https://example.com/watch?v=abc",
  rawRef: "transcripts/hash.json",
  meta: {},
  createdAt: new Date("2026-07-07T00:00:00.000Z"),
} as Source;

describe("toLibraryRow (META-KEY MINI-CONTRACT)", () => {
  it("reads title, tags, and areaRelevance when the engine wrote them", () => {
    const row = toLibraryRow({
      ...BASE,
      meta: {
        transcriptProvider: "hosted-vendor",
        segmentCount: 244,
        title: "How the judge gate works",
        tags: ["ai", "hooks"],
        areaRelevance: [
          { areaId: "a1", areaName: "ai tooling", score: 0.82, reason: "close to area description" },
        ],
      },
    });
    expect(row.title).toBe("How the judge gate works");
    expect(row.tags).toEqual(["ai", "hooks"]);
    expect(row.areaRelevance).toEqual([
      { areaId: "a1", areaName: "ai tooling", score: 0.82, reason: "close to area description" },
    ]);
  });

  it("degrades pre-rider rows honestly: null title, no tags, no relevance — never invented", () => {
    const row = toLibraryRow({ ...BASE, meta: { transcriptProvider: "caption-file", segmentCount: 3 } });
    expect(row.title).toBeNull();
    expect(row.tags).toEqual([]);
    expect(row.areaRelevance).toEqual([]);
  });

  it("drops malformed meta values instead of surfacing them", () => {
    const row = toLibraryRow({
      ...BASE,
      meta: {
        title: "   ",
        tags: ["ok", 42, ""],
        areaRelevance: [{ areaId: "a1" }, "junk", null],
      },
    });
    expect(row.title).toBeNull();
    expect(row.tags).toEqual(["ok"]);
    expect(row.areaRelevance).toEqual([]);
  });
});

describe("ingest input tags (session-19 rider)", () => {
  it("accepts operator tags and passes them to the engine verbatim via meta", () => {
    const input = videoIngestInputSchema.parse({
      url: "https://example.com/v",
      tags: ["ai", "hooks"],
    });
    expect(ingestMeta(input)).toEqual({ tags: ["ai", "hooks"] });
  });

  it("stamps no meta when the operator set no tags", () => {
    const input = videoIngestInputSchema.parse({ url: "https://example.com/v" });
    expect(ingestMeta(input)).toBeUndefined();
    expect(ingestMeta({ ...input, tags: [] })).toBeUndefined();
  });

  it("rejects oversize tag sets and blank tags at the schema", () => {
    expect(
      videoIngestInputSchema.safeParse({
        url: "https://example.com/v",
        tags: Array.from({ length: 13 }, (_, i) => `t${i}`),
      }).success,
    ).toBe(false);
    expect(
      videoIngestInputSchema.safeParse({ url: "https://example.com/v", tags: [" "] }).success,
    ).toBe(false);
  });
});
