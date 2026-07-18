// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NeedsYouList, needsYouRows } from "../needs-you-list";
import type { PipelineAsset, PlanPayload, PulseCounts } from "@/lib/workspace/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const NOW = new Date(2026, 6, 15, 10, 0, 0);

const counts: PulseCounts = {
  runs: 0,
  runsWithErrors: 0,
  drafts: 3,
  queued: 2,
  blocked: 1,
  approved: 0,
};

function asset(overrides: Partial<PipelineAsset> & { draftId: string }): PipelineAsset {
  return {
    runId: "run-1",
    platform: "linkedin",
    format: null,
    status: "queued",
    sourceKind: "url",
    capturedAt: new Date(2026, 6, 14, 7, 0).toISOString(),
    generatedAt: new Date(2026, 6, 14, 8, 0).toISOString(),
    judgedAt: new Date(2026, 6, 14, 8, 0).toISOString(),
    decidedAt: null,
    publishedAt: null,
    gates: [],
    reasons: [],
    deployRef: null,
    ...overrides,
  };
}

const plan: PlanPayload = {
  sweep: null,
  areas: 0,
  cadence: [],
  assets: [
    asset({ draftId: "q-new", judgedAt: new Date(2026, 6, 15, 6, 0).toISOString() }),
    asset({ draftId: "q-old", platform: "x", format: "post" }),
    asset({ draftId: "b1", status: "blocked" }),
  ],
};

beforeEach(() => {
  push.mockClear();
});

describe("needsYouRows", () => {
  it("puts the oldest queued draft first and folds the blocked set into one row", () => {
    const rows = needsYouRows(plan.assets);
    expect(rows.map((r) => r.key)).toEqual(["q-old", "q-new", "blocked-group"]);
    expect(rows[0].text).toBe("x · post — your review");
    expect(rows[2].text).toBe("1 draft blocked — reasons attached");
  });
});

describe("NeedsYouList", () => {
  it("states its bound and moves the selection with j/k, opening on Enter", () => {
    render(<NeedsYouList counts={counts} status="success" plan={plan} now={NOW} />);

    expect(screen.getByText("3")).toBeInTheDocument(); // header count chip
    expect(screen.getByText(/the list is bounded — the page never grows with it/)).toBeInTheDocument();

    // Row 0 selected by default; Enter opens it.
    fireEvent.keyDown(window, { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/app/approve?run=run-1&draft=q-old");

    // j moves down, Enter opens the second row.
    fireEvent.keyDown(window, { key: "j" });
    fireEvent.keyDown(window, { key: "Enter" });
    expect(push).toHaveBeenLastCalledWith("/app/approve?run=run-1&draft=q-new");

    // k moves back up.
    fireEvent.keyDown(window, { key: "k" });
    fireEvent.keyDown(window, { key: "Enter" });
    expect(push).toHaveBeenLastCalledWith("/app/approve?run=run-1&draft=q-old");
  });

  it("renders the quiet clear state when nothing waits", () => {
    render(
      <NeedsYouList
        counts={{ ...counts, queued: 0, blocked: 0 }}
        status="success"
        plan={{ ...plan, assets: [] }}
        now={NOW}
      />,
    );
    expect(screen.getByText(/Queue clear — nothing waits on you/)).toBeInTheDocument();
  });

  it("renders an honest error state with a retry", () => {
    const onRetry = vi.fn();
    render(<NeedsYouList counts={counts} status="error" plan={null} onRetry={onRetry} now={NOW} />);
    expect(screen.getByText(/Couldn.t read what needs you/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });
});
