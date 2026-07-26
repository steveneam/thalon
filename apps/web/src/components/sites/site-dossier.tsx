"use client";

import Link from "next/link";
import { useState } from "react";
import {
  VERDICT_PILL,
  VERDICT_WORDS,
  axisLabel,
  verdictStatus,
  verticalLabel,
} from "@/components/sites/sites-model";
import type { SiteRecord } from "@/lib/sites/catalog";
import { previewUrl, sitePageUrl } from "@/lib/sites/preview";

/**
 * One site's dossier — the case study a prospect conversation reaches for:
 * the page itself, live, beside the record that produced it.
 *
 * THERE IS NO `Site Dossier.dc.html` in the mock, so this is DESIGNED in the
 * sheets' language rather than ported — the s74 Search-tab precedent. The
 * language is unusually literal here, because the mock DOES draw a dossier
 * for the sibling artifact (`Video Dossier.dc.html`): the same headline row
 * with a back door and two actions, the same `.dgrid` of stage-beside-record,
 * the same `.fact-row` record card, the same media `.strip`. A site dossier
 * and a video dossier are one idea about two artifacts, and they now read as
 * the same product. Every atomic is that sheet's, scoped (site-dossier.css).
 *
 * Every capability of the s61 dossier survives — this is a re-expression,
 * not a reduction: the live preview with its desktop/390 toggles, the site
 * record, the manifest's mint facts (dimensions + pinned-hash tails), the
 * /guide links, and the verdict.
 *
 * Honesty rules it keeps:
 *  - the preview is the REAL page, served same-origin by the workspace's own
 *    route (lib/sites/preview.ts), so it renders for a viewer who is not on
 *    the box — the s75 founder report;
 *  - a fact is only a door when it opens something. Vertical, axis and wave
 *    open the portfolio filtered to themselves; the rest are plain rows with
 *    no arrow, because there is nothing behind them to reach;
 *  - the mint strip states its true count, and every tile carries the
 *    pinned-hash tail — the provenance pointer, human-scale. Credits stay on
 *    the page's own /guide (the s61 Q4 ruling), which is one click away.
 */
export function SiteDossier({ site }: { site: SiteRecord }) {
  const [width, setWidth] = useState<"desktop" | "phone">("desktop");
  const status = verdictStatus(site);
  const pageUrl = sitePageUrl(site.slug);
  const guideUrl = sitePageUrl(site.slug, "guide");

  /** The record card's rows. `href` is present only where something opens. */
  const facts: Array<{ key: string; value: string; href?: string; external?: boolean }> = [];
  if (site.vertical) {
    facts.push({
      key: "Vertical",
      value: verticalLabel(site.vertical),
      href: `/app/sites?vertical=${encodeURIComponent(site.vertical)}`,
    });
  }
  if (site.axes.primary) {
    facts.push({
      key: "Primary axis",
      value: axisLabel(site.axes.primary),
      href: `/app/sites?axis=${encodeURIComponent(site.axes.primary)}`,
    });
  }
  if (site.axes.secondary) {
    facts.push({
      key: "Secondary axis",
      value: axisLabel(site.axes.secondary),
      href: `/app/sites?axis=${encodeURIComponent(site.axes.secondary)}`,
    });
  }
  if (site.wave !== undefined) {
    facts.push({ key: "Wave", value: `Wave ${site.wave}`, href: `/app/sites?wave=${site.wave}` });
  }
  if (site.built) facts.push({ key: "Built", value: site.built });
  facts.push({
    key: "Verdict",
    value: site.verdict?.note
      ? `${VERDICT_WORDS[status]} — ${site.verdict.note}`
      : VERDICT_WORDS[status],
  });
  facts.push({
    key: "How it was made",
    value: "the page's own guide — prompts, models, credits",
    href: guideUrl,
    external: true,
  });

  /**
   * The design brief. These four are PROSE — a hundred to three hundred
   * characters each — and the sheet's `.fact-row` is a one-LINE fact
   * ("3 sources · cited verbatim"). Pouring them into the 320px rail would
   * keep the class name and break the density the class exists to hold, so
   * the brief gets its own card in the wide column: same grammar, room to
   * read. Nothing is dropped and nothing is truncated.
   */
  const brief: Array<[string, string]> = [
    ["Axis note", site.axisNote],
    ["Palette seed", site.paletteSeed],
    ["Type", site.typeDirection],
    ["Motion budget", site.motionBudget],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <div className="content site-dossier-surface" style={{ gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link className="card-link" href="/app/sites">
          ← Sites
        </Link>
        <h1 className="t-headline">{site.name}</h1>
        <span className={VERDICT_PILL[status]}>{VERDICT_WORDS[status]}</span>
        <div style={{ flex: 1 }} />
        <a className="btn btn-ghost btn-sm" href={guideUrl} target="_blank" rel="noreferrer">
          How it was made
        </a>
        <a className="btn btn-primary btn-sm" href={pageUrl} target="_blank" rel="noreferrer">
          Open the site
        </a>
      </div>
      {site.oneLiner && (
        <div style={{ display: "flex" }}>
          <span className="t-label">{site.oneLiner}</span>
        </div>
      )}

      <div className="dgrid">
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          <div className="card">
            <div className="card-head" style={{ padding: "9px 16px" }}>
              <span className="t-title">Live preview</span>
              <span className="t-label">the page itself, not a screenshot</span>
              <div style={{ flex: 1 }} />
              <div className="seg">
                {(["desktop", "phone"] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    className={width === w ? "seg-opt on" : "seg-opt"}
                    aria-pressed={width === w}
                    onClick={() => setWidth(w)}
                  >
                    {w === "desktop" ? "Desktop" : "390 px"}
                  </button>
                ))}
              </div>
            </div>
            <div className="stage">
              <iframe
                key={site.slug}
                src={pageUrl}
                title={`${site.name} — live preview`}
                className={width === "phone" ? "stage-frame phone" : "stage-frame"}
                // Served from the workspace's own origin, so the frame is
                // sandboxed OUT of it: scripts run (the pages carry real
                // motion), but the document sits in an opaque origin and can
                // never reach the workspace around it. It matters more later
                // than now — these pages are hand-built today and generated
                // per tenant once B-sitegen lands.
                sandbox="allow-scripts"
              />
            </div>
          </div>

          {brief.length > 0 && (
            <div className="card">
              <div className="card-head" style={{ padding: "9px 16px" }}>
                <span className="t-title">The design brief</span>
                <span className="t-label">what the engine was aiming at, in its own words</span>
              </div>
              {brief.map(([key, value]) => (
                <div className="brief-row" key={key}>
                  <span className="t-label">{key}</span>
                  <span className="t-body muted">{value}</span>
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <div className="card-head" style={{ padding: "9px 16px" }}>
              <span className="t-title">Minted assets</span>
              <span className="t-label">
                {site.assets.length === 0
                  ? "none on the manifest — this page draws everything in code"
                  : `${site.assets.length} · each a deterministic derive of a pinned original`}
              </span>
            </div>
            {site.assets.length > 0 && (
              <div className="strip">
                {site.assets.map((asset) => (
                  <div className="clipcard" key={asset.file}>
                    <div className="thumb-md">
                      {/* eslint-disable-next-line @next/next/no-img-element -- preview media is served by the app's own route, outside the Next image pipeline on purpose */}
                      <img
                        src={previewUrl(`${site.slug}/assets/${asset.file}`)}
                        alt=""
                        width={148}
                        height={92}
                        loading="lazy"
                      />
                    </div>
                    <div>
                      <div className="clip-cap" title={asset.file}>
                        {asset.file}
                      </div>
                      <div className="clip-kind">
                        {asset.width}×{asset.height} · …{asset.hashTail}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-head">
            <span className="t-title">The record</span>
            <span className="t-label">the arrows are doors</span>
          </div>
          {facts.map((fact) => {
            const body = (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="fact-k">{fact.key}</div>
                <div className="fact-v">{fact.value}</div>
              </div>
            );
            if (!fact.href) return <div className="fact-row" key={fact.key}>{body}</div>;
            return fact.external ? (
              <a className="fact-row" href={fact.href} target="_blank" rel="noreferrer" key={fact.key}>
                {body}
                <span className="tile-arrow">↗</span>
              </a>
            ) : (
              <Link className="fact-row" href={fact.href} key={fact.key}>
                {body}
                <span className="tile-arrow">→</span>
              </Link>
            );
          })}
          <div style={{ padding: "10px 14px", borderTop: "1px solid var(--n-400)" }}>
            <span className="t-label">
              Every file is a deterministic derive of a pinned original — model, prompt and credits
              stay on the page&apos;s own guide, which tells the honest story.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
