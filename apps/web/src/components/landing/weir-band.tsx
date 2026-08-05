"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BRAND_SEQUENCES, sequenceFrameSrc } from "@/lib/brand-assets";

const SEQ = BRAND_SEQUENCES.weir;

/**
 * THE MOVING BAND — water held above a stone sill, and water passing over it.
 *
 * Placed AFTER the instrument, not in the hero, for two independent reasons
 * found during the build:
 *
 *  1. **A hero scrub has no scroll travel.** Above the fold there is nothing
 *     to scrub with, so the page's one moving moment would sit still exactly
 *     when the reader is looking at it.
 *  2. **The metaphor should land after the argument.** This is Whitethorn's
 *     structure exactly: six chapters measure the thing, and only then does
 *     the instrument hand off to a photograph that moves.
 *
 * ONE CLOCK, READ TWICE: this shares the page's single scroll clock with the
 * gate instrument. No timer, no autoplay, no second rAF loop — the added
 * motion spends the page's existing motion budget rather than breaking it.
 *
 * ── THE TWO RULES THAT COST SESSIONS ─────────────────────────────────────
 *
 * **Exactly one frame lit, by construction (㒒 s107, the fifth killer).** In
 * the portfolio's hand-written form this needed the `shown` index seeded from
 * the DOM, because starting at a `-1` sentinel stranded the markup's initial
 * frame lit and — the frames being absolutely stacked — it painted over every
 * frame the scroll selected. The scrub was completely dead while every still
 * screenshot looked perfect. Rendering `className` from a single piece of
 * state makes that failure unrepresentable here, which is the point of
 * porting it rather than transliterating it.
 *
 * **A count proves the scrub is ALIVE, not that it is AIMED (⑳ s108).**
 * Mapping progress across the band's full centre travel puts frames 0 and
 * last at the clamps, so half the shipped bytes are only reachable while the
 * band is mostly off-screen. Ending the sweep a sixth of a viewport early at
 * each end lands the whole walk inside the window where the band is actually
 * being looked at.
 */
export function WeirBand() {
  const [shown, setShown] = useState(0);
  const [live, setLive] = useState(false);
  const bandRef = useRef<HTMLDivElement>(null);
  const decoded = useRef<Set<number>>(new Set([0]));

  /**
   * A stacked frame that has not DECODED paints nothing, so the band would go
   * blank mid-scrub. Walk out to the nearest decoded neighbour instead.
   */
  const usable = useCallback((want: number) => {
    if (decoded.current.has(want)) return want;
    for (let d = 1; d <= SEQ.frames; d += 1) {
      if (decoded.current.has(want - d)) return want - d;
      if (decoded.current.has(want + d)) return want + d;
    }
    return 0;
  }, []);

  useEffect(() => {
    let raf = 0;

    const paint = () => {
      raf = 0;
      // Flipping `live` here rather than in the effect body keeps every
      // setState inside a rAF callback: synchronous setState in an effect
      // body cascades renders (react-hooks/set-state-in-effect), and the
      // first measurement is more honest a frame later anyway, once layout
      // has settled.
      setLive(true);
      const el = bandRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;

      // CENTRE-to-centre, with a sixth-of-a-viewport margin at each end so the
      // whole sequence is reachable while the band is ~three-quarters visible.
      const m = vh / 6;
      const span = vh - 2 * m;
      const centre = r.top + r.height / 2;
      let p = span > 0 ? (vh - m - centre) / span : 0;
      p = p < 0 ? 0 : p > 1 ? 1 : p;

      setShown(usable(Math.round(p * (SEQ.frames - 1))));
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(paint);
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [usable]);

  return (
    <section className="landing-surface" aria-labelledby="weir-heading">
      <div className="gs-wrap">
        <p className="gs-kicker">The whole idea, in one picture</p>
        <h2 className="gs-h2" id="weir-heading">
          Everything arrives. Not everything passes.
        </h2>

        <div className="wb-band" ref={bandRef}>
          {Array.from({ length: SEQ.frames }, (_, i) => (
            <img
              key={i}
              src={sequenceFrameSrc(SEQ, i)}
              width={SEQ.width}
              height={SEQ.height}
              alt={
                i === 0
                  ? "Still water held above a low stone sill at first light, with a sheet of bright water spilling over the lip onto gravel below."
                  : ""
              }
              aria-hidden={i === 0 ? undefined : true}
              // Frame 0 is the poster and paints immediately; the rest arrive
              // lazily and `usable()` holds the nearest decoded neighbour until
              // they do, so the band is never blank and never blocks paint.
              loading={i === 0 ? "eager" : "lazy"}
              decoding="async"
              className={i === shown ? "is-on" : ""}
              onLoad={() => {
                decoded.current.add(i);
              }}
            />
          ))}
          {/* Reduced motion holds frame 0 and never scrubs — the CSS below
              hides every other frame outright, so the sequence cannot move. */}
          <span className="wb-live" data-live={live ? "yes" : "no"} hidden />
        </div>

        <p className="wb-cap">
          Held water is not rejected water. A draft the gate stops goes back to you with the reason
          attached, not into a bin.
        </p>
      </div>
    </section>
  );
}
