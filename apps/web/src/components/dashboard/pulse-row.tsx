"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PulseCounts } from "@/lib/workspace/types";

interface PulseRowProps {
  counts: PulseCounts;
  needsYou: number;
  loading: boolean;
}

/** The HUD stat strip — tabular numerals, one amber signal (needs-you). */
export function PulseRow({ counts, needsYou, loading }: PulseRowProps) {
  const tiles = [
    { label: "runs", value: counts.runs, alert: counts.runsWithErrors > 0 ? `${counts.runsWithErrors} failed` : null },
    { label: "drafts", value: counts.drafts, alert: null },
    { label: "need you", value: needsYou, alert: null, primary: true },
    { label: "approved", value: counts.approved, alert: null },
  ];
  return (
    <section aria-label="Pulse" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((tile) => (
        <Card key={tile.label} className="gap-1 px-4">
          <p className="u-eyebrow text-muted-foreground">{tile.label}</p>
          <p
            className={cn(
              "u-tabular text-3xl font-semibold",
              tile.primary && needsYou > 0 && "text-primary",
            )}
          >
            {loading ? "–" : tile.value}
          </p>
          {tile.alert && !loading && (
            <p className="text-xs text-destructive">{tile.alert}</p>
          )}
        </Card>
      ))}
    </section>
  );
}
