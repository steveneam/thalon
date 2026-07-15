// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/lib/testing/server";
import { SELECTED_ROW } from "@/lib/workspace/selected-row";
import type { LeadCard, LeadsPayload, TriageResult } from "@/lib/leads/types";
import { LeadsSurface } from "../leads-surface";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function card(partial: Partial<LeadCard>): LeadCard {
  return {
    id: "lead-1",
    source: "csv",
    email: "jane@acme.example",
    name: "Jane Doe",
    company: "Acme Plumbing",
    role: "Owner",
    website: null,
    notes: null,
    painPoint: null,
    status: "scored",
    pinned: false,
    createdAt: "2026-07-13T00:00:00.000Z",
    score: 0.82,
    reasons: [],
    scoredAt: "2026-07-13T01:00:00.000Z",
    profileHash: "icp-v1",
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
        counts: { new: 0, scored: leads.length, dismissed: 0 },
      } satisfies LeadsPayload),
    ),
  );
}

describe("leads keyboard grammar (s40 parity — the approve queue's j/k + act keys)", () => {
  it("j/k move the cursor (selected-row recipe + live region), x picks for bulk", async () => {
    const user = userEvent.setup();
    seedLeads([card({}), card({ id: "lead-2", email: "sam@x.example", name: "Sam Lee" })]);
    render(<LeadsSurface />);
    const first = await screen.findByTestId("lead-card-lead-1");
    const second = screen.getByTestId("lead-card-lead-2");
    expect(first.className).not.toContain(SELECTED_ROW);

    await user.keyboard("j");
    expect(first.className).toContain(SELECTED_ROW);
    expect(screen.getByText("Selected lead Jane Doe")).toBeInTheDocument();

    await user.keyboard("j");
    expect(second.className).toContain(SELECTED_ROW);
    expect(first.className).not.toContain(SELECTED_ROW);
    // Clamped at the end of the list.
    await user.keyboard("j");
    expect(second.className).toContain(SELECTED_ROW);
    await user.keyboard("k");
    expect(first.className).toContain(SELECTED_ROW);

    // x toggles the cursor card's checkbox — the bulk bar appears.
    await user.keyboard("x");
    expect(screen.getByRole("checkbox", { name: "Select Jane Doe" })).toBeChecked();
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    await user.keyboard("x");
    expect(screen.getByRole("checkbox", { name: "Select Jane Doe" })).not.toBeChecked();
  });

  it("d dismisses the cursor lead and the toast offers a way back to Dismissed", async () => {
    const user = userEvent.setup();
    seedLeads([card({}), card({ id: "lead-2", email: "sam@x.example", name: "Sam Lee" })]);
    const triaged: Array<{ action: string; ids: string[] }> = [];
    server.use(
      http.post("/api/leads/triage", async ({ request }) => {
        const body = (await request.json()) as { action: string; ids: string[] };
        triaged.push(body);
        return HttpResponse.json({ done: body.ids.length, failed: [] } satisfies TriageResult);
      }),
    );
    render(<LeadsSurface />);
    await screen.findByTestId("lead-card-lead-1");

    await user.keyboard("j");
    await user.keyboard("d");
    await waitFor(() => expect(triaged).toEqual([{ action: "dismiss", ids: ["lead-1"] }]));

    // Cheap undo-after-terminal (s40): toast + a link back to where it went.
    const toast = await screen.findByRole("status");
    expect(toast).toHaveTextContent(/lead dismissed/i);
    await user.click(screen.getByRole("button", { name: "View dismissed" }));
    expect(screen.getByRole("tab", { name: /dismissed/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
