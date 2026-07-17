// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/lib/testing/server";
import type { LeadCard, LeadsPayload, LearnReport } from "@/lib/leads/types";
import { LeadsSurface } from "../leads-surface";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const STATE = {
  id: "7f3a9c1e-0000-4000-8000-000000000000",
  computedAt: "2026-07-16T00:00:00.000Z",
  rows: 13,
  verdicts: 11,
  multipliers: { relevance: 1, fit: 1.25, completeness: 1, recency: 0.8 },
};

function card(partial: Partial<LeadCard>): LeadCard {
  return {
    id: "lead-1",
    source: "csv",
    email: "jane@acme.example",
    name: "Jane Doe",
    company: null,
    role: null,
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
    weightStateId: STATE.id,
    extras: [],
    ...partial,
  };
}

function seedLeads(payload: Partial<LeadsPayload>) {
  server.use(
    http.get("/api/leads", () =>
      HttpResponse.json({
        leads: [],
        scoringArmed: true,
        currentProfileHash: "icp-v1",
        learnedWeights: { state: null, staleForProfile: false },
        counts: { new: 0, scored: 0, dismissed: 0 },
        ...payload,
      } satisfies LeadsPayload),
    ),
  );
}

function learnReport(partial: Partial<LearnReport>): LearnReport {
  return {
    armed: true,
    rows: 13,
    verdicts: 11,
    stateId: STATE.id,
    created: true,
    multipliers: STATE.multipliers,
    reasons: ["learned from 11 triage verdicts"],
    profileHash: "icp-v1",
    ...partial,
  };
}

describe("weights provenance (B-crm.5 back half)", () => {
  it("shows the learned state's id, age, evidence size, and per-signal multipliers — applied to every scored lead", async () => {
    seedLeads({
      leads: [card({}), card({ id: "lead-2", email: "b@x.example" })],
      learnedWeights: { state: STATE, staleForProfile: false },
      counts: { new: 0, scored: 2, dismissed: 0 },
    });
    render(<LeadsSurface />);

    const panel = await screen.findByTestId("weights-provenance");
    expect(panel).toHaveTextContent("Learned");
    expect(panel).toHaveTextContent("state 7f3a9c1e");
    expect(panel).toHaveTextContent("from 11 verdicts (13 triage rows)");
    expect(panel).toHaveTextContent("relevance ×1.00 · fit ×1.25 · completeness ×1.00 · recency ×0.80");
    expect(panel).toHaveTextContent("applied to all 2 scored leads");
  });

  it("flags scored leads still riding an older state as a signal, never an error", async () => {
    seedLeads({
      leads: [card({}), card({ id: "lead-2", email: "b@x.example", weightStateId: null })],
      learnedWeights: { state: STATE, staleForProfile: false },
      counts: { new: 0, scored: 2, dismissed: 0 },
    });
    render(<LeadsSurface />);

    const panel = await screen.findByTestId("weights-provenance");
    expect(panel).toHaveTextContent(
      "1 of 2 scored leads riding older weights — Score now refreshes them",
    );
  });

  it("a drifted ICP reads as base-weights-until-relearned; base weights before any learning teach the loop", async () => {
    seedLeads({ learnedWeights: { state: null, staleForProfile: true } });
    render(<LeadsSurface />);
    const panel = await screen.findByTestId("weights-provenance");
    expect(panel).toHaveTextContent("Base weights");
    expect(panel).toHaveTextContent(
      "The ICP changed since weights were last learned — scores ride base weights until the loop re-runs.",
    );
  });

  it("no panel while scoring is unarmed — the arming notice owns that state", async () => {
    seedLeads({ scoringArmed: false, currentProfileHash: null });
    render(<LeadsSurface />);
    await screen.findByText(/no leads yet/i);
    expect(screen.queryByTestId("weights-provenance")).not.toBeInTheDocument();
  });

  it("Learn from feedback hits the learn route and reports the new state inline", async () => {
    seedLeads({
      leads: [card({ weightStateId: null })],
      counts: { new: 0, scored: 1, dismissed: 0 },
    });
    let learnCalls = 0;
    server.use(
      http.post("/api/leads/learn", () => {
        learnCalls++;
        return HttpResponse.json(learnReport({ verdicts: 5 }));
      }),
    );
    const user = userEvent.setup();
    render(<LeadsSurface />);

    await user.click(await screen.findByRole("button", { name: /learn from feedback/i }));
    expect(learnCalls).toBe(1);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Learned new weights from 5 verdicts — Score now applies them.",
    );
  });

  it("a replay and a not-armed refusal both surface honestly", async () => {
    seedLeads({ leads: [card({})], counts: { new: 0, scored: 1, dismissed: 0 } });
    server.use(
      http.post("/api/leads/learn", () =>
        HttpResponse.json(learnReport({ created: false })),
      ),
    );
    const user = userEvent.setup();
    render(<LeadsSurface />);
    await user.click(await screen.findByRole("button", { name: /learn from feedback/i }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "No change — the learned weights already reflect every verdict.",
    );

    server.use(
      http.post("/api/leads/learn", () =>
        HttpResponse.json(
          learnReport({ armed: false, reason: "no active brand profile", verdicts: 0, stateId: null, created: false }),
        ),
      ),
    );
    await user.click(screen.getByRole("button", { name: /learn from feedback/i }));
    expect(await screen.findByRole("status")).toHaveTextContent("no active brand profile");
  });
});
