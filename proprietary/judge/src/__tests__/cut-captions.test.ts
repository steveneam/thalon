import { describe, expect, it } from "vitest";
import { edlSchema, type EdlInput } from "@thalon/contracts";
import { CUT_CAPTION_GATE, cutTextLayers, runCutCaptionGate } from "../cut-captions";

/**
 * B-ve.4 (ADR 0010): the cut-caption judge lens — every text layer of a
 * cut's EDL passes G1 before the approve door opens. Deterministic, zero
 * model calls, refusals verbatim per line.
 */

function edlWith(lines: Array<{ text: string }>): ReturnType<typeof edlSchema.parse> {
  const input: EdlInput = {
    name: "gate-fixture",
    output: { width: 1280, height: 720, fps: 24, duration: 10 },
    video: [{ name: "b1", source: { kind: "take", ref: "clip.mp4" }, duration: 10 }],
    ...(lines.length > 0
      ? {
          captions: {
            style: { pointsize: 40 },
            lines: lines.map((l, i) => ({ text: l.text, x: 640, y: 600, fadeIn: i, fadeOut: i + 2 })),
          },
        }
      : {}),
  };
  return edlSchema.parse(input);
}

describe("cut-caption judge gate (B-ve.4)", () => {
  it("gate name is pinned — the approve receipt says what vouched", () => {
    expect(CUT_CAPTION_GATE).toBe("g1-captions");
  });

  it("passes clean captions and reports how many layers it examined", () => {
    const result = runCutCaptionGate(edlWith([{ text: "always watching" }, { text: "carried home" }]), [
      "guaranteed returns",
    ]);
    expect(result).toEqual({ verdict: "pass", lines: 2, failures: [] });
  });

  it("a caption-less cut passes trivially with lines: 0", () => {
    const result = runCutCaptionGate(edlWith([]), ["guaranteed returns"]);
    expect(result).toEqual({ verdict: "pass", lines: 0, failures: [] });
    expect(cutTextLayers(edlWith([]))).toEqual([]);
  });

  it("fails verbatim per line: the operator reads which line matched which term where", () => {
    const result = runCutCaptionGate(
      edlWith([
        { text: "always watching" },
        { text: "guaranteed returns, every time" },
        { text: "Guaranteed Returns again" },
      ]),
      ["guaranteed returns"],
    );
    expect(result.verdict).toBe("fail");
    expect(result.lines).toBe(3);
    expect(result.failures).toHaveLength(2);
    expect(result.failures[0]).toEqual({
      line: 1,
      text: "guaranteed returns, every time",
      matches: ['matched "guaranteed returns" at index 0'],
    });
    // Case-insensitive, same as every G1 surface.
    expect(result.failures[1].line).toBe(2);
  });

  it("an empty denylist always passes (no per-tenant rules configured yet)", () => {
    const result = runCutCaptionGate(edlWith([{ text: "anything at all" }]), []);
    expect(result.verdict).toBe("pass");
  });
});
