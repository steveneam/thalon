// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JudgeBadge } from "../judge-badge";

const HASH = "h";
const r = (gate: string, verdict: "pass" | "fail") => ({
  gate,
  verdict,
  bodyHash: HASH,
  createdAt: "2026-07-04T00:00:00.000Z",
});

describe("JudgeBadge", () => {
  it("renders pass", () => {
    render(<JudgeBadge results={[r("g1", "pass"), r("g3_screen", "pass"), r("g3_final", "pass")]} bodyHash={HASH} />);
    expect(screen.getByText("Pass")).toBeInTheDocument();
  });

  it("renders fail", () => {
    render(<JudgeBadge results={[r("g1", "pass"), r("g3_screen", "fail"), r("g3_final", "fail")]} bodyHash={HASH} />);
    expect(screen.getByText("Fail")).toBeInTheDocument();
  });

  it("renders blocked-disagreement", () => {
    render(<JudgeBadge results={[r("g1", "pass"), r("g3_screen", "pass"), r("g3_final", "fail")]} bodyHash={HASH} />);
    expect(screen.getByText("Blocked — disagreement")).toBeInTheDocument();
  });

  it("renders pending when no gates have run", () => {
    render(<JudgeBadge results={[]} bodyHash={HASH} />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("surfaces each known gate's own verdict alongside the overall badge", () => {
    render(<JudgeBadge results={[r("g1", "pass"), r("g3_screen", "pass"), r("g3_final", "pass")]} bodyHash={HASH} />);
    expect(screen.getByText("g1: pass")).toBeInTheDocument();
    expect(screen.getByText("g3_screen: pass")).toBeInTheDocument();
    expect(screen.getByText("g3_final: pass")).toBeInTheDocument();
  });
});
