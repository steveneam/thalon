"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SiteRecord } from "@/lib/sites/catalog";
import { useListKeys } from "@/lib/workspace/keyboard";
import { SELECTED_ROW } from "@/lib/workspace/selected-row";
import { applyFilters, countLine, facetValues, verdictStatus, VERDICT_WORDS, type SiteFilters } from "./model";

/**
 * The Sites gallery (W-sites, s61): the portfolio as a card grid — the
 * third outputs surface (Transcription = inputs · Videos = video outputs · Sites
 * = page outputs). Card image = the site's own hero asset served from the
 * preview origin; the bronze "awaiting verdict" chip is the surface's ONE
 * signal-channel element (Two-Channel: amber signals, blue acts). Uniform
 * grid (Q1); j/k move, Enter opens (the selected card wears SELECTED_ROW).
 * Bounded-List: the count line states totals; the grid scrolls normally at
 * 15 and states pagination past ~24 (not yet reached — honesty over
 * machinery).
 */
export function SitesGallery({
  records,
  previewOrigin,
  sourceKind,
}: {
  records: SiteRecord[];
  previewOrigin: string;
  sourceKind: "local" | "remote";
}) {
  const router = useRouter();
  const [filters, setFilters] = useState<SiteFilters>({});
  const [selectedSlug, setSelectedSlug] = useState<string | null>(records[0]?.slug ?? null);
  const selectedRef = useRef<HTMLAnchorElement | null>(null);

  const facets = useMemo(() => facetValues(records), [records]);
  const shown = useMemo(() => applyFilters(records, filters), [records, filters]);

  // Derived, not effect-synced: filtering away the selected card falls back
  // to the first shown card at render (no cascading setState).
  const effectiveSelected =
    selectedSlug && shown.some((r) => r.slug === selectedSlug)
      ? selectedSlug
      : (shown[0]?.slug ?? null);

  const move = (delta: 1 | -1) => (event: KeyboardEvent) => {
    if (shown.length === 0) return;
    event.preventDefault();
    const current = shown.findIndex((r) => r.slug === effectiveSelected);
    const next = current === -1 ? 0 : Math.min(Math.max(current + delta, 0), shown.length - 1);
    setSelectedSlug(shown[next].slug);
  };
  useListKeys({
    enabled: true,
    bindings: {
      j: move(1),
      k: move(-1),
      Enter: (event) => {
        if (!effectiveSelected) return;
        event.preventDefault();
        router.push(`/app/sites/${effectiveSelected}`);
      },
    },
  });
  useEffect(() => {
    selectedRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [effectiveSelected]);

  const facetChip = (active: boolean) =>
    cn(
      "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
      active
        ? "border-primary/40 bg-primary/10 text-primary"
        : "border-border text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-sm text-muted-foreground">{countLine(records, shown)}</p>
        {sourceKind === "local" && (
          <p className="text-xs text-muted-foreground/70">
            reading the local template directory · previews via {previewOrigin}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground/70">vertical</span>
          {facets.verticals.map((v) => (
            <button
              key={v}
              type="button"
              className={facetChip(filters.vertical === v)}
              onClick={() =>
                setFilters((f) => ({ ...f, vertical: f.vertical === v ? undefined : v }))
              }
            >
              {v.split("-").at(-1)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground/70">axis</span>
          {facets.axes.map((a) => (
            <button
              key={a}
              type="button"
              className={facetChip(filters.axis === a)}
              onClick={() => setFilters((f) => ({ ...f, axis: f.axis === a ? undefined : a }))}
            >
              {a}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground/70">wave</span>
          {facets.waves.map((w) => (
            <button
              key={w}
              type="button"
              className={facetChip(filters.wave === w)}
              onClick={() => setFilters((f) => ({ ...f, wave: f.wave === w ? undefined : w }))}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Portfolio sites">
        {shown.map((site) => {
          const status = verdictStatus(site);
          const selected = site.slug === effectiveSelected;
          return (
            <li key={site.slug}>
              <Link
                ref={selected ? selectedRef : undefined}
                href={`/app/sites/${site.slug}`}
                onFocus={() => setSelectedSlug(site.slug)}
                onMouseEnter={() => setSelectedSlug(site.slug)}
                className={cn(
                  "block overflow-hidden rounded-lg border transition-colors",
                  selected ? SELECTED_ROW : "border-border hover:border-muted-foreground/40",
                )}
              >
                <div className="aspect-video bg-muted">
                  {site.cardImage ? (
                    // eslint-disable-next-line @next/next/no-img-element -- preview-origin images are external to the Next image pipeline on purpose
                    <img
                      src={`${previewOrigin}/${site.cardImage}`}
                      alt=""
                      width={640}
                      height={360}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      no card image
                    </div>
                  )}
                </div>
                <div className="space-y-1.5 p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate font-medium">{site.name}</p>
                    {status === "awaiting" ? (
                      <Badge variant="outline" className="border-amber-600/40 text-amber-700">
                        {VERDICT_WORDS[status]}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">{VERDICT_WORDS[status]}</span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{site.oneLiner}</p>
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-xs text-muted-foreground">
                    <span className="rounded bg-muted px-1.5 py-0.5">{site.axes.primary}</span>
                    {site.axes.secondary && (
                      <span className="rounded bg-muted px-1.5 py-0.5">{site.axes.secondary}</span>
                    )}
                    {site.built && <span className="ml-auto">{site.built}</span>}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 && (
        <p className="text-sm text-muted-foreground">No sites match these filters.</p>
      )}
    </div>
  );
}
