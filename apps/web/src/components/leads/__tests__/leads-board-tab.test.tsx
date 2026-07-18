// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/lib/testing/server";
import { SELECTED_ROW } from "@/lib/workspace/selected-row";
import type { LeadCard, LeadsPayload } from "@/lib/leads/types";
import { LeadsSurface } from "../leads-surface";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function card(partial: Partial<LeadCard> & { id: string }): LeadCard {
  return {
    source: "csv",
    email: `${partial.id}@x.example`,
    name: partial.id,
    company: "Acme",
    role: null,
    website: null,
    notes: null,
    painPoint: null,
    status: "scored",
    pinned: false,
    createdAt: "2026-07-13T00:00:00.000Z",
    score: 0.7,
    reasons: [],
    scoredAt: "2026-07-13T01:00:00.000Z",
    profileHash: "icp-v1",
    weightStateId: null,
    extras: [],
    ...partial,
  };
}

function seedLeads(leads: LeadCard[]) {
  server.use(
    http.get("/api/leads", () =>
      HttpResponse.json({
        leads,
        scoringArmed: true,
        currentProfileHash: "icp-v1",
        learnedWeights: { state: null, staleForProfile: false },
        counts: {
          new: leads.filter((l) => l.status === "new").length,
          scored: leads.filter((l) => l.status === "scored").length,
          dismissed: leads.filter((l) => l.status === "dismissed").length,
        },
      } satisfies LeadsPayload),
    ),
  );
}

describe("leads surface — the Pipeline board tab (Phase I wiring)", () => {
  it("mounts the board as a saved-view tab beside the lists, handing it the keys and the shared bulk flow", async () => {
    const user = userEvent.setup();
    seedLeads([
      card({ id: "Ana", status: "new", score: null, scoredAt: null, profileHash: null }),
      card({ id: "Ben", status: "scored" }),
      card({ id: "Dee", status: "dismissed" }),
    ]);
    render(<LeadsSurface />);
    await screen.findByTestId("lead-card-Ana");

    // The list grammar owns the keys on the list tabs.
    expect(screen.getByText(/j\/k select/)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Pipeline" }));
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.getByText("Scored")).toBeInTheDocument();
    expect(screen.getByText("Contacted")).toBeInTheDocument();
    expect(screen.getByTestId("board-card-Ana")).toBeInTheDocument();
    // The flat list (and its empty state) yields to the board.
    expect(screen.queryByTestId("lead-card-Ana")).not.toBeInTheDocument();
    // The 2D legend replaces the list legend.
    expect(screen.getByText(/h\/l column/)).toBeInTheDocument();

    // x on the board cursor feeds the SHARED bulk bar (multi-select spans columns).
    await user.keyboard("x");
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    // The board cursor starts on the first populated column's first card.
    expect(screen.getByTestId("board-card-Ana").className).toContain(SELECTED_ROW);

    // Back on the list tab the board unmounts and the list grammar returns.
    await user.click(screen.getByRole("tab", { name: /All leads/ }));
    expect(screen.getByTestId("lead-card-Ana")).toBeInTheDocument();
    expect(screen.queryByTestId("board-card-Ana")).not.toBeInTheDocument();
  });
});
