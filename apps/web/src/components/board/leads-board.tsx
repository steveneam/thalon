"use client";

import { useEffect, useMemo, useState } from "react";
import { Flame } from "lucide-react";
import { HeatGrade } from "@/components/intel/heat-grade";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LeadCard } from "@/lib/leads/types";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/workspace/format";
import { useListKeys } from "@/lib/workspace/keyboard";
import { SELECTED_ROW } from "@/lib/workspace/selected-row";
import {
  clampCursor,
  columnLabel,
  cursorLead,
  decodeView,
  encodeView,
  groupColumns,
  moveCursor,
  terminalCounts,
  viewsEqual,
  wipChip,
  BOARD_VIEW_STORAGE_KEY,
  DEFAULT_VIEW,
  type BoardCursor,
  type BoardView,
} from "./model";

interface LeadsBoardProps {
  leads: LeadCard[];
  selected: Set<string>;
  busy: boolean;
  /** Master keyboard gate — the surface passes false while another tab owns the keys. */
  keysEnabled: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onTriage: (action: "dismiss" | "pin" | "unpin", id: string) => void;
}

/**
 * The Leads pipeline board (Phase I, design of record: "Leads Board.dc.html")
 * — the only v1 board, a saved-view tab on the Leads surface sharing its data
 * wiring. Columns are the contract's non-terminal lifecycle values; the
 * region is a fixed 30rem, columns scroll INTERNALLY, and every count stays
 * in its column header (Bounded-List Rule). The 2D keyboard grammar extends
 * useListKeys: j/k within the column, h/l across, x picks (multi-select spans
 * columns — the shared bulk bar counts both), d = Dismiss (this surface's
 * Four-Verbs word). HONEST LIMITS, stated in UI: drag-between-columns waits
 * for the operator-owned stage field (today's lifecycle is engine-owned —
 * drag would fake agency), and saved views persist per-operator only until
 * the views store lands.
 */
export function LeadsBoard({
  leads,
  selected,
  busy,
  keysEnabled,
  onSelect,
  onTriage,
}: LeadsBoardProps) {
  const columns = useMemo(() => groupColumns(leads), [leads]);
  const terminal = useMemo(() => terminalCounts(leads), [leads]);
  const [rawCursor, setCursor] = useState<BoardCursor | null>(null);
  const cursor = clampCursor(columns, rawCursor ?? { col: 0, row: 0 });
  const atCursor = cursorLead(columns, cursor);

  // The saved view (GitHub model, per-operator half): loaded lazily on the
  // client — the board only mounts after the leads fetch, never during SSR —
  // and edits are "yours" until Save view snapshots them back.
  const loadStored = () =>
    typeof window === "undefined"
      ? DEFAULT_VIEW
      : decodeView(window.localStorage.getItem(BOARD_VIEW_STORAGE_KEY));
  const [view, setView] = useState<BoardView>(loadStored);
  const [savedView, setSavedView] = useState<BoardView>(loadStored);
  const unsaved = !viewsEqual(view, savedView);

  useListKeys({
    enabled: keysEnabled && !busy,
    bindings: {
      j: (event) => {
        event.preventDefault();
        setCursor(moveCursor(columns, cursor, "down"));
      },
      k: (event) => {
        event.preventDefault();
        setCursor(moveCursor(columns, cursor, "up"));
      },
      h: (event) => {
        event.preventDefault();
        setCursor(moveCursor(columns, cursor, "left"));
      },
      l: (event) => {
        event.preventDefault();
        setCursor(moveCursor(columns, cursor, "right"));
      },
      x: (event) => {
        if (!atCursor) return;
        event.preventDefault();
        onSelect(atCursor.id, !selected.has(atCursor.id));
      },
      d: (event) => {
        if (!atCursor) return;
        event.preventDefault();
        onTriage("dismiss", atCursor.id);
      },
    },
  });

  useEffect(() => {
    if (!atCursor) return;
    document
      .querySelector(`[data-testid="board-card-${atCursor.id}"]`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [atCursor]);

  function editLimit(status: string) {
    const current = view.wipLimits[status];
    const raw = window.prompt(
      `Advisory WIP limit for ${columnLabel(status as (typeof columns)[number]["status"])} — blank clears it. Limits signal, never block.`,
      current === undefined ? "" : String(current),
    );
    if (raw === null) return;
    const trimmed = raw.trim();
    setView((v) => {
      const wipLimits = { ...v.wipLimits };
      const parsed = Number.parseInt(trimmed, 10);
      if (trimmed === "" || !Number.isInteger(parsed) || parsed <= 0) delete wipLimits[status];
      else wipLimits[status] = parsed;
      return { wipLimits };
    });
  }

  function saveView() {
    window.localStorage.setItem(BOARD_VIEW_STORAGE_KEY, encodeView(view));
    setSavedView(view);
  }

  return (
    <div className="flex flex-col gap-2">
      {/* j/k/h/l is a silent context change for screen readers without this. */}
      <p aria-live="polite" className="sr-only">
        {atCursor && cursor
          ? `Selected lead ${atCursor.name || atCursor.company || atCursor.email} — ${columns[cursor.col].label} column, ${cursor.row + 1} of ${columns[cursor.col].leads.length}`
          : ""}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {unsaved && (
          <span className="flex items-center gap-1 text-xs text-signal" title="View has unsaved changes — yours until saved">
            <span aria-hidden className="size-1.5 rounded-full bg-signal" />
            unsaved
          </span>
        )}
        {unsaved && (
          <Button
            size="sm"
            variant="outline"
            onClick={saveView}
            title="Saves for you (this browser). Tenant-wide sharing lands with the views store."
          >
            Save view
          </Button>
        )}
        <span className="u-eyebrow ml-auto text-muted-foreground">
          views save layout + filter + sort · yours until saved
          {terminal.dismissed > 0 && ` · ${terminal.dismissed} dismissed → tab`}
          {terminal.unsubscribed > 0 && ` · ${terminal.unsubscribed} unsubscribed → All leads`}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid h-[30rem] grid-cols-3">
          {columns.map((column, colIndex) => {
            const advisory = wipChip(column.leads.length, view.wipLimits[column.status]);
            return (
              <div
                key={column.status}
                className="flex min-w-0 flex-col border-l border-border first:border-l-0"
              >
                <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-2.5 py-2">
                  <span className="text-xs font-semibold">{column.label}</span>
                  {advisory ? (
                    <Badge
                      variant={advisory.over ? "signal" : "outline"}
                      className="u-tabular"
                      title="Advisory limit — nothing blocks; the word carries the state"
                    >
                      {advisory.text}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="u-tabular">
                      {column.leads.length}
                    </Badge>
                  )}
                  <button
                    type="button"
                    onClick={() => editLimit(column.status)}
                    title={`Set an advisory WIP limit for ${column.label} (per-view, default none)`}
                    className="u-eyebrow ml-auto text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    limit
                  </button>
                </div>
                <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
                  {column.leads.length === 0 && (
                    <p className="rounded-lg border border-dashed border-border p-2.5 text-xs text-muted-foreground">
                      {column.status === "new" && "New leads land here from CSV import, waitlist sync, or the API."}
                      {column.status === "scored" && "Score now moves new leads here with readable reasons."}
                      {column.status === "contacted" && "The send door sets contacted on a recorded send."}
                    </p>
                  )}
                  {column.leads.map((lead, rowIndex) => {
                    const isCursor = cursor?.col === colIndex && cursor.row === rowIndex;
                    const headline = lead.name || lead.company || lead.email;
                    return (
                      <div
                        key={lead.id}
                        data-testid={`board-card-${lead.id}`}
                        className={cn(
                          "flex min-w-0 flex-col gap-1.5 rounded-lg border border-border bg-card p-2",
                          isCursor && SELECTED_ROW,
                        )}
                      >
                        <span className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            aria-label={`Select ${headline}`}
                            checked={selected.has(lead.id)}
                            onChange={(e) => onSelect(lead.id, e.target.checked)}
                            className="size-3.5 accent-primary"
                          />
                          <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                            {headline}
                          </span>
                          <span className="u-eyebrow shrink-0 text-muted-foreground">
                            {timeAgo(lead.createdAt)}
                          </span>
                        </span>
                        {lead.company && lead.name && (
                          <span className="truncate text-xs text-muted-foreground">
                            {lead.company}
                          </span>
                        )}
                        <span className="flex items-center gap-1.5">
                          {lead.score !== null ? (
                            <HeatGrade score={lead.score} detail={lead.reasons[0]} />
                          ) : (
                            <Badge variant="outline">not scored yet</Badge>
                          )}
                          {lead.pinned && (
                            <Badge variant="signal">
                              <Flame aria-hidden className="size-3" /> hot
                            </Badge>
                          )}
                          <span className="u-eyebrow ml-auto shrink-0 text-muted-foreground">
                            {lead.source}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                  {column.leads.length > 5 && (
                    <p className="u-eyebrow px-0.5 text-muted-foreground">
                      column scrolls — all {column.leads.length} counted above
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="border-t border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          Stage drag isn&rsquo;t wired yet: these columns are the engine-owned lifecycle (scoring and
          the send door set them), and dragging them would fake agency. Drag = one honest field
          update arrives with the operator-owned stage field. Dismiss stays a verb (
          <span className="font-mono">d</span>, named confirm on bulk) — never a column.
        </p>
      </div>
    </div>
  );
}
