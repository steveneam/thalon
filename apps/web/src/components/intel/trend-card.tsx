"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, FileText, Globe, Video, X } from "lucide-react";
import { HeatGrade } from "@/components/intel/heat-grade";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import type { CreateFamily, TrendCard as TrendCardData } from "@/lib/intel/types";
import { timeAgo } from "@/lib/workspace/format";
import { cn } from "@/lib/utils";

export interface TrendPromotePick {
  family: CreateFamily;
  titleIndex: number;
  angleIndex: number;
}

interface TrendCardProps {
  card: TrendCardData;
  busy: boolean;
  onPromote: (cardId: string, pick: TrendPromotePick) => void;
  onDismiss: (cardId: string) => void;
}

const EXITS: Array<{ family: CreateFamily; label: string; icon: typeof Video }> = [
  { family: "video", label: "Video", icon: Video },
  { family: "post", label: "Post", icon: FileText },
  { family: "page", label: "Page", icon: Globe },
];

function pct(ratio: number | null): string {
  return ratio === null ? "–" : `${(ratio * 100).toFixed(1)}%`;
}

/**
 * One ranked item as a DOSSIER + LAUNCHPAD (wave-3, workspace-ux-v2.md §3):
 * outlier badge, WHY it's rising (reason strings verbatim), engagement
 * ratios — plus ready titles/angles/hook and per-family exits. The selected
 * title/angle ride the promote capture, so Create opens pre-filled and the
 * operator never retypes what intel already knew.
 */
export function TrendCard({ card, busy, onPromote, onDismiss }: TrendCardProps) {
  const [titleIndex, setTitleIndex] = useState(0);
  const [angleIndex, setAngleIndex] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);

  function copy(key: string, text: string) {
    void navigator.clipboard?.writeText(text);
    setCopied(key);
  }

  return (
    <Card data-testid={`trend-card-${card.id}`} className="gap-3">
      <CardHeader className="flex-row flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-mono">{card.source}</Badge>
        <span className="text-xs text-muted-foreground">@{card.account}</span>
        <time dateTime={card.publishedAt} className="text-xs text-muted-foreground">
          {timeAgo(card.publishedAt)}
        </time>
        <span className="ml-auto flex items-center gap-2">
          {card.isOutlier && <Badge variant="signal">outlier</Badge>}
          <HeatGrade score={card.score} />
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm leading-snug">
          {card.text}
          {card.url && (
            <a
              href={card.url}
              target="_blank"
              rel="noreferrer"
              aria-label="Open the original item"
              className="ml-1.5 inline-flex align-middle text-muted-foreground hover:text-primary"
            >
              <ExternalLink aria-hidden className="size-3.5" />
            </a>
          )}
        </p>
        <dl className="u-tabular flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <div className="flex gap-1.5">
            <dt>shares/views</dt>
            <dd className="font-medium text-foreground">{pct(card.shareToView)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>bookmarks/views</dt>
            <dd className="font-medium text-foreground">{pct(card.bookmarkToView)}</dd>
          </div>
          {typeof card.metrics.views === "number" && (
            <div className="flex gap-1.5">
              <dt>views</dt>
              <dd className="font-medium text-foreground">{card.metrics.views.toLocaleString()}</dd>
            </div>
          )}
        </dl>
        <div>
          <p className="u-eyebrow mb-1 text-muted-foreground">why it&rsquo;s rising · {card.areaName}</p>
          <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
            {card.reasons.map((reason) => (
              <li key={reason} className="border-l-2 border-signal/50 pl-2">
                {reason}
              </li>
            ))}
          </ul>
        </div>

        {/* The dossier: ready-to-fire creative context. Selection is the
            smart default at the seam — whatever is selected rides the exit. */}
        <details className="group rounded-lg border border-border">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted [&::-webkit-details-marker]:hidden">
            <span className="u-eyebrow text-muted-foreground">dossier</span>
            {card.dossier.titles.length} titles · {card.dossier.angles.length} angles · hook
            <span aria-hidden className="ml-auto text-muted-foreground transition-transform group-open:rotate-90">
              ›
            </span>
          </summary>
          <div className="flex flex-col gap-3 border-t border-border px-3 py-3">
            <div role="radiogroup" aria-label="Ready titles" className="flex flex-col gap-1">
              <p className="u-eyebrow text-muted-foreground">titles — pick one, it rides the exit</p>
              {card.dossier.titles.map((title, i) => (
                <div key={title} className="flex items-start gap-1.5">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={titleIndex === i}
                    onClick={() => setTitleIndex(i)}
                    className={cn(
                      "flex-1 rounded-md border px-2 py-1.5 text-left text-xs transition-colors",
                      "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      titleIndex === i
                        ? "border-primary/50 bg-primary/10 font-medium"
                        : "border-transparent hover:bg-muted",
                    )}
                  >
                    {title}
                  </button>
                  <button
                    type="button"
                    aria-label={`Copy title: ${title}`}
                    onClick={() => copy(`title-${i}`, title)}
                    className="mt-1 rounded-md p-1 text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
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
            <div role="radiogroup" aria-label="Suggested angles" className="flex flex-col gap-1">
              <p className="u-eyebrow text-muted-foreground">angles</p>
              {card.dossier.angles.map((angle, i) => (
                <button
                  key={angle}
                  type="button"
                  role="radio"
                  aria-checked={angleIndex === i}
                  onClick={() => setAngleIndex(i)}
                  className={cn(
                    "rounded-md border px-2 py-1.5 text-left text-xs transition-colors",
                    "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    angleIndex === i
                      ? "border-primary/50 bg-primary/10 font-medium"
                      : "border-transparent hover:bg-muted",
                  )}
                >
                  {angle}
                </button>
              ))}
            </div>
            <div>
              <p className="u-eyebrow text-muted-foreground">hook</p>
              <p className="mt-1 flex items-start gap-1.5 text-xs italic">
                <span className="flex-1">&ldquo;{card.dossier.hook}&rdquo;</span>
                <button
                  type="button"
                  aria-label="Copy hook"
                  onClick={() => copy("hook", card.dossier.hook)}
                  className="rounded-md p-1 not-italic text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
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
        </details>
      </CardContent>
      <CardFooter className="flex-wrap gap-2">
        {/* Per-family exits — three doors, one capture spine. */}
        {EXITS.map(({ family, label, icon: Icon }) => (
          <Button
            key={family}
            size="sm"
            variant="outline"
            disabled={busy}
            aria-label={`Create ${family} from this`}
            onClick={() => onPromote(card.id, { family, titleIndex, angleIndex })}
          >
            <Icon aria-hidden data-icon="inline-start" /> → {label}
          </Button>
        ))}
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => onDismiss(card.id)} className="ml-auto">
          <X aria-hidden data-icon="inline-start" /> Dismiss
        </Button>
      </CardFooter>
    </Card>
  );
}
