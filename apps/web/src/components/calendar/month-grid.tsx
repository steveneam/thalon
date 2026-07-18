"use client";

import { cn } from "@/lib/utils";
import { SlotChip } from "./slot-chip";
import type { CalendarItem, MonthCell } from "./model";

const DOWS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** A day cell caps at 3 chips, then "+N more" (the Bounded-List Rule — page geometry never grows). */
const CELL_CHIP_CAP = 3;

interface MonthGridProps {
  cells: MonthCell[];
  itemsByDay: Map<string, CalendarItem[]>;
  selectedKey: string;
  /** Day click (or "+N more") selects the day and opens the panel — same route, no navigation. */
  onSelectDay: (key: string) => void;
}

/**
 * The month grid (design of record: "Content Calendar.dc.html"). Cells are
 * fixed-minimum rows; overflow lives behind "+N more" into the day panel, so
 * the month region's geometry is independent of draft volume.
 */
export function MonthGrid({ cells, itemsByDay, selectedKey, onSelectDay }: MonthGridProps) {
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: "long" });
  const dayLabel = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric" });
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="grid grid-cols-7">
        {DOWS.map((d) => (
          <span key={d} className="u-eyebrow px-2 py-1.5 text-muted-foreground">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-[minmax(6.75rem,auto)] max-sm:auto-rows-[minmax(3.5rem,auto)]">
        {cells.map((cell) => {
          const items = itemsByDay.get(cell.key) ?? [];
          const more = Math.max(0, items.length - CELL_CHIP_CAP);
          const selected = cell.key === selectedKey;
          return (
            <div
              key={cell.key}
              data-testid={`day-cell-${cell.key}`}
              className={cn(
                // overflow-hidden is the belt: a chip must never bleed into the
                // neighbouring day and read as the wrong date.
                "relative flex min-w-0 flex-col gap-1 overflow-hidden border-t border-l border-border p-1.5",
                !cell.inMonth && "bg-muted/40",
                selected && "bg-primary/5 outline-2 outline-primary -outline-offset-2",
              )}
            >
              <button
                type="button"
                aria-label={`${dayLabel.format(cell.date)} ${monthLabel.format(cell.date)} — ${items.length} item${items.length === 1 ? "" : "s"}`}
                aria-pressed={selected}
                onClick={() => onSelectDay(cell.key)}
                className={cn(
                  "u-eyebrow self-start rounded-sm px-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  cell.isToday && "font-semibold text-primary",
                )}
              >
                {cell.date.getDate()}
              </button>
              {/* Phones: cells are too narrow for chip anatomy (time + title +
                  status word) — the month shows each day's COUNT and the day
                  panel carries the full chips; the day button's aria-label
                  already announces the count. Desktop keeps the chips. */}
              {items.length > 0 && (
                <span
                  aria-hidden
                  className="u-tabular self-start rounded-full bg-muted px-1.5 text-2xs font-medium sm:hidden"
                >
                  {items.length}
                </span>
              )}
              <div className="flex min-w-0 flex-col gap-1 max-sm:hidden">
                {items.slice(0, CELL_CHIP_CAP).map((item) => (
                  <SlotChip key={item.id} item={item} />
                ))}
                {more > 0 && (
                  <button
                    type="button"
                    onClick={() => onSelectDay(cell.key)}
                    className="u-eyebrow self-start text-primary hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    +{more} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
