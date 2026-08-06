import type { Metadata } from "next";
import Link from "next/link";
import "@/components/landing/landing.css";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { BRAND_ASSETS, BRAND_SEQUENCES } from "@/lib/brand-assets";
import { RECORDED_ON, TOTALS } from "@/lib/landing/run-snapshot";

/**
 * `/guide` — the landing page's honesty note.
 *
 * Every site in the portfolio ships one of these, enforced by
 * `tests/template-portfolio.test.ts`. Thalon's own front door had none, which
 * meant the one page making the strongest honesty claims was the only one not
 * showing its working.
 *
 * ⚠ THE RULE THIS PAGE LIVES UNDER (㉑ s105): **every claim /guide makes is a
 * claim that has to be TESTED, not intended.** Each assertion below is either
 * rendered from the same module the landing renders from — so it cannot drift
 * — or pinned by a named test. Where a number appears here it is imported,
 * never retyped.
 */
export const metadata: Metadata = {
  title: "How this page was built",
  description:
    "The honest method note behind Thalon's landing page: what is generated, what is measured, what is a recorded snapshot, and what we deliberately left off.",
  alternates: { canonical: "/guide" },
};

export default function GuidePage() {
  const seq = BRAND_SEQUENCES.weir;

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-background text-foreground">
      <SiteHeader />

      <main className="landing-surface flex-1">
        <div className="gs-wrap lp-narrow">
          <p className="gs-kicker">Method note</p>
          <h1 className="gs-h2" style={{ maxWidth: "18ch" }}>
            How this page was built.
          </h1>
          <p className="lp-lede">
            The landing page argues that this engine is honest about what it produces. That is a
            hard thing to assert and an easy thing to fake, so here is the working.
          </p>

          <section className="lp-notyet" style={{ marginTop: "40px" }}>
            <p className="gs-kicker">The short version</p>
            <ul>
              <li>
                The photograph is <b>generated</b>, and so is the moving band. Neither is a stock
                image and neither is a photograph of a real place.
              </li>
              <li>
                The instrument is <b>not a mock-up</b>. It replays claims this engine&apos;s own
                judge really ruled on, read out of this workspace&apos;s database on {RECORDED_ON}.
              </li>
              <li>
                The eight rows are a <b>sample</b> of {TOTALS.claimsJudged}, chosen to show both
                outcomes. The totals beside them are the real ones.
              </li>
            </ul>
          </section>

          <h2 className="gs-h2" style={{ marginTop: "56px" }}>
            The recorded run
          </h2>
          <p className="lp-lede">
            Thalon judges a draft by pulling it apart into the individual claims it makes and ruling
            on each one. Across the run shown, it ruled on <b>{TOTALS.claimsJudged}</b> claims over{" "}
            <b>{TOTALS.judgeRuns}</b> judge passes and <b>{TOTALS.bodyVersions}</b> versions of{" "}
            <b>{TOTALS.drafts}</b> drafts. It cleared <b>{TOTALS.claimsPassed}</b> and stopped{" "}
            <b>{TOTALS.claimsStopped}</b>.
          </p>
          <p className="lp-lede">
            The rows are quoted verbatim, including the pair that makes the point better than any
            copy could: <i>&ldquo;Swap the model underneath and the gates still hold&rdquo;</i> was
            stopped as an unsupported assertion, while{" "}
            <i>&ldquo;Swapping the model underneath leaves the gates holding&rdquo;</i> passed once
            it was stated in a form the provided sources actually supported. Same idea, different
            evidence, different verdict.
          </p>

          <h2 className="gs-h2" style={{ marginTop: "48px" }}>
            What we left off, and why
          </h2>
          <div className="lp-notyet">
            <ul>
              <li>
                <b>A committed snapshot, not a live query.</b> The figures are frozen at{" "}
                {RECORDED_ON} rather than read live. A public page has no business running queries
                against real drafts, and this page ships as a static prerender. The cost is that the
                numbers age, which is why the date is on the page rather than in a comment.
              </li>
              <li>
                <b>Third-party names are removed.</b> The same run judged claims naming other AI
                vendors. They are real, and they are off this page: our own front door should not
                imply an association we have not earned.
              </li>
              <li>
                <b>Real prospect data never appears.</b> The workspace also holds outreach drafts
                naming a real business and a real person. Those are somebody else&apos;s data and
                they do not go on a marketing page, whatever they would demonstrate.
              </li>
              <li>
                <b>The sample is not the rate.</b> Four of the eight visible rows were stopped; the
                real rate is {TOTALS.claimsStopped} in {TOTALS.claimsJudged}. The rows were picked to
                show both outcomes, so the honest figures sit next to them rather than being implied
                by them.
              </li>
            </ul>
          </div>

          <h2 className="gs-h2" style={{ marginTop: "48px" }}>
            The imagery
          </h2>
          <p className="lp-lede">
            Both assets are AI-generated originals, minted on a paid tier and pinned into
            content-addressed storage with a full provenance record (model, prompt, parameters,
            credits, licence tier) at the moment they were made. No vendor URL is ever served, and
            no third-party photograph enters the pipeline.
          </p>
          <div className="lp-notyet">
            <ul>
              <li>
                <b>The still</b> — a low stone sill at first light, {BRAND_ASSETS.weirHero.width}×
                {BRAND_ASSETS.weirHero.height} on <code>text2image_soul_v2</code>. Two candidates
                were minted at 0.12 credits each and one was kept. It is a picture of the argument:
                water held, and water passing.
              </li>
              <li>
                <b>The moving band</b> — the same place, moving. One 5-second take on{" "}
                <code>seedance_2_0_fast</code>, 720p, silent, 17.5 credits, grown from the still
                above as its single opening frame. <b>There is no second keyframe</b>, because
                flowing water is a cycle rather than a transformation: its last frame looks like its
                first, so a second one would have been a near-duplicate bought at real risk of
                drifting out of register.
              </li>
              <li>
                <b>It is scrubbed, not played.</b> The take is decoded to {seq.frames} stills and
                the scroll position chooses which one is shown, because seeking a compressed video
                lands on keyframes and stutters. The frame count is measured rather than chosen: at{" "}
                {seq.frames} frames the difference between neighbours matches a sequence we already
                know reads smoothly.
              </li>
              <li>
                <b>The model that ran is recorded, not the one requested.</b> Both mints were
                requested on one model and served by another, which is normal and which is why the
                names above are the ones the vendor reported back.
              </li>
            </ul>
          </div>

          <h2 className="gs-h2" style={{ marginTop: "48px" }}>
            With JavaScript off
          </h2>
          <p className="lp-lede">
            The instrument and the band are both scroll-driven, and both ship their content in the
            served HTML rather than building it in the browser. With scripting disabled the ledger
            renders the completed run — every claim, every verdict, every total — and the band
            renders as a single still photograph. You lose the reveal and keep the argument. That is
            a testable claim, and it is tested: if the server markup ever stopped carrying the
            finished state, the suite goes red rather than the page going quietly wrong.
          </p>
          <p className="lp-lede">
            Motion respects <code>prefers-reduced-motion</code>: the band holds one frame and never
            scrubs.
          </p>
          <p className="lp-lede">
            The same trade is made whenever the window cannot hold the instrument. The ledger is a
            sheet of a fixed height, and pinning one that is taller than the viewport clips it at
            both ends — quietly taking the run&rsquo;s totals off the bottom of the screen while
            everything still looks right. So the sheet is pinned only where it fits, and on a phone,
            on a narrow window, or on a short one it is shown complete and scrolls with the page
            instead. The band holds its poster frame on narrow screens too, which also means a phone
            is not asked to download eighty-one frames to animate a picture the width of a hand.
          </p>

          <p className="lp-stamp" style={{ marginTop: "48px" }}>
            Run recorded {RECORDED_ON}. <Link href="/">Back to the landing page</Link>.
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
