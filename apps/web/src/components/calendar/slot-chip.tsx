"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { clockLabel, statusWord, type CalendarItem } from "./model";

/**
 * Chip anatomy (design of record): time + title + ONE status word — `gated`
 * is the only bronze element (the signal channel); everything clickable stays
 * blue/neutral. Provenance and long text live in the day panel + detail,
 * never on the chip. Chips LINK to the draft's approve-queue detail; they do
 * not drag — items sit at factual pipeline instants until the slot store
 * lands (facts don't reschedule).
 */

const DRESS: Record<string, string> = {
  approved: "bg-muted text-foreground",
  gated: "bg-signal text-signal-foreground",
  draft: "border border-dashed border-border text-muted-foreground",
};

export function StatusWordPill({ status, className }: { status: string; className?: string }) {
  const { word, dress } = statusWord(status);
  return (
    <span
      className={cn(
        "u-eyebrow shrink-0 rounded-full px-1.5 py-px text-2xs",
        DRESS[dress],
        className,
      )}
    >
      {word}
    </span>
  );
}

export function SlotChip({ item }: { item: CalendarItem }) {
  return (
    <Link
      href={item.href}
      data-testid={`slot-chip-${item.id}`}
      title={`${item.title} · ${clockLabel(item.at)} · ${item.status} — ${item.detail}`}
      className="flex min-w-0 items-center gap-1.5 rounded-md border border-border bg-card px-1.5 py-0.5 text-2xs leading-snug hover:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="shrink-0 font-mono text-muted-foreground">{clockLabel(item.at)}</span>
      <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
      {item.recurring && (
        <span className="shrink-0 font-mono text-muted-foreground" title="repeats weekly">
          ↻ wk
        </span>
      )}
      <StatusWordPill status={item.status} />
    </Link>
  );
}
