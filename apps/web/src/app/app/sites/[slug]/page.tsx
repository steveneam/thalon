import { notFound } from "next/navigation";
import { SiteDossier } from "@/components/sites/site-dossier";
import "@/components/sites/site-dossier.css";
import { loadSites } from "@/lib/sites/provider";

export const dynamic = "force-dynamic";

/**
 * One site's dossier — the record beside the live page. The catalog read is
 * the same W-sites provider seam the gallery uses; preview media is served
 * same-origin by /api/sites/preview, so the route hands the surface nothing
 * but the record.
 */
export default async function SitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const source = await loadSites();
  if (source.kind !== "local" && source.kind !== "remote") notFound();
  const site = source.records.find((r) => r.slug === slug);
  if (!site) notFound();
  return <SiteDossier site={site} />;
}
