import { describe, expect, it } from "vitest";
import type { LeadCard } from "@/lib/leads/types";
import {
  clampCursor,
  cursorLead,
  decodeView,
  encodeView,
  groupColumns,
  moveCursor,
  terminalCounts,
  viewsEqual,
  wipChip,
  BOARD_COLUMNS,
  DEFAULT_VIEW,
} from "../model";

function lead(partial: Partial<LeadCard> & { id: string }): LeadCard {
  return {
    source: "csv",
    email: `${partial.id}@x.example`,
    name: partial.id,
    company: null,
    role: null,
    website: null,
    notes: null,
    painPoint: null,
    status: "new",
    pinned: false,
    createdAt: "2026-07-13T00:00:00.000Z",
    score: null,
    reasons: [],
    scoredAt: null,
    profileHash: null,
    weightStateId: null,
    extras: [],
    ...partial,
  };
}

describe("board columns (column-as-field-value over the contract lifecycle)", () => {
  it("derives columns from the contract's NON-terminal statuses — terminal states are never columns", () => {
    expect([...BOARD_COLUMNS]).toEqual(["new", "scored", "contacted"]);
  });

  it("groups leads by status and excludes terminal ones, counting them honestly", () => {
    const leads = [
      lead({ id: "a", status: "new" }),
      lead({ id: "b", status: "scored", score: 0.8 }),
      lead({ id: "c", status: "contacted" }),
      lead({ id: "d", status: "dismissed" }),
      lead({ id: "e", status: "unsubscribed" }),
    ];
    const columns = groupColumns(leads);
    expect(columns.map((c) => c.leads.length)).toEqual([1, 1, 1]);
    expect(columns[0].label).toBe("New");
    expect(terminalCounts(leads)).toEqual({ dismissed: 1, unsubscribed: 1 });
  });
});

describe("2D cursor (the j/k grammar with one more axis)", () => {
  const columns = groupColumns([
    lead({ id: "n1", status: "new" }),
    lead({ id: "n2", status: "new" }),
    lead({ id: "c1", status: "contacted" }),
  ]);

  it("is null on an empty board and snaps to the nearest populated column otherwise", () => {
    expect(clampCursor(groupColumns([]), { col: 0, row: 0 })).toBeNull();
    // Column 1 (scored) is empty — the cursor settles beside it.
    const snapped = clampCursor(columns, { col: 1, row: 5 });
    expect(snapped).not.toBeNull();
    expect(columns[snapped!.col].leads.length).toBeGreaterThan(0);
  });

  it("j/k move within the column and clamp at the edges", () => {
    let cursor = clampCursor(columns, { col: 0, row: 0 });
    cursor = moveCursor(columns, cursor, "down");
    expect(cursorLead(columns, cursor)?.id).toBe("n2");
    cursor = moveCursor(columns, cursor, "down");
    expect(cursorLead(columns, cursor)?.id).toBe("n2");
    cursor = moveCursor(columns, cursor, "up");
    expect(cursorLead(columns, cursor)?.id).toBe("n1");
  });

  it("h/l cross columns, skipping empty ones and preserving the row (clamped)", () => {
    let cursor = clampCursor(columns, { col: 0, row: 1 });
    cursor = moveCursor(columns, cursor, "right");
    // Scored is empty — lands on contacted, row clamped to its length.
    expect(cursorLead(columns, cursor)?.id).toBe("c1");
    cursor = moveCursor(columns, cursor, "right");
    expect(cursorLead(columns, cursor)?.id).toBe("c1");
    // The clamp was a real move: crossing back carries the clamped row, not the old one.
    cursor = moveCursor(columns, cursor, "left");
    expect(cursorLead(columns, cursor)?.id).toBe("n1");
  });
});

describe("saved view (per-operator half of the GitHub model)", () => {
  it("round-trips through the codec and rejects junk limits", () => {
    const view = { wipLimits: { contacted: 10 } };
    expect(decodeView(encodeView(view))).toEqual(view);
    expect(decodeView(null)).toEqual(DEFAULT_VIEW);
    expect(decodeView("not json")).toEqual(DEFAULT_VIEW);
    expect(decodeView(JSON.stringify({ wipLimits: { contacted: -3, scored: 1.5, new: "x" } })))
      .toEqual(DEFAULT_VIEW);
    expect(viewsEqual(view, { wipLimits: { contacted: 10 } })).toBe(true);
    expect(viewsEqual(view, DEFAULT_VIEW)).toBe(false);
  });
});

describe("advisory WIP chip — signal channel, never a block", () => {
  it("renders nothing without a limit (the product default)", () => {
    expect(wipChip(4, undefined)).toBeNull();
  });

  it("carries the WORD 'over' when exceeded — never color alone", () => {
    expect(wipChip(12, 10)).toEqual({ text: "12 / 10 · over", over: true });
    expect(wipChip(3, 10)).toEqual({ text: "3 / 10", over: false });
    expect(wipChip(10, 10)).toEqual({ text: "10 / 10", over: false });
  });
});
