"use client";

import { useState } from "react";
import type { DossierView } from "@/components/intel/intel-model";
import { SourceThumb } from "@/components/media/source-thumb";
import { isGenerable, leadingExit } from "@/lib/create/families";
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
  // angle is the operator's optional extra, so unpicked stays unmarked AND
  // rides as nothing. The seam used to default an absent angle to the first
  // entry, which made this card's own "ride without an angle" a lie
  // (lib/intel/store `pickOptional`); the mark means "you chose this", and
  // no mark now genuinely means no angle.
  const [angleIndex, setAngleIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  /**
   * "copied" must MEAN copied (s100 gate). This fired the write and reported
   * success in the same breath — the promise was never awaited and
   * `navigator.clipboard?.` swallows the whole call when the API is absent, so
   * the word appeared just as confidently over an insecure origin, a denied
   * permission, or no clipboard at all. An operator then pastes the previous
   * thing they copied and never learns why.
   *
   * The word now follows the write. A failure says so at the same control,
   * with the text still selectable on the row above.
   */
  async function copy(key: string, text: string) {
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(text);
      setCopied(key);
    } catch {
      setCopied(`failed-${key}`);
    }
    // The one copy-feedback grammar: the word swaps back on its own.
    window.setTimeout(
      () => setCopied((current) => (current === key || current === `failed-${key}` ? null : current)),
      1500,
    );
  }

  /** What a copy control renders: its own outcome, never a shared one. */
  function copyWord(key: string): string {
    if (copied === key) return "copied";
    if (copied === `failed-${key}`) return "couldn’t copy";
    return "copy";
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

  /*
   * THE DOOR KNOWS WHERE IT LANDS. The dossier's editorial suggestion is
   * kept exactly as it was — including its reason — but it only gets the
   * PRIMARY slot when Create can actually generate that family. On today's
   * data every demo card is Bluesky-sourced, so `post` was suggested on all
   * of them and the flagship path's most emphatic button landed on a
   * disabled Generate (s77 blocker, reproduced live s79).
   *
   * All three exits stay one click and all three still promote — the
   * capture is worth recording either way, and the family stays changeable
   * at Create. What changes is which one is recommended, and that a shut
   * destination now says so at the control instead of at the far end.
   */
  const leading = leadingExit(card.suggested.family, EXITS);
  const rest = EXITS.filter((family) => family !== leading);
  const suggestionIsShut = leading !== card.suggested.family;
  /** Named in the footer so the shut exits state themselves, not only in a title. */
  const shutExits = EXITS.filter((family) => !isGenerable(family));

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
            <h2 className="dossier-h" title={card.fullText}>
              {card.headline}
            </h2>
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
            {/*
              THE BAR IS THE ONLY PLACE THE MAGNITUDE LIVES, and to a screen
              reader it was nothing at all (s100 gate): a bare `<div>` whose
              width was the whole message, with the full sentence hidden in a
              `title` that only a mouse can reach. The row now carries its own
              name and value — the reason, the magnitude, and the verbatim
              sentence the sighted operator gets on hover — so the ranking's
              explanation is not mouse-only.
            */}
            {card.reasons.map((reason) => (
              <div
                className="reason"
                key={reason.title}
                title={reason.title}
                role="group"
                aria-label={`${reason.name}: ${reason.text}. ${reason.title}`}
              >
                <span className="rname">{reason.name}</span>
                <div
                  className="bar-trough"
                  role="meter"
                  aria-valuenow={Math.round(reason.percent)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${reason.name} strength`}
                >
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
            {/*
              ATTRIBUTION, because every one of these lines is MACHINE-WRITTEN
              and nothing said so (s100 gate). The headline above is the
              source's own words and is provenanced down to the account; the
              titles, angles and hook beside it are generated, and the operator
              was left to tell them apart by feel. The repo's standing rule is
              that machine-authored text names its author (the s99 videos round
              — "model unrecorded" rather than "by you"), and this column was
              the one place on Intel it did not.
            */}
            {(card.titles.length > 0 || card.angles.length > 0) && (
              <span className="t-label">
                Written for you from the item above — yours to edit at Create.
              </span>
            )}
            {card.titles.length === 0 && card.angles.length === 0 ? (
              /*
                No dossier — and this line used to name ONE cause it cannot
                know (s100 gate). A card arrives dossier-less for at least
                three reasons: generation is not armed, the model failed after
                its retries, or the DENYLIST dropped the whole dossier — and
                the last is a judge verdict being reported to the operator as
                a billing problem. `generateDossiers` records the real reason
                in its `failed` list; nothing carries it to the wire, so the
                card genuinely does not know which happened.
                Until the reason rides along (recorded on the ledger row as
                the real remedy), the copy states what IS true and stops
                asserting a cause.
              */
              <span className="t-label">
                No ready titles or angles for this card — the exits below still carry this item’s
                full context into Create.
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
                        {copyWord(`title-${i}`)}
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
                        {copyWord(`angle-${i}`)}
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
                  {copyWord("hook")}
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
            title={
              suggestionIsShut
                ? `${card.suggested.reason} — but ${card.suggested.family} generation isn’t wired at Create yet, so ${leading} leads here.`
                : card.suggested.reason
            }
            disabled={busy || !onPromote}
            onClick={() =>
              onPromote?.(card.id, {
                family: leading,
                titleIndex: safeTitleIndex,
                angleIndex: safeAngleIndex ?? undefined,
              })
            }
          >
            Create {leading}
            {suggestionIsShut ? "" : " · suggested"}
          </button>
          {rest.map((family) => (
            <button
              key={family}
              type="button"
              className="btn btn-ghost"
              // The demoted suggestion keeps its word AND its reason — the
              // editorial advice is not lost, it just no longer wears the
              // primary slot while its destination refuses to run.
              title={family === card.suggested.family ? card.suggested.reason : undefined}
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
              {family === card.suggested.family ? " · suggested" : ""}
            </button>
          ))}
          <span className="t-label" style={{ marginLeft: 6 }}>
            the pick rides along — title, angle, hook, source
            {shutExits.length > 0 &&
              ` · ${shutExits.join(" and ")} generation isn’t wired at Create yet — the capture still rides`}
          </span>
          <div style={{ flex: 1 }} />
        </div>
      </div>
    </section>
  );
}
