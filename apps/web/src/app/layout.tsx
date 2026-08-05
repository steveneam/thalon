import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

/**
 * The landing's display + prose face (s109, the `novel-typography` secondary
 * axis). Loaded here because that is where Next wants font declarations, but
 * USED only inside `.landing-surface` — the workspace keeps Geist, and the
 * variable is inert everywhere else.
 *
 * Newsreader rather than a fashion serif: the page is a document about
 * evidence, so it wants a bookish text face that also holds up at display
 * size, with a real italic (the hero's "refuses to send" leans on it). It
 * follows the pattern all three A+ sites landed on — ONE serif for prose and
 * ONE mono for instrument apparatus, because the discipline being depicted
 * has exactly two lettering registers.
 */
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_TAGLINE,
  // X requires an explicit twitter:card to render link cards (it does not
  // fall back to OpenGraph the way LinkedIn does); titles/descriptions
  // inherit from each page's metadata. Upgrade to summary_large_image when
  // posts gain hero images (Sprint-7 blog bucket).
  twitter: {
    card: "summary",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Light-first (docs/FRONTEND.md §1, amended 2026-07-07): the workspace
    // runs on the :root light set; dark-cinematic surfaces (landing, /brand)
    // opt in with a scoped `.dark` wrapper on their own page.
    <html
      lang="en"
      // Globals set scroll-behavior:smooth; Next 16 wants the opt-in stated
      // or it warns on every route transition.
      data-scroll-behavior="smooth"
      // The workspace layout's pre-paint script stamps data-theme +
      // data-astryx-theme on <html> before hydration (wave-0 Astryx shell;
      // the Theme provider owns them after). Scoped to this one element,
      // exactly the theme-stamping pattern this flag exists for.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
