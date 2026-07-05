import { directionDocSchema, type DirectionDoc } from "@thalon/contracts";
import { describe, expect, it } from "vitest";
import { parseCaptions } from "../../ingest/captions";
import { derivedCueDurationMs } from "../../render/srt";
import {
  deriveDirectionExport,
  deriveDirectionTimeline,
  directionDocToSrt,
} from "../export";

/**
 * B5.2: export is DETERMINISTIC CORE, never a prompt. Same doc, same bytes.
 * These tests pin the timeline rules (contiguous scenes, derived CTA cue),
 * the compile-time dimensions, and the SRT convention — including the
 * round-trip through the B2.2 caption-file ingest, the same born-accurate
 * property the pillar SRT proved.
 */

function doc(overrides: Partial<DirectionDoc> = {}): DirectionDoc {
  return directionDocSchema.parse({
    docVersion: "direction.v1",
    title: "What the product does",
    aspect: "9:16",
    fps: 30,
    pacing: "medium",
    scenes: [
      {
        sceneIndex: 0,
        heading: "Hook",
        narration: "The one thing to know.",
        onScreenText: "One thing",
        visual: "Dashboard close-up",
        motion: "smooth",
        durationMs: 3000,
      },
      {
        sceneIndex: 1,
        heading: "Why it matters",
        narration: "Because it saves the operator an hour a day.",
        onScreenText: null,
        visual: null,
        motion: "snappy",
        durationMs: 4000,
      },
    ],
    cta: null,
    ...overrides,
  });
}

describe("deriveDirectionTimeline", () => {
  it("scenes are contiguous from 0 with authored durations, fields carried verbatim", () => {
    const timeline = deriveDirectionTimeline(doc());
    expect(timeline.cues.map((c) => [c.startMs, c.endMs])).toEqual([
      [0, 3000],
      [3000, 7000],
    ]);
    expect(timeline.totalDurationMs).toBe(7000);
    expect(timeline.cues[0]).toMatchObject({
      kind: "scene",
      sceneIndex: 0,
      heading: "Hook",
      text: "The one thing to know.",
      onScreenText: "One thing",
      visual: "Dashboard close-up",
      motion: "smooth",
    });
  });

  it("a CTA becomes one trailing cue with a DERIVED duration; no CTA, no cue", () => {
    const cta = "Try it on your next post.";
    const withCta = deriveDirectionTimeline(doc({ cta }));
    const ctaCue = withCta.cues.at(-1);
    expect(ctaCue).toMatchObject({ kind: "cta", sceneIndex: null, text: cta, startMs: 7000 });
    expect(ctaCue!.endMs - ctaCue!.startMs).toBe(derivedCueDurationMs(cta));
    expect(withCta.totalDurationMs).toBe(7000 + derivedCueDurationMs(cta));
    expect(deriveDirectionTimeline(doc()).cues.every((c) => c.kind === "scene")).toBe(true);
  });
});

describe("deriveDirectionExport", () => {
  it("bakes compile-time dimensions from the aspect and carries fps/pacing/title", () => {
    const out = deriveDirectionExport(doc());
    expect(out).toMatchObject({
      docVersion: "direction.v1",
      title: "What the product does",
      width: 1080,
      height: 1920,
      fps: 30,
      pacing: "medium",
    });
    expect(deriveDirectionExport(doc({ aspect: "16:9" }))).toMatchObject({
      width: 1920,
      height: 1080,
    });
  });

  it("is deterministic: same doc, same export", () => {
    expect(deriveDirectionExport(doc())).toEqual(deriveDirectionExport(doc()));
  });

  it("refuses an invalid doc loudly", () => {
    const bad = { ...doc(), fps: 0 };
    expect(() => deriveDirectionExport(bad)).toThrow();
  });
});

describe("direction SRT (the platform-upload caption artifact)", () => {
  it("pins the SRT bytes for the fixture", () => {
    expect(directionDocToSrt(doc())).toBe(
      [
        "1",
        "00:00:00,000 --> 00:00:03,000",
        "The one thing to know.",
        "",
        "2",
        "00:00:03,000 --> 00:00:07,000",
        "Because it saves the operator an hour a day.",
        "",
      ].join("\n"),
    );
  });

  it("round-trips through the B2.2 caption-file ingest unchanged (born-accurate timestamps)", () => {
    const withCta = doc({ cta: "Try it on your next post." });
    const segments = parseCaptions(directionDocToSrt(withCta), "srt");
    const timeline = deriveDirectionTimeline(withCta);
    expect(segments.map((s) => s.text)).toEqual(timeline.cues.map((c) => c.text));
    expect(segments.map((s) => [s.startMs, s.endMs])).toEqual(
      timeline.cues.map((c) => [c.startMs, c.endMs]),
    );
  });
});
