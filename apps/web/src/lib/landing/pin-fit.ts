/**
 * WHEN THE GATE INSTRUMENT IS ALLOWED TO PIN — and why this is a module.
 *
 * ── THE DEFECT THIS EXISTS TO KILL (s110, pass 3) ────────────────────────
 * s109 found the instrument broken on a phone: a 1087px ledger pinned inside
 * an 844px viewport left a reading band of nothing. It fixed that by refusing
 * to pin below 900px **of WIDTH** — and that is the wrong axis. The ledger
 * overflowing its viewport is a HEIGHT problem, and width was only ever a
 * proxy for it.
 *
 * Driven at **950 × 620** — an ordinary laptop window — the stage still pinned
 * an 849px ledger into a 620px viewport. `.gs-stage` is `height: 100vh` with
 * `align-items: center`, so an over-tall ledger is clipped at BOTH ends, and
 * the measured result was that the reader never saw, at any of the six
 * chapters:
 *
 *   - the caption stating the sample bound ("8 of 681 claims this run judged"),
 *   - the progress bar,
 *   - **the four readouts** — 681 judged / 635 cleared / 46 stopped /
 *     **sent unreviewed 0**.
 *
 * Those readouts are the page's actual argument. The sample of eight is
 * explicitly NOT a rate (see `run-snapshot.ts`), and the totals are what stop
 * it being read as one; "sent unreviewed: 0" is the sequence-gate claim. A
 * viewport that silently eats them leaves the page making a weaker and less
 * honest case than the one it was built to make — and nothing about it looks
 * wrong in a screenshot, which is the s106–s109 lesson yet again.
 *
 * ── WHY A THRESHOLD AND NOT A LIVE MEASUREMENT ───────────────────────────
 * The obvious fix — measure the ledger, unpin if it does not fit — OSCILLATES.
 * Unpinning collapses the spine to one column, which makes the ledger wider,
 * which makes it shorter, which makes it fit, which re-pins it. So the
 * decision is taken from the VIEWPORT alone, which no layout of ours can
 * change, and the ledger is compacted at short heights (see `landing.css`) so
 * that the threshold can sit low enough to keep the reveal on real laptops.
 *
 * The numbers below are MEASURED in a real browser, not guessed. The ledger
 * is TALLEST at the narrow end of the pinned range, because the stage column
 * is narrowest there and every claim wraps to more lines — so the narrow edge
 * is the case the thresholds have to survive:
 *
 * | stage width at | ledger, s109 | ledger, compacted |
 * |----------------|--------------|-------------------|
 * | 901px          | 868px        | 723px             |
 * | 1101px         | —            | 648px             |
 * | 1280px+        | 777px        | 592px             |
 *
 * ── WHY THE WIDTH FLOOR MOVED 900 → 1100 ─────────────────────────────────
 * Compaction alone was not enough: at 901px the compacted sheet is still
 * 723px, so honouring it would have forced a height floor of ~745px and cost
 * the reveal on every wide-but-short laptop, where the ledger is only 592px
 * and fits comfortably. Raising the width floor instead fixes both ends, and
 * it is the better layout call anyway — at 901px the CHAPTER column is 300px
 * wide, which is cramped prose next to a sheet. Two columns now appear only
 * where there is genuinely room for two columns.
 *
 * At the new worst case (1101×700) the sheet is 648px, leaving 52px of
 * headroom; at 1440×700 it is 592px.
 *
 * ── THE RATCHET ──────────────────────────────────────────────────────────
 * `gate-instrument.tsx` and `landing.css` must agree about when pinning
 * happens; a JS breakpoint that drifts from its CSS breakpoint is exactly the
 * kind of defect that shows up as "the instrument says it is live but nothing
 * is pinned". Both read the constants below, and `pin-fit.test.ts` asserts
 * the stylesheet's media queries still carry the same numbers.
 */

/**
 * Below this WIDTH the spine is single-column prose and never pins. Raised
 * from s109's 900 because at 901px the sheet is 723px even compacted, and the
 * chapter column beside it is only 300px.
 */
export const PIN_MIN_WIDTH = 1100;

/**
 * Below this HEIGHT the compacted ledger cannot fit the viewport, so the
 * instrument shows its completed state instead of clipping its own totals.
 * Verified by measurement at 1101px wide — the tallest-ledger pinned width.
 */
export const PIN_MIN_HEIGHT = 700;

/**
 * Whether the gate instrument may pin at this viewport.
 *
 * The reader who fails this test loses the scroll reveal and keeps the whole
 * argument — the same trade the no-JS reader and the phone reader already
 * make, and for the same reason.
 */
export function canPin(viewportWidth: number, viewportHeight: number): boolean {
  return viewportWidth > PIN_MIN_WIDTH && viewportHeight >= PIN_MIN_HEIGHT;
}
