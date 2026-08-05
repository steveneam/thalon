"use client";

import { useEffect, useRef, useState } from "react";
import { CHAPTERS, decidedAt, LEDGER, TOTALS } from "@/lib/landing/run-snapshot";

/**
 * THE GATE INSTRUMENT — the landing page's scroll spine.
 *
 * Inherited wholesale from the three A+ sites built immediately before it
 * (`proprietary/templates/sites/{whitethorn,aspect-and-fall,small-hours}`),
 * which is the entire reason the founder ordered those three first: *"so that
 * way, you have the full landing page to learn from rather than just mock."*
 *
 * The rules it carries over, each of which cost a session to learn:
 *
 * 1. **THE FILL IS THE INSTRUMENT.** A row is undecided until its gate runs.
 *    The claude-design mock shipped every verdict pre-printed and the page's
 *    whole argument was legible two chapters before the reader met the judge.
 *    The argument has to be demonstrated, the way Whitethorn's dog gets better
 *    as you scroll — never pre-printed.
 * 2. **THE CLOCK FOLLOWS THE PROSE (㉑ s105).** The stage the instrument names
 *    is the chapter the reader is ON, read off `CHAPTERS`, never a value
 *    interpolated off the scrollbar. An instrument that contradicts the
 *    sentence beside it is the one failure this kind of page cannot survive.
 * 3. **NEAREST ANCHOR, NOT LAST-PASSED (㉒ s107).** `if (centre <= line) seg = i`
 *    marks chapter N-1 active while the reader is squarely on N — a heading
 *    exactly on the line misses by a sub-pixel. The mock reproduced this
 *    exactly and it was invisible in screenshots; only counting `.on` at each
 *    chapter found it. Interpolate a continuous position, then round.
 * 4. **STATIC-FIRST IS AN HONESTY GATE, NOT A PERF GATE (㉑ s105).** With JS
 *    off, the server markup below ships the COMPLETED run — every row, its
 *    final verdict, and all four totals. `/guide` says so in writing, and
 *    every claim `/guide` makes is a claim that has to be TESTED.
 * 5. **THE READING LINE IS MEASURED FROM THE STAGE'S BOTTOM ON NARROW SCREENS**
 *    (㉑ s105, killer 4) — measured from 0 it marks a chapter active while its
 *    heading is still behind the pinned sheet.
 *
 * `live` is false until mount, so the first paint IS the static document and
 * a reader with JS disabled never sees a half-filled instrument. The stage
 * sits below the fold, so the handover is not visible in practice.
 */
export function GateInstrument() {
  const [live, setLive] = useState(false);
  const [seg, setSeg] = useState(CHAPTERS.length - 1);
  const stageRef = useRef<HTMLDivElement>(null);
  const chapRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let raf = 0;

    const readingLine = () => {
      // Wide: the middle of the viewport. Narrow: the pinned stage covers the
      // top, so the line is measured DOWN FROM the stage's bottom edge — and
      // high in the remaining band, because the anchor is a heading and its
      // paragraph needs somewhere to flow before the fold.
      if (window.innerWidth > 900) return window.innerHeight * 0.5;
      const rect = stageRef.current?.getBoundingClientRect();
      const top = Math.max(0, rect?.bottom ?? 0);
      return top + (window.innerHeight - top) * 0.3;
    };

    const tick = () => {
      raf = 0;

      /* ── NARROW SCREENS DO NOT PIN, AND THE REASON IS MEASURED ──────────
         The ledger is a table of eight claims with their reasons. On a
         390×844 phone it measured **1087px tall inside an 844px viewport** —
         243px MORE than the screen — so the sticky sheet covered everything
         and left a reading band of exactly nothing. Driven, the symptoms were
         that chapter 02 never became active at all and every other chapter's
         heading sat behind the sheet while the instrument claimed the reader
         was on it. Killer 4 (㉑ s105) with no room left to measure from.

         A pinned sheet plus scrolling prose is the wrong pattern on a phone
         regardless of the arithmetic, so the instrument stops pinning and
         shows the COMPLETED run instead. The mobile reader loses the reveal
         and keeps the whole argument — the same trade the no-JS reader
         makes, and for the same reason. */
      if (window.innerWidth <= 900) {
        setLive(false);
        return;
      }

      // Flipping `live` here rather than in the effect body keeps every
      // setState inside a rAF callback: synchronous setState in an effect
      // body cascades renders (react-hooks/set-state-in-effect), and the
      // first measurement is more honest a frame later anyway, once layout
      // has settled and the sticky column has a real rect.
      setLive(true);
      const line = readingLine();
      // Anchor on the chapter's HEADING, not its padded box: the box carries
      // deliberate empty space for scroll travel, so its centre is not where
      // the reader's eye is.
      const centres = chapRefs.current.map((el) => {
        const h = el?.querySelector("h3") ?? el;
        const r = h?.getBoundingClientRect();
        return r ? r.top + r.height / 2 : Number.POSITIVE_INFINITY;
      });

      let last = 0;
      for (let i = 0; i < centres.length; i += 1) if (centres[i] <= line) last = i;
      let k = last;
      if (last < centres.length - 1) {
        const span = centres[last + 1] - centres[last];
        if (span > 0) k = last + Math.max(0, Math.min(1, (line - centres[last]) / span));
      }
      // Rule 3: NEAREST anchor, so "highlighted chapter" and "the stage the
      // instrument names" are the same thing by construction.
      setSeg(Math.max(0, Math.min(CHAPTERS.length - 1, Math.round(k))));
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  const here = CHAPTERS[seg];

  return (
    <section className="landing-surface" aria-labelledby="run-heading">
      <div className="gs-wrap">
        <p className="gs-kicker">A real run, recorded {"·"} nothing here is a mock-up</p>
        <h2 className="gs-h2" id="run-heading">
          Watch one prompt go through the gates.
        </h2>

        <div className="gs-spine">
          {/* ── the pinned instrument ─────────────────────────────────── */}
          <div className="gs-stage" ref={stageRef}>
            <div className="gs-ledger">
              <div className="gs-cap">
                <span>
                  CLAIM LEDGER {"·"} 8 of {TOTALS.claimsJudged} claims this run judged
                </span>
                {/* The clock follows the prose: this names the chapter the
                    reader is on, and with JS off it names the last one. */}
                <span className="gs-clock">{here.stage}</span>
              </div>

              <ol className="gs-rows">
                {LEDGER.map((row) => {
                  // Static (no-JS) shows the COMPLETED run; live reveals a
                  // row's fate only once its gate has run.
                  const decided = !live || seg >= decidedAt(row);
                  return (
                    <li
                      key={row.claim}
                      className={`gs-row${decided ? ` is-${row.fate}` : " is-pending"}`}
                      data-fate={row.fate}
                      data-decided={decided ? "yes" : "no"}
                    >
                      <span className="gs-dot" aria-hidden="true" />
                      <span className="gs-claim">
                        <span className="gs-quote">{row.claim}</span>
                        <span className="gs-meta">
                          {row.format} {"·"} {row.gate}
                        </span>
                      </span>
                      <span className="gs-verdict">
                        {decided ? (
                          <>
                            <b>{row.fate === "blocked" ? "stopped" : row.fate}</b>
                            {row.reason ? <i>{row.reason}</i> : null}
                          </>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ol>

              <div className="gs-bar" aria-hidden="true">
                {CHAPTERS.map((c, i) => (
                  <i key={c.n} className={!live || seg >= i ? "is-on" : ""} />
                ))}
              </div>

              {/* The run's REAL totals. Deliberately not derived from the eight
                  rows above: the sample was chosen to show both outcomes and
                  its 4/4 split is nothing like the run's 46-in-681 rate.
                  State the bound; do not let a sample imply a rate. */}
              <dl className="gs-readouts">
                <div>
                  <dt>Claims judged</dt>
                  <dd>{TOTALS.claimsJudged}</dd>
                </div>
                <div>
                  <dt>Cleared</dt>
                  <dd>{TOTALS.claimsPassed}</dd>
                </div>
                <div>
                  <dt>Stopped</dt>
                  <dd>{TOTALS.claimsStopped}</dd>
                </div>
                <div>
                  <dt>Sent unreviewed</dt>
                  <dd>{TOTALS.sentUnreviewed}</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* ── the chapters that drive it ────────────────────────────── */}
          <div className="gs-chapters">
            {CHAPTERS.map((c, i) => (
              <div
                key={c.n}
                className={`gs-chap${!live || seg === i ? " is-on" : ""}`}
                ref={(el) => {
                  chapRefs.current[i] = el;
                }}
              >
                <p className="gs-n">
                  {c.n} {"—"} {c.stage === "—" ? "the prompt" : c.stage}
                </p>
                <h3>{c.heading}</h3>
                <p className="gs-body">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
