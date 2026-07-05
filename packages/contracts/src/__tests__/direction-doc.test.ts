import { describe, expect, it } from "vitest";
import {
  ASPECT_DIMENSIONS,
  DIRECTION_ASPECTS,
  DIRECTION_NONE_SENTINEL,
  directionDocDurationMs,
  directionDocSchema,
} from "../direction-doc";
import { validDoc } from "./direction-fixtures";

/**
 * B5.2: the direction_doc contract's own constraints — the ones that make
 * the direction.md round-trip a schema property (single-line, trimmed,
 * sentinel-reserved values; contiguous scenes) rather than renderer luck.
 */

describe("directionDocSchema", () => {
  it("parses a valid document", () => {
    const doc = validDoc();
    expect(doc.scenes).toHaveLength(2);
    expect(doc.cta).toBeNull();
  });

  it("rejects non-contiguous sceneIndex (order and gaps)", () => {
    const scenes = validDoc().scenes;
    expect(() =>
      directionDocSchema.parse({ ...validDoc(), scenes: [scenes[1], scenes[0]] }),
    ).toThrow(/contiguous/);
    expect(() =>
      directionDocSchema.parse({ ...validDoc(), scenes: [scenes[0], { ...scenes[1], sceneIndex: 5 }] }),
    ).toThrow(/contiguous/);
  });

  it("rejects multi-line and untrimmed field values (round-trip constraints)", () => {
    const base = validDoc();
    expect(() =>
      directionDocSchema.parse({
        ...base,
        scenes: [{ ...base.scenes[0], sceneIndex: 0, narration: "two\nlines" }],
      }),
    ).toThrow(/single-line/);
    expect(() => directionDocSchema.parse({ ...base, title: " padded " })).toThrow(
      /leading\/trailing whitespace/,
    );
  });

  it(`rejects the literal "${DIRECTION_NONE_SENTINEL}" as a real value — it is the null sentinel`, () => {
    const base = validDoc();
    expect(() =>
      directionDocSchema.parse({
        ...base,
        scenes: [{ ...base.scenes[0], sceneIndex: 0, onScreenText: DIRECTION_NONE_SENTINEL }],
      }),
    ).toThrow(/reserved/);
  });

  it("rejects out-of-vocabulary motion/pacing/aspect — enum slots, never freeform effect prose", () => {
    const base = validDoc();
    expect(() =>
      directionDocSchema.parse({
        ...base,
        scenes: [{ ...base.scenes[0], sceneIndex: 0, motion: "explode" }],
      }),
    ).toThrow();
    expect(() => directionDocSchema.parse({ ...base, pacing: "frantic" })).toThrow();
    expect(() => directionDocSchema.parse({ ...base, aspect: "4:3" })).toThrow();
  });
});

describe("derived values (deterministic core — computed, never stored)", () => {
  it("directionDocDurationMs is the sum of scene durations", () => {
    expect(directionDocDurationMs(validDoc())).toBe(7000);
  });

  it("every aspect has compile-time dimensions", () => {
    for (const aspect of DIRECTION_ASPECTS) {
      const { width, height } = ASPECT_DIMENSIONS[aspect];
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
    }
    expect(ASPECT_DIMENSIONS["16:9"]).toEqual({ width: 1920, height: 1080 });
    expect(ASPECT_DIMENSIONS["9:16"]).toEqual({ width: 1080, height: 1920 });
    expect(ASPECT_DIMENSIONS["1:1"]).toEqual({ width: 1080, height: 1080 });
  });
});
