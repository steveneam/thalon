import { Sites } from "@/components/sites/sites";
import type { SiteFilters } from "@/components/sites/sites-model";
import { loadSites } from "@/lib/sites/provider";

export const dynamic = "force-dynamic";

/**
 * `?vertical=&axis=&wave=` — the dossier's fact doors land here, pre-filtered.
 *
 * Exported for the test that pins the wave parse: the dossier is the producer
 * and this is the consumer, and they disagreed silently for a whole wave of
 * the portfolio. A door's parse belongs under test, not inside a page body.
 */
export function readFilters(params: {
  [key: string]: string | string[] | undefined;
}): SiteFilters {
  const one = (key: string): string | undefined => {
    const value = params[key];
    return typeof value === "string" && value !== "" ? value : undefined;
  };
  // FINITE, not integer (s79 verify round, 3/3): build waves are not all whole
  // numbers — the catalog carries `wave: 2.5` (Sprig & Barrow), the dossier
  // renders it as a fact door (`?wave=2.5`), and `Number.isInteger` dropped the
  // filter on the way in, so the door landed on the unfiltered portfolio with
  // nothing saying the filter had been discarded. The surface's own chip path
  // always accepted 2.5 (sites-model `toggleChip` parses with plain `Number`);
  // this makes the URL read agree with it. `Number.isFinite` still refuses the
  // garbage the guard was there for — `?wave=abc` is NaN, and `?wave=` never
  // gets here (`one()` drops the empty string). Letting NaN through would be
  // WORSE than the bug: `r.wave === NaN` is false for every record, so a typo
  // would silently empty the grid instead of merely ignoring the filter.
  const wave = Number(one("wave"));
  return {
    vertical: one("vertical"),
    axis: one("axis"),
    wave: Number.isFinite(wave) ? wave : undefined,
  };
}

/**
 * Sites: the exact-mock rebuild of Sites.dc.html (DOCTRINE 0) — the page
 * outputs and their records. The catalog read stays where it was (the
 * W-sites provider seam, untouched); the surface decides what to say about
 * each of its states. A filter arriving in the URL is read once here so a
 * deep link lands filtered without a useSearchParams/Suspense dance — the
 * same shape Intel uses for `?tab=`.
 */
export default async function SitesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [source, params] = await Promise.all([loadSites(), searchParams]);
  return <Sites source={source} initialFilters={readFilters(params)} />;
}
