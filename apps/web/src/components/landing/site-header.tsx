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
          {/* The site ↔ workspace seam the founder found missing (s70c): the
              operator's way in, quiet next to the visitor CTA. Real auth
              replaces the bare link when the auth bucket lands. */}
          <Link href="/app" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Workspace
          </Link>
          <Link
            href="/#waitlist"
            className="rounded-lg border border-primary/40 px-3.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
          >
            Join the waitlist
          </Link>
        </nav>
      </div>
    </header>
  );
}
