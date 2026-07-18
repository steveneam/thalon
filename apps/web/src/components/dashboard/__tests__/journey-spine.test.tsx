// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JourneySpine } from "../journey-spine";
import type { TrendsPayload } from "@/lib/intel/types";
import type { PipelineAsset, PlanPayload, PulseCounts } from "@/lib/workspace/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Wednesday 2026-07-15 10:00 local — fixed clock, injectable everywhere.
const NOW = new Date(2026, 6, 15, 10, 0, 0);

const counts: PulseCounts = {
  runs: 4,
  runsWithErrors: 1,
  drafts: 11,
  queued: 2,
  blocked: 1,
  approved: 5,
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
    gates: [{ gate: "g1", verdict: "pass" }],
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
  cadence: [],
  assets: [
    // Oldest queued: waited 20h at NOW (past 24h the format helper rolls to days).
    asset({ draftId: "q-old", judgedAt: new Date(2026, 6, 14, 14, 0).toISOString() }),
    asset({ draftId: "q-new", judgedAt: new Date(2026, 6, 15, 6, 0).toISOString() }),
    asset({ draftId: "b1", status: "blocked" }),
    asset({ draftId: "j1", status: "judging" }),
  ],
};

const trends: TrendsPayload = {
  areas: [],
  cards: [
    {
      id: "t1",
      source: "bluesky",
      externalId: "at://x/1",
      text: "Solo operators are automating first-pass content review",
      account: "@ops",
      publishedAt: new Date(2026, 6, 14, 15, 0).toISOString(),
      areaName: "automation",
      score: 0.82,
      reasons: [],
      isOutlier: false,
      shareToView: null,
      bookmarkToView: null,
      metrics: {},
    },
    {
      id: "t2",
      source: "bluesky",
      externalId: "at://x/2",
      text: "Quieter topic",
      account: "@b",
      publishedAt: new Date(2026, 6, 15, 1, 0).toISOString(),
      areaName: "automation",
      score: 0.4,
      reasons: [],
      isOutlier: false,
      shareToView: null,
      bookmarkToView: null,
      metrics: {},
    },
  ],
  demo: false,
  sweep: {
    lastSweptAt: new Date(2026, 6, 15, 8, 0).toISOString(),
    intervalHours: 4,
    nextSweepAt: new Date(2026, 6, 15, 12, 0).toISOString(),
  },
};

describe("JourneySpine", () => {
  it("shows live station state: intel peek, oldest-queued wait, in-flight create, honest fan-out", () => {
    render(<JourneySpine counts={counts} plan={plan} trends={trends} unknown={false} now={NOW} />);

    // 01: the top-scored card peeks with its heat grade; the stamp is live.
    expect(screen.getByText("live")).toBeInTheDocument();
    expect(
      screen.getByText("Solo operators are automating first-pass content review"),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /heat hot/ })).toBeInTheDocument();
    expect(screen.getByText(/swept 2h ago · next in 2h/)).toBeInTheDocument();

    // 03: one in-flight draft, named at its gate.
    expect(screen.getByText("at the judge gate")).toBeInTheDocument();

    // 04: pulse count + the oldest queued draft's honest wait.
    expect(screen.getByText("2 waiting")).toBeInTheDocument();
    expect(screen.getByText("oldest has waited 20h")).toBeInTheDocument();
    expect(screen.getByText(/1 more blocked by the judge/)).toBeInTheDocument();

    // 05: nothing scheduled — say so, never fake a plan.
    expect(screen.getByText(/Nothing is scheduled — planning lands with the calendar/)).toBeInTheDocument();
    expect(screen.getByText(/5 approved and ready to plan/)).toBeInTheDocument();
  });

  it("renders '–' (not zeros) while the pulse read is unresolved", () => {
    render(<JourneySpine counts={counts} plan={plan} trends={null} unknown now={NOW} />);
    expect(screen.getAllByText("not loaded").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("2 waiting")).not.toBeInTheDocument();
  });
});
