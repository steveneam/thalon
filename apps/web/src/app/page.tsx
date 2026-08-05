import type { Metadata } from "next";
import Link from "next/link";
import "@/components/landing/landing.css";
import { GateInstrument } from "@/components/landing/gate-instrument";
import { FaqJsonLd, OrganizationJsonLd } from "@/components/landing/json-ld";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { StickyCta } from "@/components/landing/sticky-cta";
import { WaitlistForm } from "@/components/landing/waitlist-form";
import { WeirBand } from "@/components/landing/weir-band";
import { BRAND_ASSETS } from "@/lib/brand-assets";
import { FAQ, NOT_YET, STATS, TIERS, TODAY } from "@/lib/landing/copy";
import { RECORDED_ON } from "@/lib/landing/run-snapshot";

/**
 * The landing page — rebuilt s109 as the capstone of the landing arc
 * (`docs/landing-arc/spec.md`), immediately after ⑳ Whitethorn, ㉑ Aspect &
 * Fall and ㉒ Small Hours, which is exactly the order the founder set: *"so
 * that way, you have the full landing page to learn from rather than just
 * mock."* The pre-plan of record is
 * `docs/landing-arc/thalon-landing-PREPLAN.md`.
 *
 * ── THE REGISTER FLIPPED, AND THAT WAS THE POINT ─────────────────────────
 * The look-first sweep (meta-prompt step 0) found that the AI-landing default
 * is one page drawn a hundred times — near-black ground, a headline whose
 * last word glows in a gradient, a gradient CTA pill — and that THIS PAGE WAS
 * ALREADY WEARING IT. So `.dark` is gone from the wrapper and the page runs
 * on paper, in the same register as the three sites above. A consequence
 * worth stating: the one-colour rule (a colour means a gate verdict, never a
 * decoration) means this page cannot grow a gradient CTA without breaking
 * itself, which is the strongest form the refusal could take.
 *
 * `/blog` and `/brand` still scope `.dark` themselves and are unchanged —
 * their register is their own call, and flipping three public surfaces at
 * once would have put the session's actual deliverable at risk. Carried, not
 * forgotten.
 *
 * ── WHAT SURVIVED THE REBUILD, DELIBERATELY ──────────────────────────────
 * `@/lib/landing/copy.ts` stays the SINGLE SOURCE OF TRUTH: this page, the
 * FAQPage/Organization JSON-LD and `/llms.txt` all render from it, so a claim
 * cannot drift between them. The waitlist door, both its mounts, the pricing
 * tiers, the FAQ accordion, the blog links and the honest-claims rule (ADR
 * 0006 §5) are all unchanged in substance.
 *
 * The page stays a static prerender: no dynamic API is touched anywhere in
 * this tree, and the instrument runs on a COMMITTED snapshot rather than a
 * live query against tenant drafts.
 */
export const metadata: Metadata = {
  title: { absolute: "Thalon — the AI content engine that shows you what it refused" },
  description:
    "One prompt becomes posts, videos and pages. Every claim is checked against your own sources, your denylist is screened, and nothing publishes without your click. See a real run, gate by gate.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Thalon — the AI content engine that shows you what it refused",
    description:
      "One prompt in. Posts, videos and pages out — grounded in your sources, gated by your approval. This page shows a real run, including what it stopped.",
    url: "/",
    siteName: "Thalon",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-background text-foreground">
      <OrganizationJsonLd />
      <FaqJsonLd />

      <SiteHeader />

      <main className="flex-1">
        {/* ── HERO ─────────────────────────────────────────────────────
            The secondary axis, used ONCE: display type interlocking with the
            photographic subject (the look-first principle, stolen as a
            principle and never as pixels). The still is frame 0 of the same
            take the band below scrubs, so the hero and the moving moment are
            literally the same place. */}
        <section className="landing-surface lp-hero" aria-labelledby="hero-heading">
          <div className="gs-wrap">
            <p className="gs-kicker">Thalon {"·"} AI content engine with the gate on the inside</p>
            <h1 className="lp-h1" id="hero-heading">
              It writes a great deal.
              <br />
              What matters is what it <em>refuses to send.</em>
            </h1>
            <p className="lp-sub">
              One prompt becomes posts, videos and pages. Every one of them is checked against the
              sources you provided and screened against your own denylist before you ever see it,
              and none of them leaves without your click.
            </p>

            <div id="waitlist" data-waitlist-anchor className="lp-form scroll-mt-24">
              <WaitlistForm id="waitlist-email" />
            </div>

            <figure className="lp-heroart">
              <img
                src={BRAND_ASSETS.weirHero.src}
                width={BRAND_ASSETS.weirHero.width}
                height={BRAND_ASSETS.weirHero.height}
                alt="Still water held above a low stone sill at first light, with a sheet of bright water spilling over the lip onto pale gravel below."
                data-brand="weirHero"
                fetchPriority="high"
              />
            </figure>
          </div>
        </section>

        {/* ── PROOF BAND — engineering facts, each checkable in this repo ── */}
        <section className="landing-surface lp-proof" aria-label="Proof">
          <div className="gs-wrap">
            <dl className="lp-stats">
              {STATS.map((stat) => (
                <div key={stat.label}>
                  <dt className="sr-only">{stat.label}</dt>
                  <dd className="lp-stat-v">{stat.value}</dd>
                  <dd aria-hidden="true" className="lp-stat-l">
                    {stat.label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── THE SPINE: a real run, walked gate by gate ── */}
        <GateInstrument />

        {/* ── THE MOVING BAND: the metaphor, after the argument ── */}
        <WeirBand />

        {/* ── HONEST SCOPE: what it does, and what it does not ─────────
            The section the look-first sweep said nobody in the category
            ships. Every "not yet" line below is a real limit of the engine
            today, not a roadmap tease. */}
        <section className="landing-surface" id="features" aria-labelledby="today-heading">
          <div className="gs-wrap">
            <p className="gs-kicker">Honest scope</p>
            <h2 className="gs-h2" id="today-heading">
              What it does today.
            </h2>

            <div className="lp-three">
              {TODAY.map((f) => (
                <div key={f.name}>
                  <h3>{f.name}</h3>
                  <p>{f.detail}</p>
                </div>
              ))}
            </div>

            <div className="lp-notyet">
              <p className="gs-kicker">And what it does not, stated plainly</p>
              <ul>
                {NOT_YET.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── PRICING ── */}
        <section className="landing-surface" id="pricing" aria-labelledby="pricing-heading">
          <div className="gs-wrap">
            <p className="gs-kicker">Early access</p>
            <h2 className="gs-h2" id="pricing-heading">
              What does it cost?
            </h2>
            <p className="lp-lede">
              Planned launch pricing. It may still move before launch, and there are no invented
              discounts here. Waitlist members get founding-member rates first, in queue order.
            </p>

            <div className="lp-tiers">
              {TIERS.map((tier) => (
                <div key={tier.name} className={tier.featured ? "is-featured" : undefined}>
                  {tier.featured ? <span className="lp-flag">founding member</span> : null}
                  <h3>{tier.name}</h3>
                  <p className="lp-aud">{tier.audience}</p>
                  <p className="lp-price">
                    ${tier.price}
                    <span> USD/mo</span>
                  </p>
                  <ul>
                    {tier.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                  <a href="#waitlist">Join the waitlist</a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ + the repeat door ── */}
        <section className="landing-surface" id="faq" aria-labelledby="faq-heading">
          <div className="gs-wrap lp-narrow">
            <p className="gs-kicker">Objections, answered</p>
            <h2 className="gs-h2" id="faq-heading">
              Frequently asked questions
            </h2>

            <div className="lp-faq">
              {FAQ.map((item) => (
                <details key={item.question}>
                  <summary>
                    {item.question}
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>

            <div className="lp-close">
              <h3>Be publishing everywhere the week you get access.</h3>
              <p>One email when it is your turn, and a referral link if you would rather not wait.</p>
              <div data-waitlist-anchor className="lp-form">
                <WaitlistForm id="waitlist-email-repeat" />
              </div>
              <p className="lp-stamp">
                The run on this page was recorded from this workspace on {RECORDED_ON}.{" "}
                <Link href="/guide">How this page was built</Link>.
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />

      <StickyCta />
    </div>
  );
}
