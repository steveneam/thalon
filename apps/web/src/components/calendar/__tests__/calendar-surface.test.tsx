// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/lib/testing/server";
import type { PipelineAsset, PlanPayload } from "@/lib/workspace/types";
import { CalendarSurface } from "../calendar-surface";

function todayAt(hour: number, minute = 0): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function asset(overrides: Partial<PipelineAsset> & { draftId: string }): PipelineAsset {
  return {
    runId: "run-1",
    platform: "linkedin",
    format: "post",
    status: "queued",
    sourceKind: "url",
    capturedAt: null,
    generatedAt: todayAt(9),
    judgedAt: null,
    decidedAt: null,
    publishedAt: null,
    gates: [],
    reasons: [],
    deployRef: null,
    excerpt: "fixture excerpt",
    ...overrides,
  };
}

function seedPlan(assets: PipelineAsset[]) {
  server.use(
    http.get("/api/app/plan", () =>
      HttpResponse.json({ sweep: null, areas: 0, cadence: [], assets, plannedSlots: [] } satisfies PlanPayload),
    ),
  );
}

describe("fan-out calendar surface (Phase I)", () => {
  it("renders the header honestly: zone chip, density tabs, disabled Plan slot with the reason, gated count", async () => {
    seedPlan([
      asset({ draftId: "q1" }),
      asset({
        draftId: "b1",
        platform: "x",
        status: "blocked",
        generatedAt: todayAt(11),
        reasons: ["Grounding — one claim has no provided source."],
      }),
    ]);
    render(<CalendarSurface />);
    await screen.findByTestId("slot-chip-q1");

    expect(screen.getByRole("heading", { name: "Fan-out" })).toBeInTheDocument();
    expect(screen.getByText(/operator-local/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "month" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "week" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "agenda" })).toBeInTheDocument();
    // The publish door is unarmed and no slot store exists — the surface says so.
    const planSlot = screen.getByRole("button", { name: "Plan slot" });
    expect(planSlot).toBeDisabled();
    expect(planSlot.title).toMatch(/publish bucket/);
    expect(screen.getByText(/2 drafts this month · 1 gated · publish door unarmed/)).toBeInTheDocument();
    // Chip anatomy: one status word; gated wears the signal dress, words carry state.
    expect(within(screen.getByTestId("slot-chip-b1")).getByText("gated")).toBeInTheDocument();
    expect(within(screen.getByTestId("slot-chip-q1")).getByText("queued")).toBeInTheDocument();
  });

  it("caps a day cell at 3 chips with +N more opening the bounded day panel — same route, no navigation", async () => {
    seedPlan([
      asset({ draftId: "a", generatedAt: todayAt(9) }),
      asset({ draftId: "b", generatedAt: todayAt(10) }),
      asset({ draftId: "c", generatedAt: todayAt(11) }),
      asset({ draftId: "d", generatedAt: todayAt(12) }),
    ]);
    render(<CalendarSurface />);
    await screen.findByTestId("slot-chip-a");

    const more = screen.getByRole("button", { name: "+1 more" });
    await userEvent.click(more);
    const panel = screen.getByTestId("day-panel");
    expect(within(panel).getByText("4 items")).toBeInTheDocument();
    expect(within(panel).getByText(/day list is bounded — scrolls internally past 8/)).toBeInTheDocument();
    // The panel's Plan slot is honest too.
    expect(within(panel).getByRole("button", { name: "Plan slot on this day" })).toBeDisabled();
  });

  it("moves the selected day with j/k (live region announces) and Enter toggles the panel", async () => {
    const user = userEvent.setup();
    seedPlan([asset({ draftId: "a" })]);
    const { container } = render(<CalendarSurface />);
    await screen.findByTestId("slot-chip-a");

    const live = container.querySelector("p[aria-live]");
    const before = live?.textContent;
    expect(before).toMatch(/Selected/);
    await user.keyboard("j");
    expect(live?.textContent).not.toBe(before);
    await user.keyboard("k");
    expect(live?.textContent).toBe(before);

    expect(screen.queryByTestId("day-panel")).not.toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("day-panel")).toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(screen.queryByTestId("day-panel")).not.toBeInTheDocument();
  });

  it("filters with first-class exclusion: only → not → off, counts stated, no silent truncation", async () => {
    const user = userEvent.setup();
    seedPlan([
      asset({ draftId: "q1" }),
      asset({ draftId: "b1", status: "blocked", generatedAt: todayAt(11) }),
    ]);
    render(<CalendarSurface />);
    await screen.findByTestId("slot-chip-q1");

    const gatedChip = screen.getByRole("button", { name: "gated" });
    await user.click(gatedChip);
    expect(screen.getByText(/1 of 2 drafts this month/)).toBeInTheDocument();
    expect(screen.queryByTestId("slot-chip-q1")).not.toBeInTheDocument();
    expect(screen.getByTestId("slot-chip-b1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "gated" }));
    expect(screen.getByRole("button", { name: "not: gated ×" })).toBeInTheDocument();
    expect(screen.getByTestId("slot-chip-q1")).toBeInTheDocument();
    expect(screen.queryByTestId("slot-chip-b1")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "not: gated ×" }));
    expect(screen.getByText(/2 drafts this month/)).toBeInTheDocument();
  });

  it("week density collapses quiet hours with an honest count and expands to the full window", async () => {
    const user = userEvent.setup();
    seedPlan([
      asset({ draftId: "day1", generatedAt: todayAt(9) }),
      asset({ draftId: "night1", generatedAt: todayAt(21, 30) }),
    ]);
    render(<CalendarSurface />);
    await screen.findByTestId("slot-chip-day1");

    await user.click(screen.getByRole("tab", { name: "week" }));
    expect(screen.getByText(/quiet hours \(20:00–06:00\) collapsed · 1 draft inside/)).toBeInTheDocument();
    expect(screen.getByTestId("week-slot-day1")).toBeInTheDocument();
    expect(screen.queryByTestId("week-slot-night1")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "expand" }));
    expect(screen.getByText("full 24h window shown")).toBeInTheDocument();
    expect(screen.getByTestId("week-slot-night1")).toBeInTheDocument();
  });

  it("agenda density is the bounded chronological list with its count stated", async () => {
    const user = userEvent.setup();
    seedPlan([asset({ draftId: "a" }), asset({ draftId: "b", generatedAt: todayAt(15) })]);
    render(<CalendarSurface />);
    await screen.findByTestId("slot-chip-a");

    await user.click(screen.getByRole("tab", { name: "agenda" }));
    expect(screen.getByText(/2 drafts in .+ · chronological — list scrolls internally/)).toBeInTheDocument();
  });
});
