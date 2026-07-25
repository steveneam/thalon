import { Sites } from "@/components/sites/sites";
import { loadSites } from "@/lib/sites/provider";

export const dynamic = "force-dynamic";

/**
 * Sites: the exact-mock rebuild of Sites.dc.html (DOCTRINE 0) — the page
 * outputs and their records. The catalog read stays where it was (the
 * W-sites provider seam, untouched); the surface decides what to say about
 * each of its states.
 */
export default async function SitesPage() {
  return <Sites source={await loadSites()} />;
}
