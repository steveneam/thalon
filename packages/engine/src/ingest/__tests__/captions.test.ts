import { describe, expect, it } from "vitest";
import {
  detectCaptionFormat,
  parseCaptions,
  parseCaptionTimestamp,
  type TimedSegment,
} from "../captions";
import { chunkTimedSegments } from "../chunk";

const SRT = [
  "1",
  "00:00:00,000 --> 00:00:04,500",
  "Welcome back to the workshop.",
  "",
  "2",
  "00:00:04,500 --> 00:00:09,000",
  "Today we repair a torn tent seam.",
  "",
].join("\n");

const VTT = [
  "WEBVTT",
  "",
  "NOTE demo file",
  "",
  "intro",
  "00:00.000 --> 00:04.500 align:start",
  "Welcome <c>back</c> to the workshop.",
  "",
  "00:04.500 --> 01:09.000",
  "Today we repair a torn tent seam.",
  "",
].join("\n");

describe("caption parsing (B2.2, pure core)", () => {
  it("detects SRT / VTT / plain text", () => {
    expect(detectCaptionFormat(SRT)).toBe("srt");
    expect(detectCaptionFormat(VTT)).toBe("vtt");
    expect(detectCaptionFormat("Just a paragraph.\n\nAnother one.")).toBe("text");
  });

  it("parses SRT cues into millisecond-timed segments", () => {
    const segments = parseCaptions(SRT);
    expect(segments).toEqual([
      { text: "Welcome back to the workshop.", startMs: 0, endMs: 4500 },
      { text: "Today we repair a torn tent seam.", startMs: 4500, endMs: 9000 },
    ]);
  });

  it("parses VTT: header/NOTE skipped, cue ids and settings tolerated, payload tags stripped, hourless timestamps", () => {
    const segments = parseCaptions(VTT);
    expect(segments).toEqual([
      { text: "Welcome back to the workshop.", startMs: 0, endMs: 4500 },
      { text: "Today we repair a torn tent seam.", startMs: 4500, endMs: 69000 },
    ]);
  });

  it("plain text becomes untimed paragraph segments", () => {
    const segments = parseCaptions("First idea spans\ntwo lines.\n\nSecond idea.", "text");
    expect(segments).toEqual([{ text: "First idea spans two lines." }, { text: "Second idea." }]);
  });

  it("parses timestamps exactly and fails loud on malformed ones", () => {
    expect(parseCaptionTimestamp("01:02:03,004")).toBe(3_723_004);
    expect(parseCaptionTimestamp("02:03.4")).toBe(123_400);
    expect(() => parseCaptionTimestamp("00:00:xx,000")).toThrow(/malformed caption timestamp/);
  });

  it("fails loud on a multi-line cue block with no timing line (lost captions), skips bare stray counters", () => {
    expect(() => parseCaptions("5\nsome caption text that would be lost", "srt")).toThrow(
      /no "-->" timing line/,
    );
    expect(parseCaptions(`${SRT}\n\n3\n`, "srt")).toHaveLength(2);
  });

  it("returns [] for empty input", () => {
    expect(parseCaptions("", "srt")).toEqual([]);
    expect(parseCaptions("   \n\n  ", "text")).toEqual([]);
  });
});

describe("chunkTimedSegments (B2.2, pure core)", () => {
  const seg = (text: string, startMs: number, endMs: number): TimedSegment => ({
    text,
    startMs,
    endMs,
  });

  it("packs consecutive segments toward targetTokens without splitting inside a segment", () => {
    const segments = [
      seg("one two three", 0, 1000),
      seg("four five", 1000, 2000),
      seg("six seven eight nine", 2000, 3000),
    ];
    const chunks = chunkTimedSegments(segments, { targetTokens: 5 });
    expect(chunks.map((c) => c.text)).toEqual([
      "one two three four five",
      "six seven eight nine",
    ]);
    expect(chunks[0]).toMatchObject({ seq: 0, startMs: 0, endMs: 2000, tokenCount: 5 });
    expect(chunks[1]).toMatchObject({ seq: 1, startMs: 2000, endMs: 3000, tokenCount: 4 });
  });

  it("keeps a single over-length segment whole — its media window stays honest", () => {
    const chunks = chunkTimedSegments([seg("a b c d e f", 0, 5000)], { targetTokens: 2 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ startMs: 0, endMs: 5000, tokenCount: 6 });
  });

  it("untimed segments produce chunks without media times", () => {
    const chunks = chunkTimedSegments([{ text: "no timings here" }]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].startMs).toBeUndefined();
    expect(chunks[0].endMs).toBeUndefined();
  });

  it("is deterministic: same segments, same chunks (hashes included)", () => {
    const segments = [seg("alpha beta", 0, 10), seg("gamma delta", 10, 20)];
    expect(chunkTimedSegments(segments, { targetTokens: 3 })).toEqual(
      chunkTimedSegments(segments, { targetTokens: 3 }),
    );
  });
});
