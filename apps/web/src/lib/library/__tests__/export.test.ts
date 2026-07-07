import { describe, expect, it } from "vitest";
import {
  EXPORT_BUILDERS,
  formatTimecode,
  hasTimings,
  toCsv,
  toMarkdownBrief,
  toParagraphs,
  toPlainText,
  toSrt,
} from "../export";
import type { WireSegment } from "../types";

const TIMED: WireSegment[] = [
  { startMs: 37, endMs: 1_357, text: '- "McKinsey is dead."' },
  { startMs: 1_357, endMs: 3_307, text: "It has, um, commas, and \"quotes\"." },
  { startMs: 3_661_000, endMs: 3_662_500, text: "past the hour mark" },
];

const UNTIMED: WireSegment[] = [{ text: "one" }, { text: "two" }];

describe("transcript export builders", () => {
  it("formats timecodes with hour rollover and both separators", () => {
    expect(formatTimecode(0)).toBe("00:00:00.000");
    expect(formatTimecode(3_661_042)).toBe("01:01:01.042");
    expect(formatTimecode(1_357, ",")).toBe("00:00:01,357");
  });

  it("hasTimings is true only when EVERY segment is timed — one untimed row disarms timed exports", () => {
    expect(hasTimings(TIMED)).toBe(true);
    expect(hasTimings(UNTIMED)).toBe(false);
    expect(hasTimings([...TIMED, { text: "no cue" }])).toBe(false);
    expect(hasTimings([])).toBe(false);
  });

  it("plain text flows segments into one paragraph with collapsed whitespace", () => {
    expect(toPlainText([{ text: "a  b" }, { text: " c" }])).toBe("a b c\n");
  });

  it("breaks paragraphs on a speech gap > 2s (Deliverable D merge rule)", () => {
    const paragraphs = toParagraphs([
      { startMs: 0, endMs: 1_000, text: "before the pause." },
      { startMs: 3_500, endMs: 4_500, text: "after the pause." },
    ]);
    expect(paragraphs).toEqual([
      { startMs: 0, text: "before the pause." },
      { startMs: 3_500, text: "after the pause." },
    ]);
    // …and .txt renders them as blank-line-separated paragraphs, no stamps.
    expect(
      toPlainText([
        { startMs: 0, endMs: 1_000, text: "before the pause." },
        { startMs: 3_500, endMs: 4_500, text: "after the pause." },
      ]),
    ).toBe("before the pause.\n\nafter the pause.\n");
  });

  it("past the ~75s window it breaks at the next sentence boundary; at ~90s it breaks regardless", () => {
    // Six 20s sentences back-to-back: span hits 80s after four → sentence break.
    const sentences: WireSegment[] = Array.from({ length: 6 }, (_, i) => ({
      startMs: i * 20_000,
      endMs: (i + 1) * 20_000,
      text: `Sentence ${i}.`,
    }));
    const soft = toParagraphs(sentences);
    expect(soft.map((p) => p.startMs)).toEqual([0, 80_000]);

    // Four 30s run-ons with no sentence end anywhere: hard break at 90s.
    const runOns: WireSegment[] = Array.from({ length: 4 }, (_, i) => ({
      startMs: i * 30_000,
      endMs: (i + 1) * 30_000,
      text: "and then and then",
    }));
    expect(toParagraphs(runOns).map((p) => p.startMs)).toEqual([0, 90_000]);
  });

  it("untimed ingests paragraph on character windows and never carry a stamp", () => {
    const long = "x".repeat(199) + ".";
    const paragraphs = toParagraphs([{ text: long }, { text: long }, { text: long }, { text: "tail." }]);
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[1].text).toBe("tail.");
    for (const p of paragraphs) expect(p.startMs).toBeUndefined();
  });

  it("builds the .md AI brief: title-first header, honest fact list, one sparse stamp per paragraph", () => {
    const brief = toMarkdownBrief(TIMED, {
      title: "How the judge gate works",
      uri: "https://youtube.com/watch?v=abc",
      tags: ["ai", "hooks"],
      createdAt: "2026-07-07T09:30:00.000Z",
    });
    expect(brief).toMatch(/^# How the judge gate works\n/);
    expect(brief).toContain("- Source: https://youtube.com/watch?v=abc");
    expect(brief).toContain("- Duration: 1:01:02"); // last cue end 3_662_500ms
    expect(brief).toContain("- Segments: 3");
    expect(brief).toContain("- Ingested: 2026-07-07");
    expect(brief).toContain("- Tags: ai, hooks");
    expect(brief).toContain("## Transcript");
    // TIMED merges into two paragraphs (the hour-mark jump is a gap break):
    // exactly one stamp each, sparse — not one per cue.
    expect(brief.match(/\[\d+:?\d*:\d{2}\]/g)).toEqual(["[00:00]", "[1:01:01]"]);
  });

  it("degrades the brief honestly: no title → URL heads it; untimed → no duration, no stamps", () => {
    expect(toMarkdownBrief(TIMED, { uri: "https://example.com/v" })).toMatch(
      /^# https:\/\/example\.com\/v\n/,
    );
    const untimed = toMarkdownBrief(UNTIMED);
    expect(untimed).toMatch(/^# Transcript\n/);
    expect(untimed).not.toContain("- Duration:");
    expect(untimed).not.toContain("[00:");
  });

  it("registers .md as an untimed-safe builder so plain-text ingests still export the brief", () => {
    expect(EXPORT_BUILDERS.md.timed).toBe(false);
    expect(EXPORT_BUILDERS.md.mime).toBe("text/markdown");
    // Key order drives the button row — the AI brief leads.
    expect(Object.keys(EXPORT_BUILDERS)[0]).toBe("md");
  });

  it("CSV quotes embedded quotes/commas per RFC 4180 and carries both ms and timecode columns", () => {
    const lines = toCsv(TIMED).trimEnd().split("\n");
    expect(lines[0]).toBe("start_ms,end_ms,start,end,text");
    expect(lines[1]).toBe('37,1357,00:00:00.037,00:00:01.357,"- ""McKinsey is dead."""');
    expect(lines[2]).toContain('"It has, um, commas, and ""quotes""."');
  });

  it("SRT numbers cues from 1 with comma millisecond separators", () => {
    const srt = toSrt(TIMED.slice(0, 2));
    expect(srt).toBe(
      '1\n00:00:00,037 --> 00:00:01,357\n- "McKinsey is dead."\n' +
        "\n" +
        '2\n00:00:01,357 --> 00:00:03,307\nIt has, um, commas, and "quotes".\n' +
        "\n",
    );
  });
});
