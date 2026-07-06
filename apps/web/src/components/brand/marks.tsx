import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

/**
 * B6.1 brand marks — founder direction (2026-07-06, two rounds): the GRIP
 * is the concept, read WARMLY — three sail-like forms closing on a point
 * ("like the Sydney Opera House sails but less sharp"), not an aggressive
 * claw. Three interpretations below for the final pick, previewed at
 * `/brand`. All marks are single-color `currentColor` on a 32-grid so they
 * stay crisp at favicon size. `BrandMark` is the provisional default every
 * surface renders — the pick swaps ONE alias (plus the literal twins in
 * app/icon.svg and app/opengraph-image.tsx).
 */

/** Grip I — the founder-liked original: three soft sails leaning into a
 * loose close, organic and warm; the talon is implied, never bared. The
 * center sail rides tall and left-of-center, the sides land at different
 * heights — deliberately off-balance ("too perfect symmetry is not art"). */
export function MarkGrip(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M14.5 2.5 Q23.5 12 18.5 28.5 Q12 15 14.5 2.5 Z" />
      <path d="M4 11 Q12.5 15 15 27 Q6.5 20 4 11 Z" />
      <path d="M28.5 8 Q26.5 19 21.5 29 Q28 17 28.5 8 Z" />
    </svg>
  );
}

/** Grip II — THE FOUNDER'S PICK (2026-07-06): the sails with fuller
 * bellies and blunted tips, the "less sharp" reading taken further. The
 * off-centred right sail carries extra body so it still reads at favicon
 * scale (founder note: it vanished when thin). */
export function MarkGripSoft(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M14.5 3 Q24.5 12 19.5 27 Q18.7 28.4 17.6 27.4 Q11.5 15 14.5 3 Z" />
      <path d="M4 11 Q13 15 14.8 25.5 Q14.9 27 13.6 26.3 Q6.5 20.5 4 11 Z" />
      <path d="M28.7 8.5 Q27.2 19.5 22.8 28.2 Q21.4 29.3 21 27.6 Q24.4 17.5 26.8 9.8 Q27.6 8 28.7 8.5 Z" />
    </svg>
  );
}

/** Grip III — "the shells": the three sails re-set ascending off a shared
 * waterline, opera-house style — the warm form carrying the intel story
 * (something rising, left to right). */
export function MarkShells(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M5 27 Q5.5 16 14 11.5 Q10 20 9.7 27 Z" />
      <path d="M12 27 Q13 11 21.5 6.5 Q16.8 17 16.5 27 Z" />
      <path d="M19 27 Q20.5 7.5 29 2.5 Q23.8 14.5 23.5 27 Z" />
      <rect x="3" y="28" width="26" height="1.4" rx="0.7" />
    </svg>
  );
}

/** The founder-picked mark (Grip II, 2026-07-06) — every surface renders this. */
export const BrandMark = MarkGripSoft;

/** The strong THALON wordmark stays typographic (docs/FRONTEND.md §1). */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-sans text-lg font-bold tracking-[0.14em] text-foreground uppercase",
        className,
      )}
    >
      Thalon
    </span>
  );
}

/** Mark + wordmark lockup — the default header brand. */
export function BrandLockup({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark className="size-6 text-primary" />
      <Wordmark />
    </span>
  );
}
