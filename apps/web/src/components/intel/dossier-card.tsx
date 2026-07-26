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

  /*
   * Defence in depth behind the `key` the caller now passes. A pick must never
   * ride as an index the card does not have, so both are clamped to THIS
   * card's lists at render: an out-of-range title falls back to the first (one
   * always rides, as the label promises) and an out-of-range angle falls back
   * to none (an angle is optional, so "none" is its honest default).
   */
  const safeTitleIndex = titleIndex >= 0 && titleIndex < card.titles.length ? titleIndex : 0;
  const safeAngleIndex =
    angleIndex !== null && angleIndex >= 0 && angleIndex < card.angles.length ? angleIndex : null;

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
                {/*
                  The two groups are DIFFERENT things and the sheet let colour
                  plus an "Angle · " prefix carry that difference — which works
                  at the canvas fixture's 2 titles + 1 angle and collapses at
                  the real 4 + 3, where it reads as seven near-identical rows.
                  Founder, s77: "why is there 2 selections? whats the
                  difference?" So each group states what it is and whether it
                  is required, in the sheet's own .sec-label grammar. Colour is
                  no longer doing a heading's job.
                */}
                <span className="pick-group-label">Title · one always rides</span>
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
                        aria-checked={safeTitleIndex === i}
                        className="pick-hit"
                        onClick={() => setTitleIndex(i)}
                      >
                        <span className={safeTitleIndex === i ? "radio on" : "radio"} aria-hidden />
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
                <span className="pick-group-label">Angle · optional</span>
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
                        aria-checked={safeAngleIndex === i}
                        className="pick-hit"
                        // An angle is the operator's OPTIONAL extra, which
                        // this component already said in prose and did not
                        // honour: once picked there was no way back to
                        // unpicked, so "the mark means you chose this" became
                        // unfalsifiable. Clicking the marked angle clears it
                        // (founder s77: "the buttons cant be deselected").
                        // Titles deliberately do NOT toggle — a title always
                        // rides, so exactly one is always marked.
                        title={safeAngleIndex === i ? "Click again to ride without an angle" : undefined}
                        onClick={() => setAngleIndex(safeAngleIndex === i ? null : i)}
                      >
                        <span className={safeAngleIndex === i ? "radio on" : "radio"} aria-hidden />
                        <span style={{ flex: 1 }}>{angle}</span>
                      </button>
                      {/*
                        Angles had no copy while titles and the hook did, with
                        no stated reason (founder s77: "why does some sentences
                        have copy button next to it and some dont?"). The
                        rationale was real but invisible — a title and a hook
                        are finished text, an angle is an instruction to the
                        generator. Invisible consistency rules read as bugs, and
                        an operator may well want to paste an angle into a
                        brief, so the row gets the same affordance.
                      */}
                      <button
                        type="button"
                        className="copy-ico"
                        aria-label={`Copy angle: ${angle}`}
                        onClick={() => copy(`angle-${i}`, angle)}
                      >
                        {copied === `angle-${i}` ? "copied" : "copy"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/*
              The hook is the THIRD thing in this section and the only one that
              is not a choice: there is exactly one and it always rides (the
              footer's "title, angle, hook, source" includes it
              unconditionally), which is why it carries copy but no radio.
              Founder, s77: "why is there a copy button next to [the hook] when
              that sentence has no selection?" — the answer was right, the UI
              just never said it. It now names itself like the two groups above,
              so a row without a picker reads as deliberate rather than broken.
            */}
            {card.hook && <span className="pick-group-label">Hook · always rides</span>}
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
                titleIndex: safeTitleIndex,
                angleIndex: safeAngleIndex ?? undefined,
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
                onPromote?.(card.id, {
                  family,
                  titleIndex: safeTitleIndex,
                  angleIndex: safeAngleIndex ?? undefined,
                })
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
