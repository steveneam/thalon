// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LeadsBoard } from "@/components/leads/leads-board";
import { LEAD_BOARD_COLUMNS, leadColumnLabel } from "@/components/leads/leads-model";
import type { LeadCard } from "@/lib/leads/types";

function card(partial: Partial<LeadCard> = {}): LeadCard {
  return {
    id: "lead-1",
    source: "csv",
    email: "mara@fieldline.example",
    name: "Mara Kessler",
    company: "Fieldline Robotics",
    role: "Ops lead",
    website: null,
    notes: null,
    painPoint: null,
    status: "scored",
    pinned: false,
    createdAt: "2026-07-18T02:00:00.000Z",
    score: 0.88,
    reasons: [],
    scoredAt: "2026-07-22T02:00:00.000Z",
    profileHash: "icp-v1",
    weightStateId: null,
    extras: [],
    ...partial,
  };
}

function board(props: Partial<Parameters<typeof LeadsBoard>[0]> = {}) {
  return render(
    <LeadsBoard
      status="success"
      leads={[]}
      selectedId={null}
      onOpen={vi.fn()}
      onRetry={vi.fn()}
      {...props}
    />,
  );
}

function columnNamed(container: HTMLElement, label: string): HTMLElement {
  const col = Array.from(container.querySelectorAll<HTMLElement>(".col")).find(
    (el) => el.querySelector(".col-hd span")?.textContent === label,
  );
  if (!col) throw new Error(`no column ${label}`);
  return col;
}

/**
 * STEP 2 of the leads-board rebuild: the real ranked queue in the sheet's
 * column grammar. These pin what the wiring is allowed to claim — a fabricated
 * count, an invented grade, a lead vanishing into no column, or a real-looking
 * zero on an unread queue is a failure.
 */
describe("Leads board — the wired pipeline", () => {
  it("draws one column per NON-TERMINAL lead status, derived from the contract", () => {
    const { container } = board();
    const heads = Array.from(container.querySelectorAll(".col-hd span:first-child")).map(
      (el) => el.textContent,
    );
    expect(heads).toEqual(LEAD_BOARD_COLUMNS.map(leadColumnLabel));
    // Terminal states are never columns — they are not drop targets.
    expect(heads).not.toContain("Dismissed");
    expect(heads).not.toContain("Unsubscribed");
    expect(LEAD_BOARD_COLUMNS).toHaveLength(3);
  });

  it("puts each lead in its own lifecycle column, best fit first inside it", () => {
    const { container } = board({
      leads: [
        card({ id: "low", name: "Low Score", score: 0.4 }),
        card({ id: "hot", name: "Hot Pick", score: 0.2, pinned: true }),
        card({ id: "high", name: "High Score", score: 0.9 }),
        card({ id: "fresh", name: "Fresh Lead", status: "new", score: null }),
      ],
    });

    // Ranked by compareLeadCards — the list's own order, so the two views agree.
    const scored = columnNamed(container, "Scored");
    expect(
      Array.from(scored.querySelectorAll(".l-name")).map((el) => el.textContent),
    ).toEqual([
      "Hot Pick · Fieldline Robotics",
      "High Score · Fieldline Robotics",
      "Low Score · Fieldline Robotics",
    ]);
    expect(within(columnNamed(container, "New")).getByText(/Fresh Lead/)).toBeInTheDocument();
    expect(columnNamed(container, "Contacted").querySelectorAll(".l-card")).toHaveLength(0);
  });

  it("counts are the column's real total", () => {
    const { container } = board({
      leads: [card({ id: "a" }), card({ id: "b" }), card({ id: "c", status: "new", score: null })],
    });
    expect(
      Array.from(container.querySelectorAll(".col-ct")).map((el) => el.textContent),
    ).toEqual(["1", "2", "0"]);
  });

  it("an unread queue shows '–', never a real-looking zero", () => {
    for (const status of ["loading", "error"] as const) {
      const { container, unmount } = board({ status });
      const counts = Array.from(container.querySelectorAll(".col-ct")).map((el) => el.textContent);
      expect(counts).toEqual(["–", "–", "–"]);
      expect(counts).not.toContain("0");
      unmount();
    }
  });

  it("an empty column says what would put a lead in it", () => {
    const { container } = board({ leads: [card()] });
    expect(within(columnNamed(container, "New")).getByText(/land here from a CSV import/))
      .toHaveClass("col-note");
    expect(
      within(columnNamed(container, "Contacted")).getByText(/recorded send sets contacted/),
    ).toBeInTheDocument();
  });

  it("the card is a LEAD card: badge, name · company, and the list's own thermal bar", () => {
    const { container } = board({ leads: [card()] });
    const lead = container.querySelector<HTMLElement>(".l-card");
    expect(lead?.querySelector(".l-badge")?.textContent).toBe("MK");
    expect(lead?.querySelector(".l-name")?.textContent).toBe("Mara Kessler · Fieldline Robotics");
    const fill = lead?.querySelector<HTMLElement>(".l-bar-fill");
    expect(fill?.style.width).toBe("88%");
    expect(fill?.style.background).toBe("var(--heat-hot)");
    expect(lead?.querySelector(".t-data")?.textContent).toBe("0.88");
  });

  it("an unscored lead reads '–' with an empty trough, never an invented grade", () => {
    const { container } = board({ leads: [card({ status: "new", score: null })] });
    const lead = container.querySelector<HTMLElement>(".l-card");
    expect(lead?.querySelector(".l-bar-fill")).toBeNull();
    expect(lead?.querySelector(".t-data")?.textContent).toBe("–");
    expect(lead?.querySelector(".t-data")).toHaveAttribute("title", "not scored yet");
  });

  it("a card is a door to the lead's dossier in the list", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    board({ leads: [card()], onOpen });

    await user.click(screen.getByRole("button", { name: "Open Mara Kessler · Fieldline Robotics in the list" }));
    expect(onOpen).toHaveBeenCalledWith("lead-1");
  });

  it("marks the lead the dossier is showing, with the sheet's own selected accent", () => {
    const { container } = board({
      leads: [card({ id: "a" }), card({ id: "b", name: "Other", score: 0.5 })],
      selectedId: "b",
    });
    expect(screen.getByTestId("lead-card-b")).toHaveClass("l-card", "sel");
    expect(screen.getByTestId("lead-card-a")).not.toHaveClass("sel");
    expect(container.querySelectorAll(".l-card.sel")).toHaveLength(1);
  });

  it("counts the terminal leads it deliberately has no column for", () => {
    board({
      leads: [card(), card({ id: "d", status: "dismissed" }), card({ id: "u", status: "unsubscribed" })],
    });
    expect(screen.getByText(/1 dismissed · 1 unsubscribed — terminal/)).toBeInTheDocument();
  });

  it("a read failure says so, with a retry — it is never an empty pipeline", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    board({ status: "error", onRetry });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/read failure, not an empty pipeline/);
    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("offers no drag affordance, and states why", () => {
    const { container } = board({ leads: [card()] });
    expect(container.querySelector("[draggable='true']")).toBeNull();
    expect(screen.getByText(/would fake a control you don’t have/)).toBeInTheDocument();
  });
});
