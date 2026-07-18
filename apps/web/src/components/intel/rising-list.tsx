"use client";

import { useEffect, useRef } from "react";
import { HeatGrade } from "@/components/intel/heat-grade";
import { compactCount } from "@/components/intel/launchpad";
import type { TrendCard } from "@/lib/intel/types";
import { timeAgo } from "@/lib/workspace/format";
import { SELECTED_ROW } from "@/lib/workspace/selected-row";
import { cn } from "@/lib/utils";

interface RisingListProps {
  rows: TrendCard[];
  cursorId: string | null;
  picked: Set<string>;
  busy: boolean;
  onOpen: (cardId: string) => void;
  onPick: (cardId: string, picked: boolean) => void;
}

/**
 * The bounded rising list (Phase D design #4 + the Bounded-List Rule): every
 * card that is NOT the expanded dossier, as one compact row each — heat,
 * title, views · age — inside a fixed-height region that scrolls internally.
 * The bound states its count; clicking a row expands it into the launchpad
 * (one card expands at a time). Checkbox-beside-row is the standing bulk
 * grammar (library shelf precedent).
 */
export function RisingList({ rows, cursorId, picked, busy, onOpen, onPick }: RisingListProps) {
  const cursorRef = useRef<HTMLLIElement | null>(null);

  // Keep the cursor row in view while j/k cruises the bound (jsdom-safe call).
  useEffect(() => {
    cursorRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [cursorId]);

  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <p className="u-eyebrow text-muted-foreground">
        {rows.length} more rising · list is bounded — scrolls internally past 6
      </p>
      <ul className="max-h-56 overflow-y-auto rounded-xl border border-border bg-card">
        {rows.map((row, i) => (
          <li
            key={row.id}
            ref={cursorId === row.id ? cursorRef : undefined}
            data-testid={`trend-row-${row.id}`}
            className={cn("flex items-center gap-2 px-3", i > 0 && "border-t border-border")}
          >
            <input
              type="checkbox"
              aria-label={`Select trend from @${row.account}`}
              checked={picked.has(row.id)}
              onChange={(e) => onPick(row.id, e.target.checked)}
              className="size-4 shrink-0 accent-primary"
            />
            <button
              type="button"
              disabled={busy}
              aria-label={`Expand trend from @${row.account}`}
              onClick={() => onOpen(row.id)}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-transparent px-2 py-2 text-left transition-colors hover:bg-muted",
                "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                cursorId === row.id && SELECTED_ROW,
              )}
            >
              <HeatGrade score={row.score} className="shrink-0" />
              <span className="min-w-0 flex-1 truncate text-xs font-medium">{row.text}</span>
              <span className="u-tabular shrink-0 text-2xs text-muted-foreground">
                {typeof row.metrics.views === "number" && <>{compactCount(row.metrics.views)} · </>}
                {timeAgo(row.publishedAt)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
