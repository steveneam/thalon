import { notFound } from "next/navigation";
import { SiteDossier } from "@/components/sites/site-dossier";
import { loadSites } from "@/lib/sites/provider";

export const dynamic = "force-dynamic";

/** One site's dossier — the record + live preview (W-sites, s61). */
export default async function SitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const source = await loadSites();
  if (source.kind !== "local" && source.kind !== "remote") notFound();
  const site = source.records.find((r) => r.slug === slug);
  if (!site) notFound();
  return (
    <div className="p-4 lg:p-6">
      <SiteDossier site={site} previewOrigin={source.previewOrigin} />
    </div>
  );
}
