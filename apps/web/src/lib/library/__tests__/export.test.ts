import { describe, expect, it } from "vitest";
import { formatTimecode, hasTimings, toCsv, toPlainText, toSrt } from "../export";
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
