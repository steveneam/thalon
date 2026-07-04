import { describe, expect, it } from "vitest";
import { deriveCandidateWindows, type WaterfallChunkInput, type WindowConfig } from "../windows";

const CONFIG: WindowConfig = { minDurationMs: 1_000, maxDurationMs: 10_000, pauseGapMs: 500 };

function chunk(seq: number, text: string, startMs?: number, endMs?: number): WaterfallChunkInput {
  return { seq, text, startMs, endMs };
}

describe("deriveCandidateWindows (B2.3, pure core)", () => {
  it("is deterministic: identical chunks + config always produce identical windows", () => {
    const chunks = [
      chunk(0, "one", 0, 2_000),
      chunk(1, "two", 2_000, 4_000),
      chunk(2, "three", 4_000, 6_000),
    ];
    const first = deriveCandidateWindows(chunks, CONFIG);
    const second = deriveCandidateWindows(chunks, CONFIG);
    expect(second).toEqual(first);
    expect(first).toEqual([
      {
        startMs: 0,
        endMs: 6_000,
        durationMs: 6_000,
        chunkSeqs: [0, 1, 2],
        text: "one two three",
      },
    ]);
  });

  it("returns [] for no chunks or chunks with no timing at all", () => {
    expect(deriveCandidateWindows([], CONFIG)).toEqual([]);
    expect(
      deriveCandidateWindows([chunk(0, "untimed text, no startMs/endMs")], CONFIG),
    ).toEqual([]);
  });

  it("single chunk: one window matching the chunk's own span when it meets the minimum duration", () => {
    const windows = deriveCandidateWindows([chunk(0, "a full beat", 1_000, 3_000)], CONFIG);
    expect(windows).toEqual([
      { startMs: 1_000, endMs: 3_000, durationMs: 2_000, chunkSeqs: [0], text: "a full beat" },
    ]);
  });

  it("discards every candidate shorter than the configured minimum duration", () => {
    // Two chunks, no pause between them, total duration 800ms < minDurationMs (1000).
    const windows = deriveCandidateWindows(
      [chunk(0, "too", 0, 400), chunk(1, "short", 400, 800)],
      CONFIG,
    );
    expect(windows).toEqual([]);
  });

  it("no gaps: one continuous run is a single window when it fits within the max duration", () => {
    const windows = deriveCandidateWindows(
      [chunk(0, "a", 0, 3_000), chunk(1, "b", 3_000, 6_000), chunk(2, "c", 6_000, 9_000)],
      CONFIG,
    );
    expect(windows).toHaveLength(1);
    expect(windows[0]).toMatchObject({ startMs: 0, endMs: 9_000, durationMs: 9_000 });
  });

  it("windows clamped to max: a continuous run longer than max duration is sliced at chunk boundaries", () => {
    // Four contiguous 3s chunks, no gaps: 12s total > 10s max. Expect a clamped
    // first window (<=10s, cut at the last chunk boundary that still fits)
    // and a second window for the remainder.
    const windows = deriveCandidateWindows(
      [
        chunk(0, "a", 0, 3_000),
        chunk(1, "b", 3_000, 6_000),
        chunk(2, "c", 6_000, 9_000),
        chunk(3, "d", 9_000, 12_000),
      ],
      CONFIG,
    );
    expect(windows).toEqual([
      { startMs: 0, endMs: 9_000, durationMs: 9_000, chunkSeqs: [0, 1, 2], text: "a b c" },
      { startMs: 9_000, endMs: 12_000, durationMs: 3_000, chunkSeqs: [3], text: "d" },
    ]);
  });

  it("cuts a new window at a pause gap at least as long as the configured threshold", () => {
    const windows = deriveCandidateWindows(
      [
        chunk(0, "beat one part a", 0, 2_000),
        chunk(1, "beat one part b", 2_000, 4_000),
        // 600ms gap here >= pauseGapMs (500) — a natural boundary.
        chunk(2, "beat two", 4_600, 6_600),
      ],
      CONFIG,
    );
    expect(windows).toEqual([
      {
        startMs: 0,
        endMs: 4_000,
        durationMs: 4_000,
        chunkSeqs: [0, 1],
        text: "beat one part a beat one part b",
      },
      { startMs: 4_600, endMs: 6_600, durationMs: 2_000, chunkSeqs: [2], text: "beat two" },
    ]);
  });

  it("a gap shorter than the pause threshold does not force a cut", () => {
    const windows = deriveCandidateWindows(
      [
        chunk(0, "a", 0, 2_000),
        // 300ms gap < pauseGapMs (500) — not a natural boundary.
        chunk(1, "b", 2_300, 4_300),
      ],
      CONFIG,
    );
    expect(windows).toHaveLength(1);
    expect(windows[0]).toMatchObject({ startMs: 0, endMs: 4_300, chunkSeqs: [0, 1] });
  });

  it("ignores untimed chunks interleaved with timed ones", () => {
    const windows = deriveCandidateWindows(
      [chunk(0, "timed", 0, 2_000), chunk(1, "no timing here")],
      CONFIG,
    );
    expect(windows).toEqual([
      { startMs: 0, endMs: 2_000, durationMs: 2_000, chunkSeqs: [0], text: "timed" },
    ]);
  });
});
