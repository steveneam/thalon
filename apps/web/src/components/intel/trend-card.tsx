"use client";

import { useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { HeatGrade } from "@/components/intel/heat-grade";
import { compactCount, freshnessStamp, suggestedExit } from "@/components/intel/launchpad";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CreateFamily, TrendCard as TrendCardData } from "@/lib/intel/types";
import { timeAgo } from "@/lib/workspace/format";
import { SELECTED_ROW } from "@/lib/workspace/selected-row";
import { cn } from "@/lib/utils";

export interface TrendPromotePick {
  family: CreateFamily;
  titleIndex: number;
  angleIndex: number;
}

interface TrendCardProps {
  card: TrendCardData;
  /** Checkbox multi-select for bulk Dismiss (FRONTEND §0 parity, s40). */
  selected: boolean;
  /** The keyboard cursor rests here (j/k) — worn as a focus-style ring. */
  cursor: boolean;
  busy: boolean;
  onSelect: (cardId: string, selected: boolean) => void;
  onPromote: (cardId: string, pick: TrendPromotePick) => void;
  onDismiss: (cardId: string) => void;
}

const EXITS: Array<{ family: CreateFamily; label: string }> = [
  { family: "video", label: "Video" },
  { family: "post", label: "Post" },
  { family: "page", label: "Page" },
];

/**
 * The EXPANDED dossier card — the launchpad (Phase D design #4, ux-v2 §1/§3
 * made concrete): heat + outlier + honest freshness stamp, provenance with
 * the original link, why-it's-moving (ranker reason strings VERBATIM — the
 * wire type carries no prose paragraph, and invented prose would violate the
 * honest-claims rule), ready titles with copy buttons, angles, one hook —
 * then the three per-family exits with a "suggested" pre-pick (word +
 * heavier border, never color-alone, never a gate). Whatever title/angle is
 * picked rides the promote capture: Create receives the capture id, not a
 * query-string prompt, and the operator never retypes context.
 *
 * Bounds (design #4): titles cap at 4 and angles at 3 in the wire type;
 * more lives nowhere — the card is a launchpad, not an archive.
 */
export function TrendCard({ card, selected, cursor, busy, onSelect, onPromote, onDismiss }: TrendCardProps) {
  const [titleIndex, setTitleIndex] = useState(0);
  const [angleIndex, setAngleIndex] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  // Const binding so the dossier narrowing survives into JSX callbacks.
  const dossier = card.dossier;
  const suggested = suggestedExit(card);
  const freshness = freshnessStamp(card);
  const views = card.metrics.views;

  function copy(key: string, text: string) {
    void navigator.clipboard?.writeText(text);
    setCopied(key);
    // Same feedback grammar as the Library copy button: the check resets.
    window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1500);
  }

  return (
    <div
      data-testid={`trend-card-${card.id}`}
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-primary/50 bg-card p-4",
        cursor && "ring-3 ring-ring/50",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="checkbox"
          aria-label={`Select trend from @${card.account}`}
          checked={selected}
          onChange={(e) => onSelect(card.id, e.target.checked)}
          className="size-4 accent-primary"
        />
        <HeatGrade score={card.score} />
        {card.isOutlier && <Badge variant="signal">outlier</Badge>}
        {freshness && <span className="u-eyebrow text-muted-foreground">{freshness}</span>}
        <span className="u-eyebrow ml-auto text-muted-foreground">#{card.id}</span>
      </div>

      <h2 className="text-base leading-snug font-semibold">{card.text}</h2>

      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
        <span>@{card.account}</span>
        {typeof views === "number" && (
          <>
            <span aria-hidden>·</span>
            <span className="u-tabular">{compactCount(views)} views</span>
          </>
        )}
        <span aria-hidden>·</span>
        <time dateTime={card.publishedAt}>{timeAgo(card.publishedAt)}</time>
        {card.url && (
          <>
            <span aria-hidden>·</span>
            <a
              href={card.url}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              original post ↗
            </a>
          </>
        )}
        <span aria-hidden>·</span>
        <span>area: {card.areaName}</span>
        <Badge variant="outline" className="font-mono">{card.source}</Badge>
      </p>

      <div>
        <p className="u-eyebrow mb-1 text-muted-foreground">why it&rsquo;s moving</p>
        <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          {card.reasons.map((reason) => (
            <li key={reason} className="flex items-baseline gap-1.5">
              <span aria-hidden className="size-1 shrink-0 self-center rounded-full bg-signal/70" />
              {reason}
            </li>
          ))}
        </ul>
      </div>

      {/* Live cards carry no dossier until title/angle generation arms
          (gateway top-up) — the honest note renders instead, never
          fabricated titles. */}
      {!dossier && (
        <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          Ready titles &amp; angles arm with the gateway top-up — the exits below still carry this
          item&rsquo;s full context into Create.
        </p>
      )}
      {dossier && (
        <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <div role="radiogroup" aria-label="Ready titles" className="flex flex-col gap-1">
            <p className="u-eyebrow text-muted-foreground">
              ready titles · {dossier.titles.length} — the pick rides the exit
            </p>
            {dossier.titles.map((title, i) => (
              <div
                key={title}
                className={cn(
                  "flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 transition-colors hover:border-primary",
                  titleIndex === i && SELECTED_ROW,
                )}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={titleIndex === i}
                  onClick={() => setTitleIndex(i)}
                  className={cn(
                    "min-w-0 flex-1 text-left text-xs",
                    titleIndex === i && "font-medium",
                    "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  )}
                >
                  {title}
                </button>
                <button
                  type="button"
                  aria-label={`Copy title: ${title}`}
                  onClick={() => copy(`title-${i}`, title)}
                  className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {copied === `title-${i}` ? (
                    <Check aria-hidden className="size-3.5" />
                  ) : (
                    <Copy aria-hidden className="size-3.5" />
                  )}
                </button>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3">
            <div role="radiogroup" aria-label="Suggested angles" className="flex flex-col gap-1">
              <p className="u-eyebrow text-muted-foreground">angles · {dossier.angles.length}</p>
              {dossier.angles.map((angle, i) => (
                <button
                  key={angle}
                  type="button"
                  role="radio"
                  aria-checked={angleIndex === i}
                  onClick={() => setAngleIndex(i)}
                  className={cn(
                    "flex items-baseline gap-1.5 rounded-md border border-transparent px-2 py-1 text-left text-xs transition-colors hover:bg-muted",
                    angleIndex === i && cn(SELECTED_ROW, "font-medium"),
                    "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  )}
                >
                  <span aria-hidden>•</span>
                  {angle}
                </button>
              ))}
            </div>
            <div>
              <p className="u-eyebrow text-muted-foreground">hook</p>
              <p className="mt-1 flex items-start gap-1.5 text-xs italic">
                <span className="flex-1">&ldquo;{dossier.hook}&rdquo;</span>
                <button
                  type="button"
                  aria-label="Copy hook"
                  onClick={() => copy("hook", dossier.hook)}
                  className="rounded-md p-1 text-muted-foreground not-italic transition-colors hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {copied === "hook" ? (
                    <Check aria-hidden className="size-3.5" />
                  ) : (
                    <Copy aria-hidden className="size-3.5" />
                  )}
                </button>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Per-family exits — three doors, one capture spine. The suggested
          door wears word + heavier border (a default, not a gate). */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <span className="u-eyebrow text-muted-foreground">one-click exits — context rides along</span>
        {EXITS.map(({ family, label }) => {
          const isSuggested = family === suggested.family;
          return (
            <Button
              key={family}
              size="sm"
              variant="outline"
              disabled={busy}
              aria-label={`Create ${family} from this${isSuggested ? " — suggested" : ""}`}
              title={isSuggested ? suggested.reason : undefined}
              onClick={() => onPromote(card.id, { family, titleIndex, angleIndex })}
              className={cn(
                "border-primary/50 text-primary hover:bg-primary/5 hover:text-primary",
                isSuggested && "border-2 border-primary font-semibold",
              )}
            >
              → {label}
              {isSuggested && <span className="font-normal"> · suggested</span>}
            </Button>
          );
        })}
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => onDismiss(card.id)}
          className="ml-auto text-muted-foreground"
        >
          <X aria-hidden data-icon="inline-start" /> Dismiss
        </Button>
      </div>
    </div>
  );
}
