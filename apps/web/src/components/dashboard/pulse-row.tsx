"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PulseCounts } from "@/lib/workspace/types";

interface PulseRowProps {
  counts: PulseCounts;
  needsYou: number;
  loading: boolean;
  /** A failed pulse read renders "–", never real-looking zeros (the honest-states rule). */
  error?: boolean;
}

/** The HUD stat strip — tabular numerals, one amber signal (needs-you); every tile links to its surface. */
export function PulseRow({ counts, needsYou, loading, error = false }: PulseRowProps) {
  const unknown = loading || error;
  const tiles = [
    {
      label: "runs",
      value: counts.runs,
      href: "/app/runs",
      alert: counts.runsWithErrors > 0 ? `${counts.runsWithErrors} failed` : null,
    },
    { label: "drafts", value: counts.drafts, href: "/app/approve", alert: null },
    { label: "need you", value: needsYou, href: "/app/approve", alert: null, signal: true },
    { label: "approved", value: counts.approved, href: "/app/approve", alert: null },
  ];
  return (
    <section aria-label="Pulse" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((tile) => (
        <Link
          key={tile.label}
          href={tile.href}
          className="rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Card className="h-full gap-1 px-4 transition-colors hover:border-ring/50">
            <p className="u-eyebrow text-muted-foreground">{tile.label}</p>
            <p
              className={cn(
                "u-tabular text-3xl font-semibold",
                tile.signal && !unknown && needsYou > 0 && "text-signal",
              )}
            >
              {unknown ? "–" : tile.value}
            </p>
            {tile.alert && !unknown && (
              <p className="text-xs text-destructive">{tile.alert}</p>
            )}
          </Card>
        </Link>
      ))}
    </section>
  );
}
