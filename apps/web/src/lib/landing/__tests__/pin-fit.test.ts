import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canPin, PIN_MIN_HEIGHT, PIN_MIN_WIDTH } from "../pin-fit";

/**
 * THE PINNED SHEET MAY NEVER BE TALLER THAN THE VIEWPORT IT IS PINNED IN.
 *
 * s109 shipped this guard on WIDTH alone, having measured the failure on a
 * phone. s110 drove it at 950×620 — an ordinary laptop window — and found the
 * stage still pinning an 849px ledger into a 620px viewport, clipped at both
 * ends, so that the run's four readouts (including "sent unreviewed: 0", the
 * sequence-gate claim) were invisible at every one of the six chapters.
 *
 * Nothing about that looked wrong in a screenshot, and the existing suite was
 * entirely green through it, because every assertion was about WHAT the
 * instrument renders and none about WHERE it lands. That is the s108 lesson
 * (a count proves alive, not aimed) arriving one level up.
 *
 * jsdom has no layout, so this file cannot measure a real ledger. What it CAN
 * do — and what actually failed — is pin the DECISION: the predicate both the
 * component and the stylesheet obey, and the fact that they still obey the
 * same numbers. Every case below was verified in a real browser first.
 */
describe("canPin — the viewport must be able to hold the sheet", () => {
  it("refuses the s110 defect case: 950×620, wide enough but far too short", () => {
    // The measured failure. Compacted the sheet is 723px here; the viewport is
    // 620px. Before this predicate existed, `window.innerWidth > 900` said yes.
    expect(canPin(950, 620)).toBe(false);
  });

  it("refuses a phone — the s109 case, still true for the same reason", () => {
    expect(canPin(390, 844)).toBe(false);
  });

  it("refuses a wide but short window, where only the height disqualifies it", () => {
    expect(canPin(1920, 650)).toBe(false);
  });

  it("refuses a tall but narrow window, where only the width disqualifies it", () => {
    expect(canPin(1000, 1200)).toBe(false);
  });

  it("allows the laptop and desktop cases that were verified pinning cleanly", () => {
    expect(canPin(1440, 900)).toBe(true);
    expect(canPin(1920, 1080)).toBe(true);
  });

  it("allows the exact worst case it was dimensioned for: 1101×700", () => {
    // Measured in-browser: the compacted sheet is 648px at this width, so this
    // must pass with headroom rather than sit on a knife edge.
    expect(canPin(PIN_MIN_WIDTH + 1, PIN_MIN_HEIGHT)).toBe(true);
  });

  it("is exclusive on width and inclusive on height, exactly as the CSS is", () => {
    // The stylesheet unpins at `max-width: 1100px` and `max-height: 699px`, so
    // 1100 wide must fail and 1101 pass; 699 tall must fail and 700 pass.
    expect(canPin(PIN_MIN_WIDTH, 1000)).toBe(false);
    expect(canPin(PIN_MIN_WIDTH + 1, 1000)).toBe(true);
    expect(canPin(1440, PIN_MIN_HEIGHT - 1)).toBe(false);
    expect(canPin(1440, PIN_MIN_HEIGHT)).toBe(true);
  });
});

describe("the stylesheet and the predicate cannot drift apart", () => {
  const css = readFileSync(
    join(__dirname, "..", "..", "..", "components", "landing", "landing.css"),
    "utf8",
  );

  it("unpins at exactly the breakpoints the predicate refuses", () => {
    // A JS threshold that drifts from its CSS threshold shows up as "the
    // instrument reports itself live while nothing is pinned" — invisible to
    // every test that only renders markup.
    expect(css).toContain(`@media (max-width: ${PIN_MIN_WIDTH}px), (max-height: ${PIN_MIN_HEIGHT - 1}px)`);
  });

  it("compacts the sheet only inside the range that still pins", () => {
    // The compaction must not start below the pinning width, or it would
    // shrink type on narrow screens that are showing the completed run at full
    // width and have the room for it.
    expect(css).toContain(`@media (min-width: ${PIN_MIN_WIDTH + 1}px) and (max-height: 900px)`);
  });

  it("keeps the narrow-layout rules on WIDTH only", () => {
    // These collapse grids because a COLUMN is too narrow, which has nothing to
    // do with how short the window is. Folded into the pinning query, a
    // 1920×650 window would drop the pricing tiers to two columns and squash
    // the hero art to 4:3 for no reason the reader could see.
    const narrowBlock = css.slice(css.indexOf("@media (max-width: 900px)"));
    expect(narrowBlock).toContain(".lp-tiers");
    expect(narrowBlock).toContain(".lp-heroart");
    // and the pinning query must NOT carry them
    const pinBlockStart = css.indexOf(`@media (max-width: ${PIN_MIN_WIDTH}px), (max-height:`);
    const pinBlock = css.slice(pinBlockStart, css.indexOf("@media", pinBlockStart + 10));
    expect(pinBlock).not.toContain(".lp-tiers");
    expect(pinBlock).not.toContain(".lp-heroart");
  });
});

describe("the moving band does not spend a phone's data to animate a thumbnail", () => {
  const css = readFileSync(
    join(__dirname, "..", "..", "..", "components", "landing", "landing.css"),
    "utf8",
  );

  it("hides every frame after the poster on narrow screens as well as reduced motion", () => {
    // `display: none` on a `loading="lazy"` image means the browser never
    // fetches it — verified in-browser with a cache-busted probe, because the
    // whole saving rests on that being true. Measured before: 81 requests,
    // 2,712 KB, into a box 350px wide. After: one request.
    expect(css).toContain("@media (prefers-reduced-motion: reduce), (max-width: 900px)");
    const block = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce), (max-width: 900px)"));
    expect(block).toContain(".wb-band img:not(:first-of-type)");
    expect(block.slice(0, block.indexOf("}") + 200)).toContain("display: none");
  });
});
