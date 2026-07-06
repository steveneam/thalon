import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * B6.1 token ratchet: "WCAG AA contrast for amber-on-dark text pairings"
 * (docs/FRONTEND.md §1) as executable math, not a design note. Parses the
 * oklch tokens straight out of globals.css and re-derives the WCAG 2.x
 * contrast ratio — recolor a token and this either stays green or names the
 * failing pair.
 */

const dirname = fileURLToPath(new URL(".", import.meta.url));
const css = readFileSync(path.resolve(dirname, "../../app/globals.css"), "utf8");

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

/** Pulls `--name: oklch(L C H)` tokens out of one selector block. */
function tokensOf(selector: string): Map<string, number> {
  const block = css.match(new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([^}]+)\\}`));
  if (!block) throw new Error(`selector ${selector} not found in globals.css`);
  const out = new Map<string, number>();
  for (const m of block[1].matchAll(/--([\w-]+):\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/g)) {
    out.set(m[1], luminance(oklchToLinearSrgb(Number(m[2]), Number(m[3]), Number(m[4]))));
  }
  return out;
}

/** [foreground token, background token, minimum ratio] */
const PAIRS: Array<[string, string, number]> = [
  ["foreground", "background", 7], // body text — hold AAA
  ["primary", "background", 4.5], // the amber pairing the spec names
  ["muted-foreground", "background", 4.5],
  ["primary-foreground", "primary", 4.5], // text on amber CTAs
  ["accent-foreground", "accent", 4.5],
  ["secondary-foreground", "secondary", 4.5],
  ["card-foreground", "card", 7],
];

describe.each([":root", ".dark"])("design tokens %s — WCAG AA (B6.1)", (selector) => {
  const tokens = tokensOf(selector);

  it.each(PAIRS)("%s on %s ≥ %s:1", (fg, bg, min) => {
    const f = tokens.get(fg);
    const b = tokens.get(bg);
    if (f === undefined || b === undefined) throw new Error(`token missing: ${fg} or ${bg}`);
    expect(contrast(f, b)).toBeGreaterThanOrEqual(min);
  });
});
