"use client";

import "@/components/sites/sites.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  PRIMARY_CHIPS,
  VERDICT_PILL,
  VERDICT_WORDS,
  applyFilters,
  axisLabel,
  cardFacts,
  chipActive,
  chipTitle,
  headerPills,
  restingChips,
  siteChips,
  toggleChip,
  verdictStatus,
  type SiteFilters,
} from "@/components/sites/sites-model";
import { previewUrl } from "@/lib/sites/preview";
import type { SitesSource } from "@/lib/sites/provider";
import { useListKeys } from "@/lib/workspace/keyboard";

/**
 * Sites — STEP 2 of the two-step rebuild: the byte-true port of
 * Sites.dc.html with the real catalog behind it. The sheet owns every band,
 * class and copy grammar; this layer only decides what is TRUE to render:
 *
 *  - the grid is the portfolio the sites origin actually serves, each card
 *    wearing its own hero as the preview shot (media-first) and the sheet's
 *    striped placeholder where a record has no card image. Those heroes are
 *    served SAME-ORIGIN by the workspace's own preview route (s76) — an
 *    absolute origin here is right on the box and broken on every other
 *    machine, which is what the founder saw at s75;
 *  - the state pill says what the catalog RECORDS — the founder's verdict —
 *    because no deploy state exists to call a site "live";
 *  - the category chips are the catalog's own vocabulary (vertical, design
 *    register, build wave) and filter the grid, with the old gallery's facet
 *    behaviour intact behind the sheet's own "More →" chip;
 *  - the build door is not pretended: generation from a prompt isn't wired
 *    to this surface, so the box and button state the seam instead of
 *    offering a dead primary button;
 *  - an unconfigured or unreachable origin is a READ state, never an empty
 *    portfolio, and it names the fix.
 *
 * Keepers woven back in (old-design-keepers, s73 — each a STATE behind
 * byte-true resting chrome, never an extra band):
 *  - the one list keyboard grammar — j/k move · ↵ open — marking the pick
 *    with the sheet's own `.row.sel` accent. Nothing is selected at rest;
 *  - the old card's record line — one-liner, design register, build date —
 *    rests hidden inside the shot and rises on hover / focus / the pick
 *    (founder s75: "there were some good features from the old design").
 */
export function Sites({
  source,
  initialFilters,
}: {
  source: SitesSource;
  /** A deep link from a dossier fact door — `?vertical=`/`?axis=`/`?wave=`. */
  initialFilters?: SiteFilters;
}) {
  const router = useRouter();
  const records = useMemo(
    () => (source.kind === "local" || source.kind === "remote" ? source.records : []),
    [source],
  );

  const [filters, setFilters] = useState<SiteFilters>(initialFilters ?? {});
  // A deep link may pick a chip that rests behind "More →"; open the row so
  // the operator can SEE what is filtering their grid, never a silent slice.
  const [expanded, setExpanded] = useState(
    Boolean(initialFilters?.vertical || initialFilters?.axis || initialFilters?.wave !== undefined),
  );
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const selectedRef = useRef<HTMLAnchorElement | null>(null);

  const chips = useMemo(() => siteChips(records), [records]);
  const shown = useMemo(() => applyFilters(records, filters), [records, filters]);
  const pills = headerPills(records, shown);

  // Derived, not effect-synced: filtering away the selected card simply
  // leaves nothing selected until the operator moves again.
  const selected = selectedSlug && shown.some((r) => r.slug === selectedSlug) ? selectedSlug : null;

  const move = (delta: 1 | -1) => (event: KeyboardEvent) => {
    if (shown.length === 0) return;
    event.preventDefault();
    const current = shown.findIndex((r) => r.slug === selected);
    const next = current === -1 ? 0 : Math.min(Math.max(current + delta, 0), shown.length - 1);
    setSelectedSlug(shown[next].slug);
  };
  useListKeys({
    enabled: true,
    bindings: {
      j: move(1),
      k: move(-1),
      Enter: (event) => {
        if (!selected) return;
        // A focused control owns its own Enter — the chips and the clear
        // button must still act after the operator has moved with j/k.
        if ((event.target as HTMLElement | null)?.closest("button, a")) return;
        event.preventDefault();
        router.push(`/app/sites/${selected}`);
      },
    },
  });
  useEffect(() => {
    selectedRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [selected]);

  // Which five rest is a derivation, not a slice — see `restingChips`: an
  // ACTIVE chip is never off-screen, and the other seats go to the facets that
  // actually cut the portfolio instead of the head of the vertical list.
  const visibleChips = expanded ? chips : restingChips(chips, records, filters);

  return (
    <div className="content sites-surface" style={{ gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h1 className="t-headline">Sites</h1>
        {source.kind === "unconfigured" ? (
          <span className="pill pill-idle">no origin configured</span>
        ) : source.kind === "error" ? (
          <span className="pill pill-err">origin unreachable</span>
        ) : (
          <>
            <span className="pill pill-idle">{pills.built}</span>
            <span className="pill pill-ok">{pills.approved}</span>
          </>
        )}
        <div style={{ flex: 1 }} />
      </div>

      <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            className="prompt-box"
            aria-label="Describe the site to build"
            disabled
            placeholder="A landing page for… describe the business in one line; the engine picks the register."
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled
            title="Building a site from a prompt isn’t wired to this surface yet"
          >
            Build site
          </button>
        </div>
        <span className="t-label">
          Building from a prompt isn’t wired to this surface yet — the portfolio below is what has
          actually been built, and the chips filter it.
        </span>
        {chips.length > 0 && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span className="t-label" style={{ marginRight: 2 }}>
              Or start from the portfolio —
            </span>
            {visibleChips.map((chip) => {
              const on = chipActive(chip, filters);
              return (
                <button
                  key={`${chip.kind}:${chip.value}`}
                  type="button"
                  className={on ? "cat-chip on" : "cat-chip"}
                  aria-pressed={on}
                  // The resting row now mixes kinds by design, so each chip
                  // says which facet it is and how hard it cuts — the row is
                  // no longer readable as "verticals, then registers, then
                  // waves" from position alone.
                  title={chipTitle(records, chip)}
                  onClick={() => setFilters((f) => toggleChip(chip, f))}
                >
                  {chip.label}
                </button>
              );
            })}
            {chips.length > PRIMARY_CHIPS && (
              <button
                type="button"
                className="cat-chip"
                aria-expanded={expanded}
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? "Fewer ←" : "More →"}
              </button>
            )}
          </div>
        )}
      </div>

      {source.kind === "unconfigured" ? (
        <div className="card">
          <div className="row" role="alert">
            <span className="t-label">
              No sites origin is configured — a missing setting, not an empty portfolio. Point{" "}
              <span className="t-data">SITES_BASE_URL</span> at the templates preview service (it
              serves <span className="t-data">/catalog.json</span> beside the sites), or run the
              workspace beside the repo for the local read.
            </span>
          </div>
        </div>
      ) : source.kind === "error" ? (
        <div className="card">
          <div className="row" role="alert">
            <span className="t-label">
              The sites origin did not answer: {source.message} — a read failure, not an empty
              portfolio.
            </span>
          </div>
        </div>
      ) : records.length === 0 ? (
        <div className="card">
          <div className="row">
            <span className="t-label">
              The origin answered with an empty catalog — nothing has been built here yet.
            </span>
          </div>
        </div>
      ) : shown.length === 0 ? (
        <div className="card">
          <div className="row">
            <span className="t-label" style={{ flex: 1 }}>
              No sites match these chips — {records.length} are built, none in this slice.
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFilters({})}>
              Clear filters
            </button>
          </div>
        </div>
      ) : (
        <section className="site-grid" aria-label="Portfolio sites">
          {shown.map((site) => {
            const status = verdictStatus(site);
            const isSelected = site.slug === selected;
            const facts = cardFacts(site);
            return (
              <Link
                key={site.slug}
                ref={isSelected ? selectedRef : undefined}
                href={`/app/sites/${site.slug}`}
                className={isSelected ? "site-card sel" : "site-card"}
                onFocus={() => setSelectedSlug(site.slug)}
              >
                <div className="site-shot">
                  {site.cardImage ? (
                    // eslint-disable-next-line @next/next/no-img-element -- preview media is served by the app's own route, outside the Next image pipeline on purpose
                    <img src={previewUrl(site.cardImage)} alt="" width={640} height={360} loading="lazy" />
                  ) : (
                    <span>site preview · hero</span>
                  )}
                  {/*
                   * The old gallery's per-card record — one-liner, design
                   * register, build date — re-entering as a STATE, not a
                   * band: it rests hidden inside the shot the sheet already
                   * draws, and rises on hover / focus / the keyboard pick.
                   * The card's geometry never changes.
                   */}
                  {(site.oneLiner || facts.length > 0 || site.built) && (
                    <div className="site-cap">
                      {site.oneLiner && <span className="site-line t-label">{site.oneLiner}</span>}
                      {(facts.length > 0 || site.built) && (
                        <div className="site-cap-foot">
                          <span className="t-label subtle">
                            {facts.map((axis) => axisLabel(axis)).join(" · ")}
                          </span>
                          <div style={{ flex: 1 }} />
                          {site.built && <span className="t-data">{site.built}</span>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="site-meta">
                  <span className="site-name" title={site.name}>
                    {site.name}
                  </span>
                  <span className={VERDICT_PILL[status]}>{VERDICT_WORDS[status]}</span>
                  <span className="card-link">Dossier →</span>
                </div>
              </Link>
            );
          })}
        </section>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="t-label">
          Every site carries its record — prompt, plan, mint ledger, verdicts — in its dossier.
        </span>
        <div style={{ flex: 1 }} />
        {(source.kind === "local" || source.kind === "remote") && (
          <span className="t-data">
            {source.kind === "local" ? "local template dir" : "catalog.json"} · previews served by
            the workspace from {source.previewUpstream}
          </span>
        )}
      </div>
    </div>
  );
}
