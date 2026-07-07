import { BrandLockup } from "@/components/brand/marks";
import { SITE_TAGLINE } from "@/lib/site";

/**
 * Footer architecture (§8 craft pass, shared by `/` and `/blog`): brand +
 * promise on the left, honest link columns on the right — only surfaces
 * that exist (no placeholder "Careers/Press" theater on a pre-launch site).
 */
const COLUMNS: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/#pricing" },
      { label: "FAQ", href: "/#faq" },
      { label: "Join the waitlist", href: "/#waitlist" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "RSS feed", href: "/blog/rss.xml" },
      { label: "llms.txt", href: "/llms.txt" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-12 sm:grid-cols-[1.2fr_auto_auto] sm:gap-16">
        <div>
          <BrandLockup />
          <p className="mt-3 max-w-xs text-sm leading-6 text-muted-foreground">{SITE_TAGLINE}</p>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <p className="u-eyebrow text-muted-foreground">{column.title}</p>
            <ul className="mt-3 space-y-2.5">
              {column.links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-5">
          <p className="text-xs text-muted-foreground">AI content, human-approved. © 2026 Thalon.</p>
          <p className="text-xs text-muted-foreground">Nothing ships without your click.</p>
        </div>
      </div>
    </footer>
  );
}
