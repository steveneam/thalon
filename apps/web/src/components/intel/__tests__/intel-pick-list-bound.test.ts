import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * s100 gate (render blocker) — THE PICK LIST IS BOUNDED BY ITS CONTRACT, NOT
 * BY A GUESSED PIXEL HEIGHT.
 *
 * History, because this bug came back once already and the second visit is
 * what makes it worth a test:
 *
 *  - s77: `.pick-rows` was clamped at 176px holding 307px of content, so a
 *    normal dossier scrolled inside the card. The founder saw it ("the side
 *    scroll is also in the way").
 *  - The fix raised the clamp to 420px, "measured against the structural
 *    maximum: 4 titles + 3 angles". That maximum was never checked against
 *    the generator's contract — which allows FIVE titles.
 *  - s100: live content measured 522px in the 420px box. The eighth option
 *    was sliced through the middle of its sentence, radio and copy button
 *    with it, and the HOOK label painted over the cut. Same bug, one option
 *    further along.
 *
 * A guessed bound cannot be ratcheted; the RELATIONSHIP it should have rested
 * on can — and that relationship spans two packages, so this test reads both
 * files rather than importing across the boundary (the schema is deliberately
 * not part of the engine's public API, and widening it for a test would be
 * the wrong coupling). What it pins: the generator's contract caps the list,
 * which is exactly why the surface needs no scroll container. If either half
 * stops being true, this fails.
 */

const WEB_INTEL_CSS = path.join(import.meta.dirname, "..", "intel.css");
const DOSSIER_SCHEMA = path.join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "..",
  "..",
  "..",
  "packages",
  "engine",
  "src",
  "trend",
  "dossier-schemas.ts",
);

const css = readFileSync(WEB_INTEL_CSS, "utf8");
const schema = readFileSync(DOSSIER_SCHEMA, "utf8");

/** The `.pick-rows` block's body, or "" when the rule no longer exists. */
function pickRowsRule(): string {
  const match = /\.intel-surface \.pick-rows\s*\{([^}]*)\}/.exec(css);
  return match ? match[1] : "";
}

describe("the dossier pick list — bounded by contract, never by a guessed height", () => {
  it("the generator's contract still caps titles and angles at a small, finite number", () => {
    // The caps the no-scroll decision rests on, read off the contract itself.
    // A change here is not wrong — but it MUST come back to this file and to
    // the CSS comment, which is the whole point of pinning it.
    expect(schema).toMatch(/titles:\s*z\s*\.array\([^)]*\)[\s\S]{0,40}?\.min\(3\)\.max\(5\)/);
    expect(schema).toMatch(/angles:\s*z\s*\.array\([^)]*\)[\s\S]{0,40}?\.min\(2\)\.max\(3\)/);
  });

  it("the real maximum is EIGHT options — one more than the 420px clamp was measured against", () => {
    // The ARRAY's cap, not the string-length cap nested inside it: the line
    // reads `titles: z.array(z.string()…max(200)).min(3).max(5)`, so the FIRST
    // `.max(` on the line is 200. Taking the last one is the only reading that
    // survives the nesting — misreading exactly this is how the 420px clamp
    // came to be measured against a maximum that did not exist.
    const lastMaxOnLine = (field: string): number => {
      const line = schema.split("\n").find((l) => l.trim().startsWith(`${field}:`)) ?? "";
      const all = [...line.matchAll(/\.max\((\d+)\)/g)];
      return Number(all.at(-1)?.[1]);
    };
    const titlesMax = lastMaxOnLine("titles");
    const anglesMax = lastMaxOnLine("angles");
    expect(titlesMax).toBe(5);
    expect(anglesMax).toBe(3);
    // The arithmetic the s77 comment got wrong, stated so it cannot be
    // re-guessed: 4 + 3 = 7 was the premise; the contract says 8.
    expect(titlesMax + anglesMax).toBe(8);
  });

  it("`.pick-rows` carries no height clamp and no scroll container", () => {
    const rule = pickRowsRule();
    // Deleting the rule entirely is the current, correct state; if it ever
    // comes back it must not re-introduce the clip. The sheet's "Ready to
    // create" grows to its content and so does ours.
    expect(rule).not.toMatch(/max-height/);
    expect(rule).not.toMatch(/overflow-y\s*:\s*(auto|scroll)/);
    expect(rule).not.toMatch(/overflow\s*:\s*(auto|scroll|hidden)/);
  });

  it("the reasoning is written down where the next person would reach for a clamp", () => {
    // A documentary ratchet is the weakest kind, so it is held in place by the
    // executable ones above rather than trusted alone — but the comment is
    // what stops the guess being made a third time.
    expect(css).toMatch(/NO bound, because the CONTRACT is the bound/);
  });
});
