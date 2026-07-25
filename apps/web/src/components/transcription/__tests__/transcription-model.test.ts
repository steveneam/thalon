import { describe, expect, it } from "vitest";
import {
  dayStamp,
  parseTags,
  sourceFacts,
  sourceLead,
  topRelevance,
  transcriptStamp,
  webOrigin,
} from "@/components/transcription/transcription-model";
import type { LibrarySourceRow } from "@/lib/library/types";

function row(overrides: Partial<LibrarySourceRow> = {}): LibrarySourceRow {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    uri: "https://youtube.com/watch?v=abc",
    title: null,
    thumbnailUrl: null,
    tags: [],
    areaRelevance: [],
    provider: null,
    segmentCount: null,
    createdAt: "2026-07-25T09:00:00.000Z",
    ...overrides,
  };
}

describe("parseTags", () => {
  it("splits on commas, trims, dedupes, and caps at the schema's 12", () => {
    expect(parseTags(" ai,  hooks , ai ,")).toEqual(["ai", "hooks"]);
    expect(parseTags("")).toEqual([]);
    expect(parseTags(Array.from({ length: 20 }, (_, i) => `t${i}`).join(","))).toHaveLength(12);
  });
});

describe("shelf-row facts (only what the ingest recorded)", () => {
  it("leads with the oEmbed title, degrades to the URL on a pre-rider row", () => {
    expect(sourceLead(row({ title: "How the judge gate works" }))).toBe("How the judge gate works");
    expect(sourceLead(row())).toBe("https://youtube.com/watch?v=abc");
    expect(sourceLead(row({ uri: null }))).toBe("11111111-1111-1111-1111-111111111111");
  });

  it("states segments, provider and tags — and never invents 'grounds N drafts'", () => {
    expect(sourceFacts(row({ segmentCount: 84, provider: "hosted-vendor", tags: ["ai", "hooks"] })))
      .toBe("Video · 84 segments · hosted-vendor · ai, hooks");
    // Pre-rider row: nothing recorded, nothing claimed.
    expect(sourceFacts(row())).toBe("Video");
    expect(sourceFacts(row({ segmentCount: 1 }))).toBe("Video · 1 segment");
  });

  it("carries the engine's top-scored area with its reason, or nothing at all", () => {
    expect(
      topRelevance(
        row({
          areaRelevance: [
            { areaId: "a1", areaName: "ai tooling", score: 0.42, reason: "loose match" },
            { areaId: "a2", areaName: "video craft", score: 0.81, reason: "close to the area" },
          ],
        }),
      ),
    ).toEqual({ area: "video craft", reason: "close to the area" });
    expect(topRelevance(row())).toBeNull();
  });

  it("only web origins get a way back — a local media path is identity, not a link", () => {
    expect(webOrigin("https://youtube.com/watch?v=abc")).toBe("https://youtube.com/watch?v=abc");
    expect(webOrigin("/media/local-clip.mp4")).toBeNull();
    expect(webOrigin(null)).toBeNull();
  });
});

describe("stamps", () => {
  const now = new Date("2026-07-25T12:00:00.000Z");

  it("uses the sheet's day grammar: today · a weekday inside the week · a date beyond it", () => {
    expect(dayStamp("2026-07-25T09:00:00.000Z", now)).toBe("today");
    expect(dayStamp("2026-07-21T09:00:00.000Z", now)).toBe("Tue");
    expect(dayStamp("2026-07-18T09:00:00.000Z", now)).toBe("18 Jul");
  });

  it("stamps a transcript with its segment count, and its run time only when timed", () => {
    expect(
      transcriptStamp([
        { text: "one", startMs: 0, endMs: 1_500 },
        { text: "two", startMs: 1_500, endMs: 762_000 },
      ]),
    ).toBe("2 segments · 00:12:42");
    // Plain-text ingest: no timings, so no invented duration.
    expect(transcriptStamp([{ text: "one" }])).toBe("1 segment");
    expect(transcriptStamp([])).toBe("0 segments");
  });
});
