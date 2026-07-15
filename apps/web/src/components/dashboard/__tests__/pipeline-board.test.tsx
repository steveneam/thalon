// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PipelineBoard } from "../pipeline-board";
import type { PipelineAsset } from "@/lib/workspace/types";

function asset(overrides: Partial<PipelineAsset> & { draftId: string }): PipelineAsset {
  return {
    runId: "run-1",
    platform: "linkedin",
    format: null,
    status: "queued",
    sourceKind: "url",
    capturedAt: "2026-07-14T08:00:00.000Z",
    generatedAt: "2026-07-14T09:00:00.000Z",
    judgedAt: "2026-07-14T09:05:00.000Z",
    decidedAt: null,
    publishedAt: null,
    gates: [{ gate: "g1", verdict: "pass" }],
    reasons: [],
    deployRef: null,
    ...overrides,
  };
}

const assets = [
  asset({ draftId: "q1" }),
  asset({
    draftId: "b1",
    platform: "x",
    status: "blocked",
    reasons: ["Denylist: body text — matched a term"],
  }),
  asset({ draftId: "r1", status: "rejected", decidedAt: "2026-07-14T10:00:00.000Z" }),
];

describe("PipelineBoard", () => {
  it("steps lens: each asset's journey with stage links and the blocked WHY", () => {
    render(<PipelineBoard status="success" assets={assets} />);

    // The queued asset's decided stage waits on the operator (word, not just color).
    const journey = screen.getByRole("list", { name: /linkedin journey/i });
    expect(journey).toHaveTextContent("Decided");
    // Reached stages open their artifacts.
    expect(screen.getAllByRole("link", { name: /Generated/ })[0]).toHaveAttribute(
      "href",
      "/app/runs?run=run-1",
    );
    // Blocked asset explains itself in plain language.
    expect(screen.getByText(/matched a term/)).toBeInTheDocument();
    // Rejected is terminal noise — not a stepper row.
    expect(screen.queryByRole("list", { name: /rejected/i })).not.toBeInTheDocument();
  });

  it("board lens: the same rows grouped by station, rejected demoted to a count", async () => {
    const user = userEvent.setup();
    render(<PipelineBoard status="success" assets={assets} />);

    await user.click(screen.getByRole("button", { name: "Board" }));
    expect(screen.getByRole("button", { name: "Board" })).toHaveAttribute("aria-pressed", "true");

    const review = screen.getByRole("region", { name: "Your review" });
    expect(review).toHaveTextContent("linkedin");
    const blocked = screen.getByRole("region", { name: "Needs your edit" });
    expect(blocked).toHaveTextContent("x");
    expect(screen.getByText(/1 rejected in this window/)).toBeInTheDocument();
  });

  it("empty pipeline is a tutorial, not a blank", () => {
    render(<PipelineBoard status="success" assets={[]} />);
    expect(screen.getByText(/promote an intel card or create from a prompt/i)).toBeInTheDocument();
  });
});
