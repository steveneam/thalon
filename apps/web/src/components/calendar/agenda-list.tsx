"use client";

import Link from "next/link";
import { StatusWordPill } from "./slot-chip";
import { clockLabel, type CalendarItem } from "./model";

/**
 * The agenda density (design of record): a chronological BOUNDED list — the
 * existing list grammar, and the surface's one degradation path on narrow
 * screens. Internal scroll past the fixed region; the count above never
 * hides (Bounded-List Rule).
 */
export function AgendaList({ items, monthLabel }: { items: CalendarItem[]; monthLabel: string }) {
  const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric" });
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <p className="u-eyebrow border-b border-border px-4 py-2 text-muted-foreground">
        {items.length} draft{items.length === 1 ? "" : "s"} in {monthLabel} · chronological — list
        scrolls internally
      </p>
      <div className="max-h-[26rem] overflow-y-auto">
        {items.length === 0 && (
          <p className="px-4 py-3 text-xs text-muted-foreground">
            Nothing this month yet — run a fan-out and its drafts land here at each pipeline step.
          </p>
        )}
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="flex items-center gap-2.5 border-b border-border px-4 py-2 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="w-14 shrink-0 font-mono text-2xs text-muted-foreground">
              {dayFmt.format(item.at)}
            </span>
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
    </div>
  );
}
