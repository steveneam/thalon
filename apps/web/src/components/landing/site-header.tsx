import Link from "next/link";
import { BrandLockup } from "@/components/brand/marks";

/**
 * The site header, shared by `/` and `/blog` (§8 craft pass): one nav, one
 * CTA. Link hrefs are root-absolute so they work from any site page — on
 * `/` itself the hash links resolve as same-page jumps.
 */
export function SiteHeader() {
  return (
    <header>
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-5">
        <Link href="/" aria-label="Thalon home">
          <BrandLockup />
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-5 sm:gap-7">
          <Link href="/#features" className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline">
            Features
          </Link>
          <Link href="/#pricing" className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline">
            Pricing
          </Link>
          <Link href="/#faq" className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline">
            FAQ
          </Link>
          <Link href="/blog" className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline">
            Blog
          </Link>
          {/* The site → workspace door (s70c seam; s84 made it VISIBLE —
              founder: "there is no button on the landing page that goes to
              the workspace"). It was grey text among four other grey nav
              items beside an amber CTA, so it read as fine print. Now it
              carries a button's outline: unmistakably a door, still visually
              subordinate to the visitor CTA beside it, which is the one that
              must win the eye. Real auth replaces the bare link when the auth
              bucket lands. */}
          <Link
            href="/app"
            className="rounded-lg border border-border px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-foreground/30 hover:bg-foreground/5"
          >
            Workspace
          </Link>
          {/* s109: was a primary-tinted pill. The landing's one-colour rule
              (a colour means a gate verdict, never a decoration) leaves no
              room for an accent CTA, and the header is shared, so it goes
              neutral everywhere rather than only on `/`. */}
          <Link
            href="/#waitlist"
            className="border border-foreground px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-foreground hover:text-background"
          >
            Join the waitlist
          </Link>
        </nav>
      </div>
    </header>
  );
}
