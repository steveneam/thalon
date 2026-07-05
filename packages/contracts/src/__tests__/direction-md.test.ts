import { describe, expect, it } from "vitest";
import { DIRECTION_MOTIONS, DIRECTION_PACINGS, DIRECTION_ASPECTS } from "../direction-doc";
import { DirectionMdParseError, parseDirectionMd, renderDirectionMd } from "../direction-md";
import { validDoc } from "./direction-fixtures";

/**
 * THE byte-identical round-trip ratchet (B5.2, amendment A11 — ratified
 * decision 2: direction.md is strict-schema markdown, never freeform).
 *
 *   renderDirectionMd(parseDirectionMd(md)) === md    byte-for-byte
 *   parseDirectionMd(renderDirectionMd(doc)) equals   doc
 *
 * The literal fixture below PINS the wire grammar: a renderer change that
 * alters even one byte fails here and is therefore a deliberate,
 * review-visible contract change — never an accident.
 */

/** The pinned wire format. Do not "tidy" this string: its bytes ARE the contract. */
const PINNED_MD = `---
doc: direction.v1
title: What the product does
aspect: 16:9
fps: 30
pacing: medium
---

## Scene 1 — Hook

- narration: The one thing to know.
- on-screen: One thing
- visual: (none)
- motion: smooth
- duration-ms: 3000

## Scene 2 — Why it matters

- narration: Because it saves the operator an hour a day.
- on-screen: (none)
- visual: A timer spinning down
- motion: snappy
- duration-ms: 4000

## CTA

Try it on your next post.
`;

describe("round-trip ratchet (byte-identical both directions)", () => {
  it("render(parse(md)) === md for the pinned fixture", () => {
    expect(renderDirectionMd(parseDirectionMd(PINNED_MD))).toBe(PINNED_MD);
  });

  it("parse(render(doc)) deep-equals doc — cta null, creative slots null", () => {
    const doc = validDoc();
    expect(parseDirectionMd(renderDirectionMd(doc))).toEqual(doc);
  });

  it("parse(render(doc)) deep-equals doc — cta present, slots filled", () => {
    const base = validDoc({ cta: "Try it today." });
    const doc = {
      ...base,
      scenes: base.scenes.map((scene) => ({
        ...scene,
        onScreenText: scene.onScreenText ?? "Overlay",
        visual: `Visual for ${scene.heading}`,
      })),
    };
    expect(parseDirectionMd(renderDirectionMd(doc))).toEqual(doc);
  });

  it("round-trips every motion, pacing, and aspect in the vocabulary", () => {
    for (const motion of DIRECTION_MOTIONS) {
      for (const pacing of DIRECTION_PACINGS) {
        for (const aspect of DIRECTION_ASPECTS) {
          const base = validDoc({ pacing, aspect });
          const doc = {
            ...base,
            scenes: base.scenes.map((scene) => ({ ...scene, motion })),
          };
          const md = renderDirectionMd(doc);
          expect(parseDirectionMd(md)).toEqual(doc);
          expect(renderDirectionMd(parseDirectionMd(md))).toBe(md);
        }
      }
    }
  });

  it("a heading containing the em-dash separator still round-trips (first separator wins)", () => {
    const base = validDoc();
    const doc = {
      ...base,
      scenes: [{ ...base.scenes[0], sceneIndex: 0, heading: "Setup — the before state" }],
    };
    const md = renderDirectionMd(doc);
    expect(parseDirectionMd(md)).toEqual(doc);
    expect(renderDirectionMd(parseDirectionMd(md))).toBe(md);
  });
});

describe("renderer is fail-loud on invalid documents", () => {
  it("refuses to render a schema-invalid doc (round-trip only holds for valid docs)", () => {
    const base = validDoc();
    expect(() =>
      renderDirectionMd({
        ...base,
        scenes: [{ ...base.scenes[0], sceneIndex: 0, narration: "two\nlines" }],
      }),
    ).toThrow();
  });
});

describe("parser is fail-loud (strict grammar, no flexibility)", () => {
  const cases: [string, (md: string) => string, RegExp][] = [
    ["CRLF anywhere", (md) => md.replace("\n---", "\r\n---"), /LF-only/],
    ["missing trailing newline", (md) => md.slice(0, -1), /exactly one trailing newline/],
    ["extra trailing newline", (md) => `${md}\n`, /exactly one trailing newline/],
    ["front-matter keys reordered", (md) => md.replace("title: What the product does\naspect: 16:9", "aspect: 16:9\ntitle: What the product does"), /expected/],
    ["unknown doc version", (md) => md.replace("doc: direction.v1", "doc: direction.v2"), /unknown doc version/],
    ["scene numbering broken", (md) => md.replace("## Scene 2 —", "## Scene 3 —"), /contiguous from 1/],
    ["bullet order changed", (md) => md.replace("- on-screen: One thing\n- visual: (none)", "- visual: (none)\n- on-screen: One thing"), /expected "- on-screen: /],
    ["missing bullet", (md) => md.replace("- motion: smooth\n", ""), /expected "- motion: /],
    ["non-integer duration", (md) => md.replace("- duration-ms: 3000", "- duration-ms: 3.5s"), /plain decimal integer/],
    ["out-of-vocabulary motion", (md) => md.replace("- motion: smooth", "- motion: explode"), /not one of smooth/],
    ["content after the CTA line", (md) => `${md}trailing\n`, /must be the last line/],
    ["blank front-matter value", (md) => md.replace("pacing: medium", "pacing: "), /expected "pacing: <value>"/],
  ];

  for (const [name, mutate, expected] of cases) {
    it(name, () => {
      expect(() => parseDirectionMd(mutate(PINNED_MD))).toThrow(expected);
      expect(() => parseDirectionMd(mutate(PINNED_MD))).toThrow(DirectionMdParseError);
    });
  }

  it("CTA before the first scene is rejected", () => {
    const md = `---
doc: direction.v1
title: T
aspect: 16:9
fps: 30
pacing: medium
---

## CTA

Buy now.
`;
    expect(() => parseDirectionMd(md)).toThrow(/cannot precede the first scene/);
  });

  it("a document with no scenes is rejected", () => {
    const md = `---
doc: direction.v1
title: T
aspect: 16:9
fps: 30
pacing: medium
---
`;
    expect(() => parseDirectionMd(md)).toThrow(/at least one scene/);
  });

  it("parse errors carry the 1-based line number", () => {
    try {
      parseDirectionMd(PINNED_MD.replace("- motion: smooth", "- motion: explode"));
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(DirectionMdParseError);
      expect((err as DirectionMdParseError).line).toBe(14);
      expect((err as DirectionMdParseError).message).toMatch(/line 14/);
    }
  });
});
