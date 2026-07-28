import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * THE POLISH TAIL's STYLESHEET HALF (s82, lane `editor-polish`).
 *
 * The behavioural cases live beside this in `editor-polish-s82.test.tsx`; these
 * are the findings whose whole defect was a declaration — a mark drawn in a
 * colour nobody could read, a width pinned in a rule that could not see what it
 * was pinning, an ink that flipped with the theme on a plate that does not.
 * jsdom computes no layout, so no render test can see any of them, and a
 * stylesheet assertion is the only executable form: the repo's own precedent is
 * board-css / dashboard-css / transcription-css, and this file is a fourth of
 * that kind rather than a new idea. (It is a separate file from the jsdom cases
 * for the mechanical reason that a vitest file has ONE environment, and reading
 * a file needs the node one.)
 */

const dirname = fileURLToPath(new URL(".", import.meta.url));
const EDITOR_CSS = readFileSync(path.resolve(dirname, "../editor.css"), "utf8");
const DOSSIER_CSS = readFileSync(path.resolve(dirname, "../dossier.css"), "utf8");
const THEME = readFileSync(path.resolve(dirname, "../../../theme/thalon.theme.ts"), "utf8");

describe("B10 — the block's label degrades visibly, and its proposal mark leaves the flow", () => {
  it("ellipsises the name instead of clipping it mid-token", () => {
    // `.blk` is `overflow: hidden; white-space: nowrap` with computed
    // `text-overflow: clip` — measured on the real 9-beat cut, "beat-09"
    // rendered "beat-" with no cue anything was missing. `text-overflow`
    // belongs on the text-bearing child; on the flex container it is inert.
    expect(EDITOR_CSS).toMatch(/\.editor-surface \.blk-lbl \{[^}]*text-overflow: ellipsis/);
    expect(EDITOR_CSS).toMatch(/\.editor-surface \.blk-ord \{[^}]*flex: none/);
    // Whitespace between flex items collapses, so the space either side of the
    // sheet's middot ("02 · take 1") is a gap or it is not there at all.
    expect(EDITOR_CSS).toMatch(/\.editor-surface \.blk \{[^}]*gap: 3px/);
  });

  it("positions the proposal word so a long label cannot eat it", () => {
    // Injected into the live block, the appended tag measured 0px visible — the
    // amber border was then the only channel for "the agent proposes here".
    expect(EDITOR_CSS).toMatch(/\.editor-surface \.blk \.prop-tag \{[^}]*position: absolute/);
    expect(EDITOR_CSS).toMatch(/\.editor-surface \.blk \{[^}]*position: relative/);
  });
});

describe("B2/B3 — the caption lane's two mark channels are distinct", () => {
  it("draws a proposal in warn and a judge refusal in err", () => {
    expect(EDITOR_CSS).toMatch(/\.editor-surface \.cap-mark \{[^}]*background: var\(--warn\)/);
    expect(EDITOR_CSS).toMatch(/\.editor-surface \.cap-mark\.refused \{[^}]*background: var\(--err\)/);
    expect(EDITOR_CSS).toMatch(/\.editor-surface \.blk-cap\.refused \{[^}]*border-color: var\(--err\)/);
    expect(EDITOR_CSS).toMatch(/\.editor-surface \.refused-tag \{[^}]*color: var\(--err\)/);
  });

  it("puts the plate mark out of the flow, since a 22px plate has none to spare", () => {
    expect(EDITOR_CSS).toMatch(/\.editor-surface \.cap-mark \{[^}]*position: absolute/);
    expect(EDITOR_CSS).toMatch(/\.editor-surface \.blk-cap \{[^}]*position: relative/);
  });
});

describe("B6 — the stream-copied music cue's cursor tells the truth", () => {
  it("says selectable, not draggable", () => {
    // `button.blk-music { cursor: grab }` applies to every cue, but
    // `onPointerDown` returns immediately for a copied one.
    expect(EDITOR_CSS).toMatch(/button\.blk-music.*cursor: grab/);
    expect(EDITOR_CSS).toMatch(/\.editor-surface \.blk-music\.copy \{[^}]*cursor: pointer/);
  });

  it("keeps the constraint tags off the drag surface", () => {
    expect(EDITOR_CSS).toMatch(/\.editor-surface \.blk-tags \{[^}]*pointer-events: none/);
  });
});

describe("B7 — the endcard marker stays un-hoverable, which is why its fact is text", () => {
  it("keeps pointer-events: none on the marker", () => {
    // The marker spans from its freeze boundary to the end of the lane, over
    // the beats underneath it: hoverable, it would swallow their selections and
    // drags. So the `title` could never fire, and the fix was to draw the fact.
    expect(EDITOR_CSS).toMatch(/\.editor-surface \.blk-overlay \{[^}]*pointer-events: none/);
    expect(EDITOR_CSS).toMatch(/\.editor-surface \.blk-overlay-fact \{[^}]*flex: none/);
  });
});

describe("B4 — the numfield width is scoped to the numeric case", () => {
  it("frees the two free-text fields to follow their label's flex", () => {
    // `.numfield` is a flex COLUMN, so the `flex: 1` both authors wrote grew the
    // LABEL while `width: 100px` pinned the input regardless. `Field()` renders
    // type="number" and keeps the 100px; the caption text and the
    // proposal-rejection reason (the sentence that becomes an eval row) render
    // no type and were pinned to a 100px viewport.
    expect(EDITOR_CSS).toMatch(/\.editor-surface \.numfield input \{[^}]*width: 100px/);
    expect(EDITOR_CSS).toMatch(
      /\.editor-surface \.numfield input:not\(\[type="number"\]\) \{[^}]*width: 100%/,
    );
  });
});

describe("B8 — the player plate is a fixed-register island on BOTH videos surfaces", () => {
  const RAMP = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

  /** The DARK-register value of a ramp token, from the theme of record. */
  function darkRamp(step: number): string {
    const found = new RegExp(`"--color-neutral-${step}":\\s*\\["[^"]+",\\s*"([^"]+)"\\]`).exec(
      THEME,
    );
    if (!found) throw new Error(`--color-neutral-${step} is not in the theme any more`);
    return found[1];
  }

  /**
   * The `--n-*` declarations a sheet pins on `.player`. Every `.player` block in
   * the file, merged in source order the way the cascade reads them — the sheet
   * carries the ported one-line rule as well as this pinning block, and asking
   * only the first would silently measure the wrong one.
   */
  function pinned(css: string, surface: string): Record<string, string> {
    const blocks = Array.from(
      css.matchAll(new RegExp(`\\.${surface} \\.player \\{([^}]*)\\}`, "g")),
    );
    if (blocks.length === 0) throw new Error(`${surface} has no .player rule at all`);
    const out: Record<string, string> = {};
    for (const block of blocks) {
      for (const decl of block[1].matchAll(/--(n-\d+):\s*([^;]+);/g)) out[decl[1]] = decl[2].trim();
    }
    return out;
  }

  it("pins every ink drawn on the plate to the theme's dark register", () => {
    const editor = pinned(EDITOR_CSS, "editor-surface");
    // The WHOLE ramp, not just the triangle's ink: `.btn-ghost` inside the
    // player takes its hover background from --n-200 and its border from
    // --n-400, so pinning the ink alone would swap one unreadable pair for
    // another (light text on a near-white hover).
    expect(Object.keys(editor)).toEqual(RAMP.map((step) => `n-${step}`));
    for (const step of RAMP) {
      expect(editor[`n-${step}`], `--n-${step} must be the theme's dark value`).toBe(
        darkRamp(step),
      );
    }
  });

  it("carries the byte-identical block on the dossier — the audit's own condition", () => {
    // The two videos surfaces draw the same plate, so a one-sided fix leaves
    // them disagreeing in light mode for no stated reason.
    expect(pinned(DOSSIER_CSS, "dossier-surface")).toEqual(pinned(EDITOR_CSS, "editor-surface"));
  });

  it("leaves the letterbox itself a raw non-token value on both", () => {
    // Near-black in both registers on purpose: a video letterbox is not a ramp
    // value. That is WHY the ink on it must not follow the theme.
    for (const css of [EDITOR_CSS, DOSSIER_CSS]) {
      expect(css).toContain("background: oklch(0.1 0.008 262)");
    }
  });
});
