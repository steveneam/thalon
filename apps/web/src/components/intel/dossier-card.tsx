"use client";

import { useState } from "react";
import type { DossierView } from "@/components/intel/intel-model";
import { SourceThumb } from "@/components/media/source-thumb";
import type { CreateFamily } from "@/lib/intel/types";

/** The three per-family exits, in the sheet's order; the suggested one leads as the primary. */
const EXITS: CreateFamily[] = ["video", "post", "page"];

export interface DossierPick {
  family: CreateFamily;
  titleIndex: number;
  /** Absent when the operator picked no angle — the seam's own default fills it. */
  angleIndex?: number;
}

/**
 * The expanded dossier card, ported 1:1 from Intel.dc.html: the thermal head
 * (word-in-pill + magnitude bar + outlier + the catchable stamp + Dismiss),
 * the headline × provenance × media band, the two-column "Why it's moving" /
 * "Ready to create" grid, and the exits footer where the pick rides along.
 * Presentation only — every door is the caller's handler, so the capture
 * spine (promote/dismiss → create ctx) stays in one place.
 */
export function DossierCard({
  card,
  busy,
  onDismiss,
  onPromote,
}: {
  card: DossierView;
  busy?: boolean;
  onDismiss?: (cardId: string) => void;
  onPromote?: (cardId: string, pick: DossierPick) => void;
}) {
  const [titleIndex, setTitleIndex] = useState(0);
  // The sheet marks the first TITLE and leaves the angle rows unmarked: an
  // angle is the operator's optional extra, and the promote seam owns the
  // "first entry" default (lib/intel/store PromotePick). Unpicked stays
  // unmarked — the mark means "you chose this", never "something rides".
  const [angleIndex, setAngleIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function copy(key: string, text: string) {
    void navigator.clipboard?.writeText(text);
    setCopied(key);
    // The one copy-feedback grammar: the word swaps back on its own.
    window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1500);
  }

  const rest = EXITS.filter((family) => family !== card.suggested.family);

  return (
    <section className="card" aria-label="Top rising trend">
      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className={`pill ${card.band.pill}`}>{card.band.word}</span>
          <div className="heat-bar" title={card.scoreTitle}>
            <div
              className="bar-fill"
              style={{ width: `${card.percent}%`, background: card.band.fill }}
            />
          </div>
          {card.isOutlier && (
            <span
              className="pill"
              style={{ border: "1px solid var(--heat-rising)", color: "var(--heat-rising)" }}
            >
              Outlier
            </span>
          )}
          {card.freshness && <span className="t-label">{card.freshness}</span>}
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            disabled={busy || !onDismiss}
            onClick={() => onDismiss?.(card.id)}
          >
            Dismiss
          </button>
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <h2 className="dossier-h">{card.headline}</h2>
            <div className="prov">
              <span style={{ fontWeight: 500, color: "var(--n-1000)" }}>@{card.prov.account}</span>
              {card.prov.views && (
                <>
                  <span aria-hidden>·</span>
                  <span>{card.prov.views}</span>
                </>
              )}
              <span aria-hidden>·</span>
              <span>{card.prov.age}</span>
              <span aria-hidden>·</span>
              <span>{card.prov.sourceLabel}</span>
              {card.prov.url && (
                <>
                  <span aria-hidden>·</span>
                  <a href={card.prov.url} target="_blank" rel="noreferrer">
                    Original post ↗
                  </a>
                </>
              )}
              <span aria-hidden>·</span>
              <span>{card.prov.areaName}</span>
            </div>
          </div>
          {/* Media-first, through the one component (B-media.0): the driver's
              captured thumbnail, the striped box when it honestly had none. */}
          <SourceThumb resolution={card.media} legend={card.thumbLabel} size="md" />
        </div>

        <div
          className="dossier-cols"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <span className="sec-label">Why it’s moving</span>
            {card.reasons.map((reason) => (
              <div className="reason" key={reason.title} title={reason.title}>
                <span className="rname">{reason.name}</span>
                <div className="bar-trough">
                  <div
                    className="bar-fill"
                    style={{ width: `${reason.percent}%`, background: reason.heat }}
                  />
                </div>
                <span className="rtext">{reason.text}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="sec-label">Ready to create</span>
            {card.titles.length === 0 && card.angles.length === 0 ? (
              // Live cards carry no dossier until title/angle generation arms —
              // the honest note renders instead, never fabricated titles.
              <span className="t-label">
                Ready titles &amp; angles arm with the gateway top-up — the exits below still carry
                this item’s full context into Create.
              </span>
            ) : (
              <div className="pick-rows" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div
                  role="radiogroup"
                  aria-label="Ready titles"
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  {card.titles.map((title, i) => (
                    <div className="pick-row" key={title}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={titleIndex === i}
                        className="pick-hit"
                        onClick={() => setTitleIndex(i)}
                      >
                        <span className={titleIndex === i ? "radio on" : "radio"} aria-hidden />
                        <span style={{ flex: 1 }}>{title}</span>
                      </button>
                      <button
                        type="button"
                        className="copy-ico"
                        aria-label={`Copy title: ${title}`}
                        onClick={() => copy(`title-${i}`, title)}
                      >
                        {copied === `title-${i}` ? "copied" : "copy"}
                      </button>
                    </div>
                  ))}
                </div>
                <div
                  role="radiogroup"
                  aria-label="Suggested angles"
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  {card.angles.map((angle, i) => (
                    <div className="pick-row" key={angle} style={{ color: "var(--n-900)" }}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={angleIndex === i}
                        className="pick-hit"
                        // An angle is the operator's OPTIONAL extra, which
                        // this component already said in prose and did not
                        // honour: once picked there was no way back to
                        // unpicked, so "the mark means you chose this" became
                        // unfalsifiable. Clicking the marked angle clears it
                        // (founder s77: "the buttons cant be deselected").
                        // Titles deliberately do NOT toggle — a title always
                        // rides, so exactly one is always marked.
                        title={angleIndex === i ? "Click again to ride without an angle" : undefined}
                        onClick={() => setAngleIndex(angleIndex === i ? null : i)}
                      >
                        <span className={angleIndex === i ? "radio on" : "radio"} aria-hidden />
                        <span style={{ flex: 1 }}>Angle · {angle}</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {card.hook && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 13,
                  fontStyle: "italic",
                  color: "var(--n-900)",
                  paddingTop: 2,
                }}
              >
                <span style={{ flex: 1 }}>“{card.hook}”</span>
                <button
                  type="button"
                  className="copy-ico"
                  style={{ fontStyle: "normal" }}
                  aria-label="Copy hook"
                  onClick={() => copy("hook", card.hook ?? "")}
                >
                  {copied === "hook" ? "copied" : "copy"}
                </button>
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            borderTop: "1px solid var(--n-400)",
            marginTop: 2,
            paddingTop: 14,
          }}
        >
          <button
            type="button"
            className="btn btn-primary"
            title={card.suggested.reason}
            disabled={busy || !onPromote}
            onClick={() =>
              onPromote?.(card.id, {
                family: card.suggested.family,
                titleIndex,
                angleIndex: angleIndex ?? undefined,
              })
            }
          >
            Create {card.suggested.label} · suggested
          </button>
          {rest.map((family) => (
            <button
              key={family}
              type="button"
              className="btn btn-ghost"
              disabled={busy || !onPromote}
              onClick={() =>
                onPromote?.(card.id, { family, titleIndex, angleIndex: angleIndex ?? undefined })
              }
            >
              {family === "video" ? "Video" : family === "post" ? "Post" : "Page"}
            </button>
          ))}
          <span className="t-label" style={{ marginLeft: 6 }}>
            the pick rides along — title, angle, hook, source
          </span>
          <div style={{ flex: 1 }} />
        </div>
      </div>
    </section>
  );
}
