"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SiteRecord } from "@/lib/sites/catalog";
import { verdictStatus, VERDICT_WORDS } from "./sites-model";

/**
 * One site's dossier (W-sites, s61): live preview beside the record — the
 * case study a prospect conversation reaches for. Preview iframes the real
 * page from the sites origin with device-width toggles (desktop / 390);
 * the record shows the axes, the design seeds, the honest mint facts from
 * the manifest (dimensions + pinned-hash tail), and links out to the
 * page's own /guide (Q2: link, not embed — the guide is its own honest
 * page). Credits stay /guide-only (Q4).
 */
export function SiteDossier({
  site,
  previewOrigin,
}: {
  site: SiteRecord;
  previewOrigin: string;
}) {
  const [width, setWidth] = useState<"desktop" | "phone">("desktop");
  const status = verdictStatus(site);
  const siteUrl = `${previewOrigin}/${site.slug}/`;

  const facts: Array<[string, string | undefined]> = [
    ["Vertical", site.vertical],
    ["Primary axis", site.axes.primary],
    ["Secondary axis", site.axes.secondary],
    ["Axis note", site.axisNote],
    ["Palette seed", site.paletteSeed],
    ["Type", site.typeDirection],
    ["Motion budget", site.motionBudget],
    ["Wave", site.wave !== undefined ? String(site.wave) : undefined],
    ["Built", site.built],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/app/sites"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Sites
        </Link>
        <h1 className="text-lg font-semibold">{site.name}</h1>
        {status === "awaiting" ? (
          <Badge variant="outline" className="border-amber-600/40 text-amber-700">
            {VERDICT_WORDS[status]}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">
            {VERDICT_WORDS[status]}
            {site.verdict?.note ? ` — ${site.verdict.note}` : ""}
          </span>
        )}
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">{site.oneLiner}</p>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            {(["desktop", "phone"] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWidth(w)}
                className={cn(
                  "rounded border px-2.5 py-1 transition-colors",
                  width === w
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {w === "desktop" ? "Desktop" : "390 px"}
              </button>
            ))}
            <a
              href={siteUrl}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-primary hover:underline"
            >
              Open full <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
            <a
              href={`${siteUrl}guide/`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              How it was made <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          </div>
          <div className="overflow-auto rounded-lg border bg-muted/40 p-3">
            <iframe
              src={siteUrl}
              title={`${site.name} — live preview`}
              className={cn(
                "mx-auto h-[70vh] rounded border bg-white",
                width === "desktop" ? "w-full" : "w-[390px]",
              )}
            />
          </div>
          <p className="text-xs text-muted-foreground/70">
            Served live from {previewOrigin} — if the frame is blank in dev, start the preview
            server: <code className="rounded bg-muted px-1">python3 scripts/preview-server.py</code>
          </p>
        </div>

        <aside className="space-y-4">
          <dl className="space-y-2 rounded-lg border p-3 text-sm">
            {facts
              .filter((f): f is [string, string] => Boolean(f[1]))
              .map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground/70">
                    {label}
                  </dt>
                  <dd className="text-sm leading-snug">{value}</dd>
                </div>
              ))}
          </dl>
          <div className="rounded-lg border p-3">
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground/70">
              Minted assets · {site.assets.length}
            </p>
            <ul className="space-y-1 font-mono text-xs text-muted-foreground">
              {site.assets.map((a) => (
                <li key={a.file} className="flex justify-between gap-2">
                  <span className="truncate">{a.file}</span>
                  <span className="shrink-0">
                    {a.width}×{a.height} · …{a.hashTail}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-snug text-muted-foreground/70">
              Every file is a deterministic derive of a pinned original (model, prompt, credits on
              the provenance manifest); the page&apos;s /guide tells the honest story.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
