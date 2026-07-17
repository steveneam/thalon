// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/lib/testing/server";
import type { LeadCard, LeadsPayload, TriageResult } from "@/lib/leads/types";
import { LeadsSurface } from "../leads-surface";

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

function card(partial: Partial<LeadCard>): LeadCard {
  return {
    id: "lead-1",
    source: "csv",
    email: "jane@acme.example",
    name: "Jane Doe",
    company: "Acme Plumbing",
    role: "Owner",
    website: "https://acme.example",
    notes: null,
    painPoint: null,
    status: "scored",
    pinned: false,
    createdAt: "2026-07-13T00:00:00.000Z",
    score: 0.82,
    reasons: ["fit 1 (role \"Owner\" matches \"owner\")", "completeness 0.8 (4/5 contact fields present)"],
    scoredAt: "2026-07-13T01:00:00.000Z",
    profileHash: "icp-v1",
    weightStateId: null,
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

describe("leads surface (B-crm.2)", () => {
  it("renders ranked cards with the thermal grade, verbatim reasons, pain point, and per-family exits", async () => {
    seedLeads({
      leads: [
        card({ painPoint: "no online booking; loses after-hours calls" }),
        card({ id: "lead-2", email: "bare@x.example", name: null, company: null, role: null, website: null, score: null, status: "new", reasons: [], profileHash: null }),
      ],
      counts: { new: 1, scored: 1, dismissed: 0 },
    });
    render(<LeadsSurface />);

    const row = within(await screen.findByTestId("lead-card-lead-1"));
    expect(row.getByText("Jane Doe")).toBeInTheDocument();
    // 0.82 lands in the hot band; the first reason rides the accessible label.
    expect(row.getByRole("img", { name: /heat hot/i })).toHaveAccessibleName(/role "Owner" matches/i);
    expect(row.getByText(/no online booking/)).toBeInTheDocument();
    for (const exit of ["Post", "Video", "Page", "Email"]) {
      expect(row.getByRole("button", { name: exit })).toBeInTheDocument();
    }
    // An unscored lead is honest about it — no invented grade.
    const bare = within(screen.getByTestId("lead-card-lead-2"));
    expect(bare.getByText("not scored yet")).toBeInTheDocument();
    expect(bare.queryByRole("img", { name: /heat/i })).not.toBeInTheDocument();
  });

  it("the s29 riders: contact email reads as a mailto link and unmapped import columns surface as extras", async () => {
    seedLeads({
      leads: [card({ extras: [{ key: "Phone 1", value: "+61 400 000 000" }] })],
      counts: { new: 0, scored: 1, dismissed: 0 },
    });
    render(<LeadsSurface />);

    const row = within(await screen.findByTestId("lead-card-lead-1"));
    expect(row.getByRole("link", { name: "jane@acme.example" })).toHaveAttribute(
      "href",
      "mailto:jane@acme.example",
    );
    expect(row.getByText("everything else from the import (1)")).toBeInTheDocument();
    expect(row.getByText("+61 400 000 000")).toBeInTheDocument();
  });

  it("bulk dismiss: multi-select → ONE confirm with the count → one triage call (FRONTEND §0)", async () => {
    seedLeads({
      leads: [card({}), card({ id: "lead-2", email: "b@x.example", name: "Bob Roe" })],
      counts: { new: 0, scored: 2, dismissed: 0 },
    });
    const triageCalls: Array<{ action: string; ids: string[] }> = [];
    server.use(
      http.post("/api/leads/triage", async ({ request }) => {
        const body = (await request.json()) as { action: string; ids: string[] };
        triageCalls.push(body);
        return HttpResponse.json({ done: body.ids.length, failed: [] } satisfies TriageResult);
      }),
    );
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(<LeadsSurface />);

    await user.click(await screen.findByRole("checkbox", { name: /select jane doe/i }));
    await user.click(screen.getByRole("checkbox", { name: /select bob roe/i }));
    await user.click(screen.getByRole("button", { name: /dismiss selected/i }));

    expect(confirmSpy).toHaveBeenCalledExactlyOnceWith("Dismiss 2 selected leads?");
    expect(triageCalls).toEqual([{ action: "dismiss", ids: ["lead-1", "lead-2"] }]);
    expect(await screen.findByRole("status")).toHaveTextContent(/dismissed 2 leads/i);
    confirmSpy.mockRestore();
  });

  it("a per-family exit promotes and routes to Create with the capture id", async () => {
    seedLeads({
      leads: [card({})],
      counts: { new: 0, scored: 1, dismissed: 0 },
    });
    server.use(
      http.post("/api/leads/promote", () =>
        HttpResponse.json({ createHref: "/app/create?ctx=intel-capture-9" }),
      ),
    );
    const user = userEvent.setup();
    render(<LeadsSurface />);
    await user.click(await screen.findByRole("button", { name: "Post" }));
    expect(routerPush).toHaveBeenCalledWith("/app/create?ctx=intel-capture-9");
  });

  it("empty queue is a tutorial; unarmed scoring says how to arm it", async () => {
    seedLeads({ scoringArmed: false, currentProfileHash: null });
    render(<LeadsSurface />);
    expect(await screen.findByText(/no leads yet — three ways in/i)).toBeInTheDocument();
    expect(screen.getByText(/isn.t armed yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /score now/i })).toBeDisabled();
  });
});
