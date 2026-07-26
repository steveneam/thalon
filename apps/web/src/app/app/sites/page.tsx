import { Sites } from "@/components/sites/sites";
import type { SiteFilters } from "@/components/sites/sites-model";
import { loadSites } from "@/lib/sites/provider";

export const dynamic = "force-dynamic";

/** `?vertical=&axis=&wave=` — the dossier's fact doors land here, pre-filtered. */
function readFilters(params: { [key: string]: string | string[] | undefined }): SiteFilters {
  const one = (key: string): string | undefined => {
    const value = params[key];
    return typeof value === "string" && value !== "" ? value : undefined;
  };
  const wave = Number(one("wave"));
  return {
    vertical: one("vertical"),
    axis: one("axis"),
    wave: Number.isInteger(wave) ? wave : undefined,
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
