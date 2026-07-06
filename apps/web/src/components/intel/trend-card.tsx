"use client";

import { ExternalLink, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import type { TrendCard as TrendCardData } from "@/lib/intel/types";
import { timeAgo } from "@/lib/workspace/format";

interface TrendCardProps {
  card: TrendCardData;
  busy: boolean;
  onPromote: (cardId: string) => void;
  onDismiss: (cardId: string) => void;
}

function pct(ratio: number | null): string {
  return ratio === null ? "–" : `${(ratio * 100).toFixed(1)}%`;
}

/** One ranked item: outlier badge, WHY it's rising (reason strings verbatim), engagement ratios, act-on-it buttons. */
export function TrendCard({ card, busy, onPromote, onDismiss }: TrendCardProps) {
  return (
    <Card data-testid={`trend-card-${card.id}`} className="gap-3">
      <CardHeader className="flex-row flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-mono">{card.source}</Badge>
        <span className="text-xs text-muted-foreground">@{card.account}</span>
        <time dateTime={card.publishedAt} className="text-xs text-muted-foreground">
          {timeAgo(card.publishedAt)}
        </time>
        <span className="ml-auto flex items-center gap-2">
          {card.isOutlier && <Badge>outlier</Badge>}
          <span className="u-tabular text-xs text-muted-foreground" title="Rank score for this area (0–1)">
            score {card.score.toFixed(2)}
          </span>
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
              <li key={reason} className="border-l-2 border-primary/40 pl-2">
                {reason}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button size="sm" disabled={busy} onClick={() => onPromote(card.id)}>
          <Sparkles aria-hidden data-icon="inline-start" /> Generate from this
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => onDismiss(card.id)}>
          <X aria-hidden data-icon="inline-start" /> Dismiss
        </Button>
      </CardFooter>
    </Card>
  );
}
