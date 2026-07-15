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
  it("shows projected sweeps, waiting drafts as entity links, decisions, and the cadence strip", () => {
    render(<WeekCalendar status="success" plan={plan} now={NOW} />);

    // Today is marked; projected sweep ticks ride their days (engine WILL do).
    expect(screen.getByText("· today")).toBeInTheDocument();
    expect(screen.getAllByText("sweep").length).toBeGreaterThanOrEqual(5);

    // Waiting drafts land on the day they started waiting and deep-link to the entity.
    expect(screen.getByRole("link", { name: /linkedin · your review/i })).toHaveAttribute(
      "href",
      "/app/approve?run=run-1&draft=q1",
    );
    expect(screen.getByRole("link", { name: /linkedin · needs edit/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /linkedin · approved/i })).toBeInTheDocument();

    // Cadence allowances render as data, not promises.
    expect(screen.getByText(/linkedin ≤1\/day ≤5\/wk/)).toBeInTheDocument();

    // HONEST STATES: no publish path exists, so nothing may say "scheduled".
    expect(screen.queryByText(/scheduled/i)).not.toBeInTheDocument();
  });

  it("says so when no live sweep pointer exists instead of projecting fiction", () => {
    render(<WeekCalendar status="success" plan={{ ...plan, sweep: null, cadence: [] }} now={NOW} />);
    expect(screen.getByText(/no live sweeps armed yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no cadence rules configured/i)).toBeInTheDocument();
    expect(screen.queryByText("sweep")).not.toBeInTheDocument();
  });

  it("a failed plan read gets the named error + retry, never an empty-looking week", () => {
    render(<WeekCalendar status="error" plan={null} onRetry={() => {}} now={NOW} />);
    expect(screen.getByText(/couldn.t load the week/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
