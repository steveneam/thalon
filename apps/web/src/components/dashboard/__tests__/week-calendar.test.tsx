// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WeekCalendar } from "../week-calendar";
import type { PipelineAsset, PlanPayload } from "@/lib/workspace/types";

// Wednesday 2026-07-15 10:00 local, matching the week.test.ts clock.
const NOW = new Date(2026, 6, 15, 10, 0, 0);

function asset(overrides: Partial<PipelineAsset> & { draftId: string }): PipelineAsset {
  return {
    runId: "run-1",
    platform: "linkedin",
    format: null,
    status: "queued",
    sourceKind: "url",
    capturedAt: new Date(2026, 6, 14, 8, 0).toISOString(),
    generatedAt: new Date(2026, 6, 14, 9, 0).toISOString(),
    judgedAt: new Date(2026, 6, 14, 9, 5).toISOString(),
    decidedAt: null,
    publishedAt: null,
    gates: [],
    reasons: [],
    deployRef: null,
    ...overrides,
  };
}

const plan: PlanPayload = {
  sweep: {
    lastSweptAt: new Date(2026, 6, 15, 8, 0).toISOString(),
    nextSweepAt: new Date(2026, 6, 15, 12, 0).toISOString(),
    intervalMs: 24 * 3_600_000,
    source: "bluesky",
  },
  areas: 2,
  cadence: [{ platform: "linkedin", maxPerDay: 1, maxPerWeek: 5 }],
  assets: [
    asset({ draftId: "q1" }),
    asset({ draftId: "b1", status: "blocked", judgedAt: new Date(2026, 6, 15, 7, 0).toISOString() }),
    asset({ draftId: "a1", status: "approved", decidedAt: new Date(2026, 6, 13, 16, 0).toISOString() }),
  ],
};

describe("WeekCalendar", () => {
  it("renders the three-mark grammar: engine sweeps, waits-on-you links, and the legend", () => {
    render(<WeekCalendar status="success" plan={plan} now={NOW} />);

    // The honest three-mark legend.
    expect(screen.getByText("engine")).toBeInTheDocument();
    expect(screen.getByText("waits on you")).toBeInTheDocument();
    expect(screen.getByText("planned slot")).toBeInTheDocument();

    // Today wears aria-current; projected sweeps ride their days (engine WILL do).
    expect(document.querySelector('[aria-current="date"]')).not.toBeNull();
    expect(screen.getAllByText(/^sweep \d+:\d+$/).length).toBeGreaterThanOrEqual(5);

    // Waiting drafts land on the day they started waiting and deep-link to the entity.
    expect(screen.getByRole("link", { name: /linkedin · your review/i })).toHaveAttribute(
      "href",
      "/app/approve?run=run-1&draft=q1",
    );
    expect(screen.getByRole("link", { name: /linkedin · needs edit/i })).toBeInTheDocument();

    // The strip is forward-looking: decided outcomes are not marks (the
    // three-mark grammar — approve/runs carry the record).
    expect(screen.queryByText(/linkedin · approved/)).not.toBeInTheDocument();

    // Cadence allowances render as data, not promises.
    expect(screen.getByText(/linkedin ≤1\/day ≤5\/wk/)).toBeInTheDocument();

    // HONEST STATES: no publish path exists, so nothing may say "scheduled".
    expect(screen.queryByText(/scheduled/i)).not.toBeInTheDocument();
  });

  it("bounds each day at 3 marks then '+N more' (the calendar cell rule)", () => {
    const crowded: PlanPayload = {
      ...plan,
      assets: [
        asset({ draftId: "q1", judgedAt: new Date(2026, 6, 15, 6, 0).toISOString() }),
        asset({ draftId: "q2", judgedAt: new Date(2026, 6, 15, 7, 0).toISOString() }),
        asset({ draftId: "q3", judgedAt: new Date(2026, 6, 15, 8, 0).toISOString() }),
        asset({ draftId: "q4", judgedAt: new Date(2026, 6, 15, 9, 0).toISOString() }),
      ],
    };
    render(<WeekCalendar status="success" plan={crowded} now={NOW} />);
    // Today: 1 sweep tick + 4 waiting = 5 marks → 3 shown, +2 more.
    expect(screen.getByText("+2 more")).toBeInTheDocument();
  });

  it("says so when no live sweep pointer exists instead of projecting fiction", () => {
    render(<WeekCalendar status="success" plan={{ ...plan, sweep: null, cadence: [] }} now={NOW} />);
    expect(screen.getByText(/no live sweeps armed yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no cadence rules configured/i)).toBeInTheDocument();
    expect(screen.queryByText(/^sweep \d/)).not.toBeInTheDocument();
  });

  it("a failed plan read gets the named error + retry, never an empty-looking week", () => {
    render(<WeekCalendar status="error" plan={null} onRetry={() => {}} now={NOW} />);
    expect(screen.getByText(/couldn.t load the week/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
