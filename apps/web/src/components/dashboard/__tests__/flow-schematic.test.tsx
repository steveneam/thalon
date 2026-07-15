// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FlowSchematic } from "../flow-schematic";
import { fixturePlan, fixturePulse } from "@/lib/workspace/fixtures";
import { EMPTY_COUNTS } from "@/lib/workspace/types";

describe("FlowSchematic", () => {
  it("carries the counts at their stations, amber words only where work waits on the operator", () => {
    render(<FlowSchematic counts={fixturePulse.counts} plan={fixturePlan} unknown={false} />);
    // Judge + approve stations wear the signal channel with the WORD, never color alone.
    expect(screen.getByText("need your edit")).toHaveClass("text-signal");
    expect(screen.getByText("wait on your review")).toHaveClass("text-signal");
    // A failed run is a failure, not heat.
    expect(screen.getByText("1 failed — triage")).toHaveClass("text-destructive");
    // Stations are doorways.
    expect(screen.getByRole("link", { name: /01 · Intel/i })).toHaveAttribute("href", "/app/intel");
    expect(screen.getByRole("link", { name: /05 · Distribute/i })).toHaveAttribute("href", "/blog");
  });

  it("renders '–' for every pulse-backed count while the read is unresolved — never real-looking zeros", () => {
    render(<FlowSchematic counts={EMPTY_COUNTS} plan={null} unknown />);
    expect(screen.getAllByText("–")).toHaveLength(5);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.queryByText(/gates clear/)).not.toBeInTheDocument();
  });

  it("says so when no live sweep pointer exists — the future is never fabricated", () => {
    render(
      <FlowSchematic
        counts={fixturePulse.counts}
        plan={{ ...fixturePlan, sweep: null }}
        unknown={false}
      />,
    );
    expect(screen.getByText("no live sweeps armed yet")).toBeInTheDocument();
  });
});
