import type { Metadata } from "next";
import { FeatureShowcase } from "@/components/landing/feature-showcase";
import { HeroVignette } from "@/components/landing/hero-vignette";
import { FaqJsonLd, OrganizationJsonLd } from "@/components/landing/json-ld";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { StickyCta } from "@/components/landing/sticky-cta";
import { WaitlistForm } from "@/components/landing/waitlist-form";
import { BRAND_ASSETS } from "@/lib/brand-assets";
import { FAQ, NEW_WAY, OLD_WAY, STATS, STEPS, TIERS } from "@/lib/landing/copy";

/**
 * The landing page (B6.1 + the §8 uplift, docs/FRONTEND.md §2): founder's
 * four sections + the [+] conversion mechanics, statically prerendered —
 * no dynamic API is touched anywhere in this tree, so the whole page ships
 * as the SSG shell. The client-JS budget is the consciously amended one
 * (workspace-ux-v2.md §8.1): forms + modal + sticky + ONE hero moment —
 * and the hero moment (split headline + drifting depth layer) is pure CSS
 * on server-rendered spans, so it costs zero client JS anyway. Copy
 * follows the manual keyword pass (proprietary/prompts/keyword-manual-pass
 * .md) and the honest-claims rule (ADR 0006 §5).
 */
export const metadata: Metadata = {
  title: { absolute: "Thalon — AI content engine with built-in approval" },
  description:
    "Turn one prompt into posts, videos, and pages. Thalon grounds every claim in your sources and publishes nothing without your approval. Join the waitlist.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Thalon — AI content engine with built-in approval",
    description:
      "One prompt in. Posts, videos, and pages out — grounded in your sources, gated by your approval.",
    url: "/",
    siteName: "Thalon",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

const TRUST_CHIPS = [
  "Every claim grounded to your sources",
  "Your denylist screened, every draft",
  "Nothing posts without your click",
];

/**
 * §8.1: the headline's words stagger in — server-rendered spans, inline
 * delays, `.anim-word` does the rest in CSS. Spaces stay text nodes so the
 * h1's textContent (and screen readers) read one uninterrupted sentence.
 */
function SplitHeadline({ text, baseDelaySec = 0.08 }: { text: string; baseDelaySec?: number }) {
  return text.split(" ").map((word, i) => (
    <span key={`${word}-${i}`}>
      {i > 0 ? " " : null}
      <span className="anim-word" style={{ animationDelay: `${(baseDelaySec + i * 0.05).toFixed(2)}s` }}>
        {word}
      </span>
    </span>
  ));
}

export default function LandingPage() {
  return (
    // The landing stays dark-cinematic (workspace-ux-v2.md §4, ratified):
    // `.dark` is scoped here now that the document root is light-first.
    <div className="dark flex min-h-dvh flex-1 flex-col bg-background text-foreground">
      <OrganizationJsonLd />
      <FaqJsonLd />

      <SiteHeader />

      <main className="flex-1">
        {/* §1 — hero + waitlist */}
        <section aria-labelledby="hero-heading" className="relative overflow-hidden">
          {/* minted hero backdrop (L1, pinned + derived — see lib/brand-assets):
              ambient dusk glow low-right, under the CSS deck layers.
              A left/bottom scrim keeps the copy column on near-black. */}
          <img
            src={BRAND_ASSETS.heroAmbient.src}
            width={BRAND_ASSETS.heroAmbient.width}
            height={BRAND_ASSETS.heroAmbient.height}
            alt=""
            aria-hidden="true"
            data-brand="heroAmbient"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-70"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-background via-background/55 to-transparent"
          />
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background"
          />
          {/* command-deck backdrop: faint grid fading out radially + amber bloom */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(to_right,oklch(1_0_0/3.5%)_1px,transparent_1px),linear-gradient(to_bottom,oklch(1_0_0/3.5%)_1px,transparent_1px)] bg-[size:52px_52px] [mask-image:radial-gradient(75%_65%_at_50%_35%,black,transparent)]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(50%_40%_at_75%_12%,oklch(0.78_0.14_76/7%),transparent_70%)]"
          />
          {/* §8.1 depth layer: two blooms drifting on long offsets behind the
              vignette — parallax depth without a scroll listener. */}
          <div
            aria-hidden="true"
            className="anim-drift absolute inset-0 bg-[radial-gradient(42%_36%_at_70%_55%,oklch(0.78_0.14_76/6%),transparent_70%)]"
          />
          <div
            aria-hidden="true"
            className="anim-drift-late absolute inset-0 bg-[radial-gradient(36%_30%_at_22%_70%,oklch(0.5_0.115_252/8%),transparent_72%)]"
          />

          <div className="relative mx-auto grid w-full max-w-6xl gap-14 px-6 pt-14 pb-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pt-24 lg:pb-28">
            <div>
              <p className="u-eyebrow anim-rise text-primary">
                AI content engine · human approval
              </p>
              <h1
                id="hero-heading"
                className="mt-4 max-w-xl text-4xl leading-[1.06] font-bold tracking-tight text-balance sm:text-5xl lg:text-[3.4rem]"
              >
                <SplitHeadline text="Turn one prompt into posts, videos, and pages." />
              </h1>
              <p
                className="anim-rise mt-5 max-w-lg text-lg leading-8 text-muted-foreground"
                style={{ animationDelay: "0.16s" }}
              >
                Thalon drafts for every platform you publish on, grounds every claim in your
                sources, and ships nothing without your approval.
              </p>
              <div
                id="waitlist"
                data-waitlist-anchor
                className="anim-rise mt-8 scroll-mt-24"
                style={{ animationDelay: "0.24s" }}
              >
                <WaitlistForm id="waitlist-email" />
              </div>
            </div>

            <div className="anim-rise" style={{ animationDelay: "0.2s" }}>
              <HeroVignette />
            </div>
          </div>

          {/* the horizon — Thalon watches it */}
          <div aria-hidden="true" className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        </section>

        {/* §8.2 honest proof band — engineering facts, not logo theater
            (each value's provenance is documented on STATS in copy.ts) */}
        <section aria-label="Proof" className="border-b">
          <dl className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-x-6 gap-y-8 px-6 py-10 md:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <dt className="sr-only">{stat.label}</dt>
                <dd className="u-tabular font-mono text-3xl font-semibold text-primary">
                  {stat.value}
                </dd>
                <dd aria-hidden="true" className="mt-1.5 text-sm leading-6 text-muted-foreground">
                  {stat.label}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* §2 — the three features + how it works + trust */}
        <section id="features" aria-labelledby="features-heading" className="relative scroll-mt-16">
          {/* minted section texture (L2): faint currents, one warm updraft */}
          <img
            src={BRAND_ASSETS.currents.src}
            width={BRAND_ASSETS.currents.width}
            height={BRAND_ASSETS.currents.height}
            alt=""
            aria-hidden="true"
            data-brand="currents"
            loading="lazy"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent_55%)]"
          />
          <div className="relative mx-auto w-full max-w-6xl px-6 py-20 lg:py-24">
            <p className="u-eyebrow text-primary">The three jobs</p>
            <h2 id="features-heading" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              What does Thalon do?
            </h2>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
              It watches your topics for what&apos;s rising, turns one prompt into every format you
              publish, and gates all of it behind your approval. Three features, one loop — tap a
              card to see it work.
            </p>

            <div className="mt-10">
              <FeatureShowcase />
            </div>

            {/* [+] the 3-step connective strip — L3b backdrop: one point of
                light unfolding into three forms, the steps story itself */}
            <div className="relative mt-16 overflow-hidden rounded-xl border bg-card/50 p-6 sm:p-8">
              <img
                src={BRAND_ASSETS.unfolding.src}
                width={BRAND_ASSETS.unfolding.width}
                height={BRAND_ASSETS.unfolding.height}
                alt=""
                aria-hidden="true"
                data-brand="unfolding"
                loading="lazy"
                className="pointer-events-none absolute inset-y-0 right-0 h-full w-2/3 object-cover opacity-30 [mask-image:linear-gradient(to_left,black,transparent)]"
              />
              <h3 className="relative text-xl font-semibold tracking-tight">How does it work?</h3>
              <ol className="relative mt-6 grid gap-6 md:grid-cols-3">
                {STEPS.map((step, i) => (
                  <li key={step.name} className="flex gap-4">
                    <span className="u-tabular font-mono text-2xl font-semibold text-primary/80">
                      0{i + 1}
                    </span>
                    <span>
                      <span className="block font-semibold">{step.name}</span>
                      <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                        {step.detail}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            {/* §8.2 old way vs new way — the two-column contrast strip
                (workspace-ux-v2.md §5, honest lines only) */}
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <div className="rounded-xl border border-dashed p-6 sm:p-8">
                <h3 className="text-xl font-semibold tracking-tight text-muted-foreground">
                  {OLD_WAY.title}
                </h3>
                <ul className="mt-5 space-y-3.5">
                  {OLD_WAY.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm leading-6 text-muted-foreground">
                      <svg viewBox="0 0 14 14" className="mt-1 size-3.5 shrink-0 opacity-60" aria-hidden="true">
                        <path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-primary/25 bg-primary/5 p-6 sm:p-8">
                <h3 className="text-xl font-semibold tracking-tight">{NEW_WAY.title}</h3>
                <ul className="mt-5 space-y-3.5">
                  {NEW_WAY.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm leading-6">
                      <svg viewBox="0 0 16 16" className="mt-1 size-3.5 shrink-0 text-primary" aria-hidden="true">
                        <path
                          d="M3 8.5 L6.5 12 L13 4.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* [+] trust framing — the differentiator, led with. L3c backdrop:
                the calm lantern held above still water — considered judgment */}
            <div className="relative mt-8 overflow-hidden rounded-xl border border-primary/20 bg-primary/5 p-6 sm:p-8">
              <img
                src={BRAND_ASSETS.lantern.src}
                width={BRAND_ASSETS.lantern.width}
                height={BRAND_ASSETS.lantern.height}
                alt=""
                aria-hidden="true"
                data-brand="lantern"
                loading="lazy"
                className="pointer-events-none absolute inset-y-0 right-0 h-full w-1/2 object-cover opacity-35 [mask-image:linear-gradient(to_left,black,transparent)]"
              />
              <h3 className="relative text-xl font-semibold tracking-tight">
                Why trust it with your name?
              </h3>
              <p className="relative mt-3 max-w-2xl leading-7 text-muted-foreground">
                Because Thalon is gated, not trigger-happy. An automated judge checks every draft&apos;s
                claims against the sources you provided and screens your denylist — drafts that
                fail are blocked before you ever see them, and nothing publishes without your
                explicit approval.
              </p>
              <ul className="relative mt-5 flex flex-wrap gap-2.5">
                {TRUST_CHIPS.map((chip) => (
                  <li
                    key={chip}
                    className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-background/60 px-3.5 py-1.5 text-sm"
                  >
                    <svg viewBox="0 0 16 16" className="size-3.5 text-primary" aria-hidden="true">
                      <path
                        d="M3 8.5 L6.5 12 L13 4.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {chip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* §3 — early-access pricing. L4 backdrop: near-black paper grain,
            the faint warm gradient breathing at the section's lower edge */}
        <section id="pricing" aria-labelledby="pricing-heading" className="relative scroll-mt-16 border-t">
          <img
            src={BRAND_ASSETS.paperGrain.src}
            width={BRAND_ASSETS.paperGrain.width}
            height={BRAND_ASSETS.paperGrain.height}
            alt=""
            aria-hidden="true"
            data-brand="paperGrain"
            loading="lazy"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-50 [mask-image:linear-gradient(to_top,black,transparent_65%)]"
          />
          <div className="relative mx-auto w-full max-w-6xl px-6 py-20 lg:py-24">
            <p className="u-eyebrow text-primary">Early access</p>
            <h2 id="pricing-heading" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              What does it cost?
            </h2>
            <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
              Planned launch pricing — it may still move before launch, and there are no invented
              discounts here. Waitlist members get founding-member rates first, in queue order.
            </p>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {TIERS.map((tier) => (
                <div
                  key={tier.name}
                  className={`relative rounded-xl border p-6 ${
                    tier.featured ? "border-primary/45 bg-primary/5" : "bg-card/50"
                  }`}
                >
                  {tier.featured && (
                    <span className="u-eyebrow absolute -top-2.5 left-5 rounded bg-primary px-2 py-0.5 text-primary-foreground">
                      founding member
                    </span>
                  )}
                  <h3 className="text-lg font-semibold tracking-tight">{tier.name}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{tier.audience}</p>
                  <p className="u-tabular mt-4 font-mono text-3xl font-semibold">
                    ${tier.price}
                    <span className="text-sm font-normal text-muted-foreground"> USD/mo</span>
                  </p>
                  <ul className="mt-5 space-y-2.5 text-sm leading-6">
                    {tier.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2.5">
                        <svg viewBox="0 0 16 16" className="mt-1 size-3.5 shrink-0 text-primary" aria-hidden="true">
                          <path
                            d="M3 8.5 L6.5 12 L13 4.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        {bullet}
                      </li>
                    ))}
                  </ul>
                  <a
                    href="#waitlist"
                    className={`mt-6 block rounded-lg px-4 py-2 text-center text-sm font-semibold transition-opacity hover:opacity-85 ${
                      tier.featured
                        ? "cta-glare bg-primary text-primary-foreground"
                        : "border border-primary/40 text-primary"
                    }`}
                  >
                    Join the waitlist
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* §4 — FAQ + final repeat CTA. L5 under the close: the thin amber
            horizon, first light gathering — the horizon Thalon watches */}
        <section id="faq" aria-labelledby="faq-heading" className="relative scroll-mt-16 border-t">
          <img
            src={BRAND_ASSETS.horizon.src}
            width={BRAND_ASSETS.horizon.width}
            height={BRAND_ASSETS.horizon.height}
            alt=""
            aria-hidden="true"
            data-brand="horizon"
            loading="lazy"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-72 w-full object-cover opacity-70 [mask-image:linear-gradient(to_top,black,transparent)]"
          />
          <div className="relative mx-auto w-full max-w-3xl px-6 py-20 lg:py-24">
            <p className="u-eyebrow text-primary">Objections, answered</p>
            <h2 id="faq-heading" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Frequently asked questions
            </h2>

            <div className="mt-10 border-y">
              {FAQ.map((item) => (
                <details key={item.question} className="group border-b px-1 py-5 last:border-b-0">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                    {item.question}
                    <svg
                      viewBox="0 0 16 16"
                      className="size-4 shrink-0 text-primary transition-transform duration-200 group-open:rotate-45"
                      aria-hidden="true"
                    >
                      <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </summary>
                  <p className="mt-3 max-w-prose text-sm leading-7 text-muted-foreground">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>

            <div className="mt-16">
              <h3 className="text-2xl font-bold tracking-tight text-balance">
                Be publishing everywhere the week you get access.
              </h3>
              <p className="mt-3 leading-7 text-muted-foreground">
                One email when it&apos;s your turn — and a referral link if you&apos;d rather not wait.
              </p>
              <div className="mt-6" data-waitlist-anchor>
                <WaitlistForm id="waitlist-email-repeat" />
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />

      <StickyCta />
    </div>
  );
}
