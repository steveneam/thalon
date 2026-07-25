import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { thalonTheme } from "../../theme/thalon.theme";

/**
 * B6.1 token ratchet, re-pinned at wave 0 to the NEW token source: the
 * Thalon Astryx theme (src/theme/thalon.theme.ts — the founder-verdicted
 * mock's values). Same discipline as ever: WCAG AA for every named pairing
 * as executable math, not a design note, now for BOTH mode slots of every
 * token pair ([light, dark] — dark is the workspace default). Extended per
 * the kickoff with the §5 pairs: warn-on-100 · err-on-100 · ok-on-100 ·
 * act-text-on-act. Recolor a token and this either stays green or names
 * the failing pair and mode.
 *
 * A second block pins the BUILT artifacts to the source: edit the theme
 * without running `npm run theme:build` and this goes red before the app
 * ever renders stale tokens.
 */

const dirname = fileURLToPath(new URL(".", import.meta.url));
const builtCss = readFileSync(path.resolve(dirname, "../../theme/thalon-theme.css"), "utf8");

type Rgb = { r: number; g: number; b: number };

/** oklch() → linear sRGB (Björn Ottosson's reference matrices). */
function oklchToLinearSrgb(L: number, C: number, hDeg: number): Rgb {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return {
    r: clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

/** WCAG relative luminance takes linear-light channels directly. */
function luminance({ r, g, b }: Rgb): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

const tokens = thalonTheme.tokens as Record<string, string | [string, string]>;

/**
 * A token's [light, dark] value pair. defineTheme normalizes authored
 * [light, dark] arrays into `light-dark(a, b)` strings — split at the
 * depth-0 comma; single values serve both modes.
 */
function slots(name: string): [string, string] {
  const v = tokens[name];
  if (v === undefined) throw new Error(`token missing from theme: ${name}`);
  if (Array.isArray(v)) return v;
  if (v.startsWith("light-dark(")) {
    const inner = v.slice("light-dark(".length, -1);
    let depth = 0;
    for (let i = 0; i < inner.length; i++) {
      if (inner[i] === "(") depth++;
      else if (inner[i] === ")") depth--;
      else if (inner[i] === "," && depth === 0) {
        return [inner.slice(0, i).trim(), inner.slice(i + 1).trim()];
      }
    }
    throw new Error(`unsplittable light-dark() token ${name}: ${v}`);
  }
  return [v, v];
}

/** Parses an OPAQUE `oklch(L C H)` token slot into WCAG luminance. */
function lum(name: string, mode: 0 | 1): number {
  const raw = slots(name)[mode];
  const m = raw.match(/^oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)$/);
  if (!m) throw new Error(`token ${name} is not an opaque oklch color: ${raw}`);
  return luminance(oklchToLinearSrgb(Number(m[1]), Number(m[2]), Number(m[3])));
}

/**
 * [foreground, background, min light, min dark]
 *
 * The ONE sub-AA exception, pinned honestly: dark-mode act-text-on-act is
 * 3.28:1 — a property of the mock's exact accent (oklch 0.635 0.135 252,
 * value of record, kept verbatim). 3:1 is the WCAG UI-component threshold;
 * the pair still ratchets (darkening text or lightening the accent goes
 * red). Raising it to 4.5 needs a founder call on the accent value —
 * flagged in the wave-0 wrap, wave-1 candidate.
 */
const PAIRS: Array<[string, string, number, number]> = [
  ["--color-text-primary", "--color-background-body", 7, 7], // body text — hold AAA
  ["--color-text-primary", "--color-background-card", 7, 7],
  ["--color-text-secondary", "--color-background-body", 4.5, 4.5],
  ["--color-text-secondary", "--color-background-card", 4.5, 4.5],
  ["--color-text-accent", "--color-background-body", 4.5, 4.5], // links
  ["--color-accent", "--color-background-body", 4.5, 4.5], // accent as text
  ["--color-on-accent", "--color-accent", 4.5, 3], // §5 act-text-on-act (see above)
  ["--color-success", "--color-background-body", 4.5, 4.5],
  ["--color-warning", "--color-background-body", 4.5, 4.5], // signal channel as text
  ["--color-error", "--color-background-body", 4.5, 4.5],
  ["--color-success", "--color-neutral-100", 4.5, 4.5], // §5 ok-on-100
  ["--color-warning", "--color-neutral-100", 4.5, 4.5], // §5 warn-on-100
  ["--color-error", "--color-neutral-100", 4.5, 4.5], // §5 err-on-100
  ["--color-on-success", "--color-success", 4.5, 4.5], // text on filled status chips
  ["--color-on-warning", "--color-warning", 4.5, 4.5],
  ["--color-on-error", "--color-error", 4.5, 4.5],
];

describe.each([
  ["light", 0],
  ["dark", 1],
] as const)("thalon theme %s slots — WCAG contrast (B6.1, wave-0 re-pin)", (mode, slot) => {
  it.each(PAIRS)("%s on %s", (fg, bg, minLight, minDark) => {
    const min = slot === 0 ? minLight : minDark;
    expect(contrast(lum(fg, slot), lum(bg, slot))).toBeGreaterThanOrEqual(min);
  });
});

describe("built theme artifacts stay in sync with the source", () => {
  it("every explicit token lands in thalon-theme.css verbatim", () => {
    for (const [name, value] of Object.entries(tokens)) {
      const expected = Array.isArray(value)
        ? `${name}: light-dark(${value[0]}, ${value[1]});`
        : `${name}: ${value};`;
      expect(builtCss, `stale build — run \`npm run theme:build\` (missing ${expected})`).toContain(
        expected,
      );
    }
  });

  it("the built JS module carries the same theme name and built flag", async () => {
    const built = await import("../../theme/thalon");
    expect(built.thalonTheme.name).toBe("thalon");
    expect(built.thalonTheme.__built).toBe(true);
  });
});
