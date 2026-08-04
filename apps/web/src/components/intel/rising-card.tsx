"use client";

import { useEffect, useRef } from "react";
import type { RisingView } from "@/components/intel/intel-model";
import { SourceThumb } from "@/components/media/source-thumb";

/**
 * The "More rising" card, ported 1:1 from Intel.dc.html: one compact row per
 * card that is NOT the expanded dossier — thermal word-in-pill, the source
 * thumbnail (media-first; the sheet's striped placeholder when the driver
 * captured none), the title, the mono data stamp, and the way back to the
 * original post. The row region is BOUNDED (`.card-rows`, the Bounded-List
 * Rule) — the sheet draws three rows, a live sweep returns as many as it
 * found. Selection is the sheet's own `.row.sel`, driven by the one list
 * keyboard grammar (j/k move · ↵ open) in the surface above.
 */
export function RisingCard({
  rows,
  selectedId,
  onOpen,
  onSelect,
}: {
  rows: RisingView[];
  selectedId: string | null;
  onOpen?: (cardId: string) => void;
  onSelect?: (cardId: string) => void;
}) {
  const selectedRef = useRef<HTMLDivElement | null>(null);

  // Keep the selected row inside the bound while j/k cruises it (jsdom-safe).
  useEffect(() => {
    selectedRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [selectedId]);

  return (
    <section className="card" aria-label="More rising">
      <div className="card-head">
        <span className="t-title">More rising</span>
        <span className="t-label">
          {rows.length} card{rows.length === 1 ? "" : "s"}
        </span>
        <div style={{ flex: 1 }} />
        {/*
          THE KEYBOARD GRAMMAR WORKED AND WAS INVISIBLE (s100 gate). j/k/↵ has
          moved this list since the surface shipped and nothing anywhere said
          so, which makes it a feature only its author can find. The legend
          rides the head of the list it drives — the videos surfaces' own
          j/k-legend pattern — and only when there is something to move
          through, so an empty list is not taught a shortcut it cannot use.
        */}
        {rows.length > 0 && (
          <span className="t-label" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <kbd className="kbd">j</kbd>
            <kbd className="kbd">k</kbd> move
            <span aria-hidden>·</span>
            <kbd className="kbd">↵</kbd> open
          </span>
        )}
      </div>
      <div className="card-rows">
        {rows.length === 0 && (
          <div className="row">
            <span className="t-label">Nothing else is rising right now — the watch is on.</span>
          </div>
        )}
        {rows.map((row) => (
          <div
            key={row.id}
            ref={selectedId === row.id ? selectedRef : undefined}
            className={selectedId === row.id ? "row sel" : "row"}
          >
            <span className={`pill ${row.band.pill}`}>{row.band.word}</span>
            <SourceThumb resolution={row.media} legend={row.thumbLabel} />
            <button
              type="button"
              className="row-open"
              title={row.fullText}
              onFocus={() => onSelect?.(row.id)}
              onClick={() => onOpen?.(row.id)}
            >
              {row.text}
            </button>
            <span className="t-data">{row.data}</span>
            {row.url && (
              <a
                href={row.url}
                target="_blank"
                rel="noreferrer"
                title="Open the original post"
                aria-label={`Open the original post: ${row.text}`}
                style={{ fontSize: 12 }}
              >
                ↗
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
