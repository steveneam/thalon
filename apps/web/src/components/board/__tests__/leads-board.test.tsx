// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SELECTED_ROW } from "@/lib/workspace/selected-row";
import type { LeadCard } from "@/lib/leads/types";
import { LeadsBoard } from "../leads-board";
import { BOARD_VIEW_STORAGE_KEY } from "../model";

function lead(partial: Partial<LeadCard> & { id: string }): LeadCard {
  return {
    source: "csv",
    email: `${partial.id}@x.example`,
    name: partial.id,
    company: "Acme",
    role: null,
    website: null,
    notes: null,
    painPoint: null,
    status: "new",
    pinned: false,
    createdAt: "2026-07-13T00:00:00.000Z",
    score: 0.82,
    reasons: ["fit 1 (vertical match)"],
    scoredAt: "2026-07-13T01:00:00.000Z",
    profileHash: "icp-v1",
    weightStateId: null,
    extras: [],
    ...partial,
  };
}

const LEADS = [
  lead({ id: "Nia", status: "new" }),
  lead({ id: "Noor", status: "new", score: null, reasons: [] }),
  lead({ id: "Sana", status: "scored" }),
  lead({ id: "Cato", status: "contacted" }),
  lead({ id: "Dee", status: "dismissed" }),
  lead({ id: "Uma", status: "unsubscribed" }),
];

function renderBoard(overrides: Partial<Parameters<typeof LeadsBoard>[0]> = {}) {
  const onSelect = vi.fn();
  const onTriage = vi.fn();
  render(
    <LeadsBoard
      leads={LEADS}
      selected={new Set()}
      busy={false}
      keysEnabled
      onSelect={onSelect}
      onTriage={onTriage}
      {...overrides}
    />,
  );
  return { onSelect, onTriage };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("leads board (Phase I — the only v1 board)", () => {
  it("renders the contract's non-terminal columns with header counts; terminal states are stated, never columns", () => {
    renderBoard();
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.getByText("Scored")).toBeInTheDocument();
    expect(screen.getByText("Contacted")).toBeInTheDocument();
    // No terminal columns, and their cards are absent — but the counts are stated.
    expect(screen.queryByText("Dismissed")).not.toBeInTheDocument();
    expect(screen.queryByTestId("board-card-Dee")).not.toBeInTheDocument();
    expect(screen.queryByTestId("board-card-Uma")).not.toBeInTheDocument();
    expect(screen.getByText(/1 dismissed → tab/)).toBeInTheDocument();
    expect(screen.getByText(/1 unsubscribed → All leads/)).toBeInTheDocument();
    // The honest drag inset states why columns don't drag yet.
    expect(screen.getByText(/Stage drag isn/)).toBeInTheDocument();
    // Thermal grammar reused on the card face; unscored stays honest.
    expect(screen.getAllByText("not scored yet").length).toBe(1);
  });

  it("extends the keyboard grammar to 2D: j/k in column, h/l across, x picks, d dismisses", async () => {
    const user = userEvent.setup();
    const { onSelect, onTriage } = renderBoard();
    // The cursor starts on the first card of the first populated column.
    expect(screen.getByTestId("board-card-Nia").className).toContain(SELECTED_ROW);

    await user.keyboard("j");
    expect(screen.getByTestId("board-card-Noor").className).toContain(SELECTED_ROW);
    await user.keyboard("j");
    expect(screen.getByTestId("board-card-Noor").className).toContain(SELECTED_ROW);

    await user.keyboard("l");
    expect(screen.getByTestId("board-card-Sana").className).toContain(SELECTED_ROW);
    expect(screen.getByText(/Scored column, 1 of 1/)).toBeInTheDocument();
    await user.keyboard("l");
    expect(screen.getByTestId("board-card-Cato").className).toContain(SELECTED_ROW);
    await user.keyboard("h");
    await user.keyboard("h");
    // Row position carries across columns, clamped to each column's length.
    expect(screen.getByTestId("board-card-Nia").className).toContain(SELECTED_ROW);

    await user.keyboard("x");
    expect(onSelect).toHaveBeenCalledWith("Nia", true);
    await user.keyboard("d");
    expect(onTriage).toHaveBeenCalledWith("dismiss", "Nia");
  });

  it("keeps keys inert when the surface gates them off", async () => {
    const user = userEvent.setup();
    const { onTriage } = renderBoard({ keysEnabled: false });
    await user.keyboard("d");
    expect(onTriage).not.toHaveBeenCalled();
  });

  it("advisory WIP limit: per-view, bronze WORD 'over', never a block — and Save view persists per-operator", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "prompt").mockReturnValue("1");
    renderBoard();
    // Default: no limit chips, plain counts only, nothing unsaved.
    expect(screen.queryByText(/over/)).not.toBeInTheDocument();
    expect(screen.queryByText("unsaved")).not.toBeInTheDocument();

    await user.click(
      screen.getByTitle("Set an advisory WIP limit for New (per-view, default none)"),
    );
    expect(screen.getByText("2 / 1 · over")).toBeInTheDocument();
    // Both cards are still there — the limit signals, it never blocks.
    expect(screen.getByTestId("board-card-Nia")).toBeInTheDocument();
    expect(screen.getByTestId("board-card-Noor")).toBeInTheDocument();
    expect(screen.getByText("unsaved")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save view" }));
    expect(screen.queryByText("unsaved")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(BOARD_VIEW_STORAGE_KEY)).toContain('"new":1');
  });
});
