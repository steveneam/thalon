"use client";

import { Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import type { HorizonCard as HorizonCardData } from "@/lib/intel/types";

interface HorizonCardProps {
  card: HorizonCardData;
  busy: boolean;
  onTarget: (query: string) => void;
}

function fmt(value: number | null, digits = 2): string {
  return value === null ? "–" : value.toFixed(digits);
}

/** One (query × page) series: position × rising impressions × CTR shortfall, reasons verbatim from the math. */
export function HorizonCard({ card, busy, onTarget }: HorizonCardProps) {
  return (
    <Card data-testid={`horizon-${card.query}`} className="gap-3">
      <CardHeader className="flex-row flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-medium">&ldquo;{card.query}&rdquo;</span>
        {card.page && <span className="truncate text-xs text-muted-foreground">{card.page}</span>}
        {card.isOpportunity ? (
          <Badge variant="signal" className="ml-auto">horizon opportunity</Badge>
        ) : (
          <Badge variant="outline" className="ml-auto">
            {card.reasons.length > 0 ? "partial signal" : "no signal"}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <dl className="u-tabular flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <div className="flex gap-1.5">
            <dt>position</dt>
            <dd className="font-medium text-foreground">{fmt(card.position, 1)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>impressions</dt>
            <dd className="font-medium text-foreground">
              {card.latestImpressions ?? "–"}
              {card.impressionsGrowth !== null && ` (${fmt(card.impressionsGrowth)}×)`}
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt>ctr</dt>
            <dd className="font-medium text-foreground">
              {fmt(card.ctr, 4)}
              {card.expectedCtr !== null && (
                <span className="text-muted-foreground"> vs {fmt(card.expectedCtr, 4)} expected</span>
              )}
            </dd>
          </div>
          <div className="flex gap-1.5">
            <dt>snapshots</dt>
            <dd className="font-medium text-foreground">{card.snapshots}</dd>
          </div>
        </dl>
        {card.reasons.length > 0 && (
          <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
            {card.reasons.map((reason) => (
              <li key={reason} className="border-l-2 border-signal/50 pl-2">
                {reason}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <CardFooter>
        <Button size="sm" disabled={busy} onClick={() => onTarget(card.query)}>
          <Target aria-hidden data-icon="inline-start" /> Target this
        </Button>
      </CardFooter>
    </Card>
  );
}
