"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusWordPill } from "./slot-chip";
import { clockLabel, type CalendarItem } from "./model";

interface DayPanelProps {
  date: Date;
  items: CalendarItem[];
  onClose: () => void;
}

/**
 * The right-hand day panel (design of record) — opens on day click or "+N
 * more", same route, no navigation. The list is BOUNDED: it scrolls
 * internally past ~8 rows and states so (the Bounded-List Rule). Provenance
 * and judge reasons live here on the meta line, never on the month chips.
 */
export function DayPanel({ date, items, onClose }: DayPanelProps) {
  const label = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "long",
  }).format(date);
  return (
    <div
      data-testid="day-panel"
      className="flex w-full shrink-0 flex-col border-t border-border lg:w-[21rem] lg:border-t-0 lg:border-l"
    >
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2.5">
        <span className="text-sm font-semibold">{label}</span>
        <Badge variant="secondary" className="u-tabular">
          {items.length} item{items.length === 1 ? "" : "s"}
        </Badge>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto px-1.5"
          aria-label="Close day panel"
          onClick={onClose}
        >
          <X aria-hidden className="size-3.5" />
        </Button>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {items.length === 0 && (
          <p className="px-4 py-2 text-xs text-muted-foreground">
            Nothing on this day — drafts land here as the pipeline reaches them.
          </p>
        )}
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="flex items-center gap-2.5 border-t border-border px-4 py-2 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="w-10 shrink-0 font-mono text-2xs text-muted-foreground">
              {clockLabel(item.at)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">{item.title}</span>
              <span className="u-eyebrow block truncate text-muted-foreground">
                {item.platform} · {item.detail}
              </span>
            </span>
            <StatusWordPill status={item.status} />
          </Link>
        ))}
      </div>
      <div className="mt-auto flex flex-col gap-2 border-t border-border px-4 py-3">
        <p className="u-eyebrow text-muted-foreground">
          day list is bounded — scrolls internally past 8
        </p>
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          disabled
          title="Planned slots land with the publish bucket — nothing schedules yet"
        >
          Plan slot on this day
        </Button>
      </div>
    </div>
  );
}
