import type { Metadata } from "next";
import { BrandLockup } from "@/components/brand/marks";
import { FeatureShowcase } from "@/components/landing/feature-showcase";
import { HeroVignette } from "@/components/landing/hero-vignette";
import { FaqJsonLd, OrganizationJsonLd } from "@/components/landing/json-ld";
import { StickyCta } from "@/components/landing/sticky-cta";
import { WaitlistForm } from "@/components/landing/waitlist-form";
import { FAQ, STEPS, TIERS } from "@/lib/landing/copy";

/**
 * The landing page (B6.1, docs/FRONTEND.md §2): founder's four sections +
 * the [+] conversion mechanics, statically prerendered — no dynamic API is
 * touched anywhere in this tree, so the whole page ships as the SSG shell;
 * client JS is limited to the waitlist forms, the feature modal, and the
 * sticky CTA (the vignette is pure CSS). Copy follows the manual keyword
 * pass (proprietary/prompts/keyword-manual-pass.md) and the honest-claims
 * rule (ADR 0006 §5).
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

export default function LandingPage() {
  return (
    // The landing stays dark-cinematic (workspace-ux-v2.md §4, ratified):
    // `.dark` is scoped here now that the document root is light-first.
    <div className="dark flex min-h-dvh flex-1 flex-col bg-background text-foreground">
      <OrganizationJsonLd />
      <FaqJsonLd />

      <header>
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-5">
          <BrandLockup />
          <nav aria-label="Primary" className="flex items-center gap-5 sm:gap-7">
            <a href="#features" className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline">
              Features
            </a>
            <a href="#pricing" className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline">
              Pricing
            </a>
            <a href="#faq" className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline">
              FAQ
            </a>
            <a
              href="#waitlist"
              className="rounded-lg border border-primary/40 px-3.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
            >
              Join the waitlist
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* §1 — hero + waitlist */}
        <section aria-labelledby="hero-heading" className="relative overflow-hidden">
          {/* command-deck backdrop: faint grid fading out radially + amber bloom */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(to_right,oklch(1_0_0/3.5%)_1px,transparent_1px),linear-gradient(to_bottom,oklch(1_0_0/3.5%)_1px,transparent_1px)] bg-[size:52px_52px] [mask-image:radial-gradient(75%_65%_at_50%_35%,black,transparent)]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(50%_40%_at_75%_12%,oklch(0.78_0.14_76/7%),transparent_70%)]"
          />

          <div className="relative mx-auto grid w-full max-w-6xl gap-14 px-6 pt-14 pb-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pt-24 lg:pb-28">
            <div>
              <p className="u-eyebrow anim-rise text-primary">
                AI content engine · human approval
              </p>
              <h1
                id="hero-heading"
                className="anim-rise mt-4 max-w-xl text-4xl leading-[1.06] font-bold tracking-tight text-balance sm:text-5xl lg:text-[3.4rem]"
                style={{ animationDelay: "0.08s" }}
              >
                Turn one prompt into posts, videos, and pages.
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

        {/* §2 — the three features + how it works + trust */}
        <section id="features" aria-labelledby="features-heading" className="scroll-mt-16">
          <div className="mx-auto w-full max-w-6xl px-6 py-20 lg:py-24">
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

            {/* [+] the 3-step connective strip */}
            <div className="mt-16 rounded-xl border bg-card/50 p-6 sm:p-8">
              <h3 className="text-xl font-semibold tracking-tight">How does it work?</h3>
              <ol className="mt-6 grid gap-6 md:grid-cols-3">
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

            {/* [+] trust framing — the differentiator, led with */}
            <div className="mt-8 rounded-xl border border-primary/20 bg-primary/5 p-6 sm:p-8">
              <h3 className="text-xl font-semibold tracking-tight">
                Why trust it with your name?
              </h3>
              <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
                Because Thalon is gated, not trigger-happy. An automated judge checks every draft&apos;s
                claims against the sources you provided and screens your denylist — drafts that
                fail are blocked before you ever see them, and nothing publishes without your
                explicit approval.
              </p>
              <ul className="mt-5 flex flex-wrap gap-2.5">
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

        {/* §3 — early-access pricing */}
        <section id="pricing" aria-labelledby="pricing-heading" className="scroll-mt-16 border-t">
          <div className="mx-auto w-full max-w-6xl px-6 py-20 lg:py-24">
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
                        ? "bg-primary text-primary-foreground"
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

        {/* §4 — FAQ + final repeat CTA */}
        <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-16 border-t">
          <div className="mx-auto w-full max-w-3xl px-6 py-20 lg:py-24">
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

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8">
          <BrandLockup />
          <p className="text-xs text-muted-foreground">
            AI content, human-approved. © 2026 Thalon.
          </p>
        </div>
      </footer>

      <StickyCta />
    </div>
  );
}
