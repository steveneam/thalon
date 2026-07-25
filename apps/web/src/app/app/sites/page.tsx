import { SitesGallery } from "@/components/sites/sites-gallery";
import { loadSites } from "@/lib/sites/provider";

export const dynamic = "force-dynamic";

/**
 * Sites (W-sites, s61): the third outputs surface — Transcription is inputs,
 * Videos is video outputs, Sites is page outputs. Honest states: an
 * unconfigured origin says so plainly (never a fake empty gallery); a
 * failing origin shows the error it got.
 */
export default async function SitesPage() {
  const source = await loadSites();
  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      <div>
        <h1 className="text-lg font-semibold">Sites</h1>
        <p className="text-sm text-muted-foreground">
          The page outputs — every built site, its record, and its live preview.
        </p>
      </div>
      {source.kind === "unconfigured" && (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No sites origin configured. Set <code className="rounded bg-muted px-1">SITES_BASE_URL</code>{" "}
          to the templates preview service (it serves <code className="rounded bg-muted px-1">/catalog.json</code>{" "}
          beside the sites), or run the workspace beside the repo for the local read.
        </p>
      )}
      {source.kind === "error" && (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          The sites origin did not answer: {source.message}
        </p>
      )}
      {(source.kind === "local" || source.kind === "remote") && (
        <SitesGallery
          records={source.records}
          previewOrigin={source.previewOrigin}
          sourceKind={source.kind}
        />
      )}
    </div>
  );
}
