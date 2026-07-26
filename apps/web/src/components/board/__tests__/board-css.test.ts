import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * THE COLUMN TAKES THE HEIGHT IT HAS (s77 finding, board.css:135) — pinned as a
 * stylesheet assertion because it is a pure CSS fix and jsdom computes no
 * layout, so no render test can see it.
 *
 * `.col-bd` was capped at a 620px CONSTANT. Measured live at the sheet's own
 * 1440×940 during the s78 verify pass: the `.cols` region is 798px tall, so
 * every bounded column stopped 136px short of the space it had, the page did
 * not scroll to absorb it, and a four-card Intel column (each card carrying a
 * 54px thumb, 644px total) had its last card clipped inside a scroller that did
 * not need to exist. Same defect class as s77's proven `.pick-rows` bounded at
 * 176px while holding 307px.
 *
 * The rule this pins is the general one, not the number: a column body is
 * bounded by its CONTAINER, never by a magic constant. A future max-height in
 * px on this class fails here with the reason attached.
 */
const dirname = fileURLToPath(new URL(".", import.meta.url));
const BOARD_CSS = path.resolve(dirname, "../board.css");

/** Declaration blocks whose selector mentions the given class, comments stripped. */
function blocksFor(css: string, className: string): string[] {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const blocks: string[] = [];
  for (const match of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (match[1].includes(className)) blocks.push(match[2]);
  }
  return blocks;
}

describe("board.css — the column body is bounded by its container (s77 · board.css:135)", () => {
  const css = readFileSync(BOARD_CSS, "utf8");

  it("no pixel max-height caps the column body", () => {
    const declarations = blocksFor(css, ".col-bd").join(";");
    expect(declarations).not.toMatch(/max-height\s*:\s*\d/);
  });

  it("the body is a shrinkable flex child that scrolls, so a long column still bounds itself", () => {
    const declarations = blocksFor(css, ".col-bd").join(";");
    expect(declarations).toMatch(/flex\s*:\s*1/);
    expect(declarations).toMatch(/min-height\s*:\s*0/);
    expect(declarations).toMatch(/overflow-y\s*:\s*auto/);
  });

  it("the column itself is capped by its grid row, never by a constant", () => {
    const declarations = blocksFor(css, ".col ").concat(blocksFor(css, ".col{")).join(";");
    expect(declarations).toMatch(/max-height\s*:\s*100%/);
  });

  /**
   * MERGE-GATE CATCH (s78). The cap above shipped and did NOTHING, because
   * `.cols` had auto rows: a grid row sized by its tallest item makes
   * `max-height: 100%` resolve to the column's own height — circular. Measured
   * live at 1440×940 on merged main: the 25-card Waiting column reached 1078px
   * inside a 798px region, `.col-bd` never scrolled (scrollHeight ===
   * clientHeight), and the whole surface scrolled instead — taking every
   * column HEADER off screen on a kanban. Reachable, but not the fix's own
   * stated behaviour.
   *
   * The two rules are a PAIR: the cap is meaningless without a definite row,
   * so the row is pinned here beside it. Neither jsdom nor the stylesheet
   * assertion above could see this — only measuring the rendered surface did,
   * which is the gate's whole purpose.
   */
  it("the grid gives that row a definite height, or the cap above is circular", () => {
    const declarations = blocksFor(css, ".cols").join(";");
    expect(declarations).toMatch(/grid-template-rows\s*:\s*minmax\(\s*0\s*,\s*1fr\s*\)/);
  });

  it("short columns still hug their content, exactly as the sheet draws them", () => {
    const declarations = blocksFor(css, ".cols").join(";");
    expect(declarations).toMatch(/align-items\s*:\s*start/);
  });
});
