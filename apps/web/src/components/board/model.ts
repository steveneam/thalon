import { LEAD_STATUSES, LEAD_TRANSITIONS, type LeadStatus } from "@thalon/contracts";
import type { LeadCard } from "@/lib/leads/types";
import { compareLeadCards } from "@/lib/leads/serialize";

/**
 * Pure math for the Leads pipeline board (Phase I, design of record: "Leads
 * Board.dc.html"). The board is the column-as-field-value model over the
 * field that EXISTS: the contract's lead lifecycle. Columns are the
 * non-terminal statuses, derived from the contract itself — terminal states
 * (dismissed, unsubscribed) are never columns (terminal verbs are never drop
 * targets; Dismissed stays a tab). HONEST LIMIT: today's lifecycle is
 * engine-owned (scoring + the send door set it), so drag-between-columns is
 * deliberately NOT wired — it would fake agency. It arrives with the
 * operator-owned stage field (checkpoint-flagged).
 */

/** Non-terminal lifecycle values, straight from the contract (terminal = no exits). */
export const BOARD_COLUMNS: readonly LeadStatus[] = LEAD_STATUSES.filter(
  (s) => LEAD_TRANSITIONS[s].length > 0,
);

export const COLUMN_LABELS: Record<string, string> = {
  new: "New",
  scored: "Scored",
  contacted: "Contacted",
};

export function columnLabel(status: LeadStatus): string {
  return COLUMN_LABELS[status] ?? status;
}

export interface BoardColumn {
  status: LeadStatus;
  label: string;
  leads: LeadCard[];
}

/** Terminal-status leads are EXCLUDED here; the board states their counts, never hides them silently. */
export function groupColumns(leads: LeadCard[]): BoardColumn[] {
  return BOARD_COLUMNS.map((status) => ({
    status,
    label: columnLabel(status),
    leads: leads.filter((l) => l.status === status).sort(compareLeadCards),
  }));
}

export function terminalCounts(leads: LeadCard[]): { dismissed: number; unsubscribed: number } {
  return {
    dismissed: leads.filter((l) => l.status === "dismissed").length,
    unsubscribed: leads.filter((l) => l.status === "unsubscribed").length,
  };
}

// ---------------------------------------------------------------------------
// 2D cursor — the j/k grammar with one more axis (design Q5): j/k move within
// the column, h/l cross columns preserving the row position (clamped).

export interface BoardCursor {
  col: number;
  row: number;
}

export function clampCursor(columns: BoardColumn[], cursor: BoardCursor): BoardCursor | null {
  if (columns.every((c) => c.leads.length === 0)) return null;
  let col = Math.min(Math.max(cursor.col, 0), columns.length - 1);
  // An empty column can't hold the cursor — settle on the nearest non-empty one.
  if (columns[col].leads.length === 0) {
    const populated = columns
      .map((c, i) => ({ i, n: c.leads.length }))
      .filter((c) => c.n > 0)
      .sort((a, b) => Math.abs(a.i - col) - Math.abs(b.i - col));
    col = populated[0].i;
  }
  const row = Math.min(Math.max(cursor.row, 0), columns[col].leads.length - 1);
  return { col, row };
}

export function moveCursor(
  columns: BoardColumn[],
  cursor: BoardCursor | null,
  dir: "up" | "down" | "left" | "right",
): BoardCursor | null {
  const current = clampCursor(columns, cursor ?? { col: 0, row: 0 });
  if (current === null) return null;
  if (dir === "up" || dir === "down") {
    return clampCursor(columns, { col: current.col, row: current.row + (dir === "down" ? 1 : -1) });
  }
  const step = dir === "right" ? 1 : -1;
  // Cross to the nearest populated column in that direction; stay put if none.
  for (let col = current.col + step; col >= 0 && col < columns.length; col += step) {
    if (columns[col].leads.length > 0) return clampCursor(columns, { col, row: current.row });
  }
  return current;
}

export function cursorLead(columns: BoardColumn[], cursor: BoardCursor | null): LeadCard | null {
  if (cursor === null) return null;
  return columns[cursor.col]?.leads[cursor.row] ?? null;
}

// ---------------------------------------------------------------------------
// Saved view — GitHub's model: view edits are YOURS (bronze unsaved dot +
// the word) until Save view snapshots them to the TENANT-WIDE views store
// (`saved_views`, Phase-I window; wired s62 by the storage-story audit — the
// server is the system of record, a view survives the browser and the
// machine). The old per-operator localStorage copy is read once as a
// migration source and then retired. WIP limits are ADVISORY, per-view,
// product default none: the chip shows `count / limit` and the WORD "over"
// in bronze — signal channel, never a block.

export interface BoardView {
  /** Advisory WIP limit per column status; absent = none (the product default). */
  wipLimits: Partial<Record<string, number>>;
}

export const DEFAULT_VIEW: BoardView = { wipLimits: {} };

/** The legacy per-operator copy (pre-views-store) — migration source only. */
export const BOARD_VIEW_STORAGE_KEY = "thalon.leads-board.view";

/** The board's one named view in the tenant-wide store (single-view board today; more tabs = more names). */
export const BOARD_VIEW_SURFACE = "leads";
export const BOARD_VIEW_NAME = "Board";

export function encodeView(view: BoardView): string {
  return JSON.stringify(view);
}

/** BoardView → the open config record the views store carries (coerceView reads it back). */
export function viewConfig(view: BoardView): Record<string, unknown> {
  return { wipLimits: view.wipLimits };
}

/** Unknown shape (server config, legacy JSON) → a valid BoardView — malformed limits drop, never patch. */
export function coerceView(parsed: unknown): BoardView {
  if (typeof parsed !== "object" || parsed === null) return DEFAULT_VIEW;
  const wipLimits: Partial<Record<string, number>> = {};
  const rawLimits = (parsed as { wipLimits?: unknown }).wipLimits;
  if (typeof rawLimits === "object" && rawLimits !== null) {
    for (const [key, value] of Object.entries(rawLimits)) {
      if (typeof value === "number" && Number.isInteger(value) && value > 0) {
        wipLimits[key] = value;
      }
    }
  }
  return { wipLimits };
}

export function decodeView(raw: string | null): BoardView {
  if (!raw) return DEFAULT_VIEW;
  try {
    return coerceView(JSON.parse(raw));
  } catch {
    return DEFAULT_VIEW;
  }
}

export function viewsEqual(a: BoardView, b: BoardView): boolean {
  return encodeView(a) === encodeView(b);
}

export interface WipChip {
  text: string;
  over: boolean;
}

/** `12 / 10 · over` — the word carries the state; null when no limit is set (the default). */
export function wipChip(count: number, limit: number | undefined): WipChip | null {
  if (limit === undefined) return null;
  const over = count > limit;
  return { text: `${count} / ${limit}${over ? " · over" : ""}`, over };
}
