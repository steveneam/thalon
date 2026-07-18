// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { verdict } from "@/lib/approve-queue/fixtures";
import { JudgeVerdicts, judgeVerdictRows } from "../judge-verdicts";

const HASH = "hash-1";

describe("judgeVerdictRows — reasons verbatim, positive case included", () => {
  it("a passing check carries its recorded evidence verbatim (what grounded the claim)", () => {
    const rows = judgeVerdictRows(
      [
        verdict("g1", "pass", HASH),
        verdict("g3_screen", "pass", HASH, {
          claims: [{ claim: "six hours a week", verdict: "pass", evidence: "source thread" }],
        }),
        verdict("g3_final", "pass", HASH),
      ],
      HASH,
    );
    const screening = rows.find((r) => r.gate === "g3_screen");
    expect(screening?.verdict).toBe("pass");
    expect(screening?.lines).toEqual(["six hours a week — source thread"]);
  });

  it("a pass with no recorded claims says so honestly instead of inventing a reason", () => {
    const rows = judgeVerdictRows([verdict("g1", "pass", HASH)], HASH);
    const denylist = rows.find((r) => r.gate === "g1");
    expect(denylist?.lines).toEqual(["passed — no claims recorded for this check"]);
  });

  it("a failing check carries the failing claim + evidence verbatim", () => {
    const rows = judgeVerdictRows(
      [
        verdict("g3_final", "fail", HASH, {
          claims: [
            { claim: "saves ten minutes per draft", verdict: "fail", evidence: "not in any provided source" },
          ],
        }),
      ],
      HASH,
    );
    const final = rows.find((r) => r.gate === "g3_final");
    expect(final?.verdict).toBe("fail");
    expect(final?.lines).toEqual(["saves ten minutes per draft — not in any provided source"]);
  });

  it("only rows for the CURRENT body hash are live evidence — stale verdicts read as pending", () => {
    const rows = judgeVerdictRows([verdict("g1", "pass", "hash-old")], HASH);
    const denylist = rows.find((r) => r.gate === "g1");
    expect(denylist?.verdict).toBe("pending");
    expect(denylist?.lines).toEqual(["no verdict yet for the current body"]);
  });
});

describe("JudgeVerdicts — the receipt", () => {
  it("renders one row per check with its mark and label, and the overall word", () => {
    render(
      <JudgeVerdicts
        results={[
          verdict("g1", "pass", HASH),
          verdict("g3_screen", "pass", HASH),
          verdict("g3_final", "pass", HASH),
        ]}
        bodyHash={HASH}
      />,
    );
    const receipt = screen.getByRole("group", { name: "Judge verdicts" });
    expect(receipt).toHaveAttribute("data-overall", "pass");
    expect(within(receipt).getByText("Pass")).toBeInTheDocument();
    expect(within(receipt).getByText("Denylist")).toBeInTheDocument();
    expect(within(receipt).getByText("Grounding — screen")).toBeInTheDocument();
    expect(within(receipt).getByText("Grounding — final")).toBeInTheDocument();
  });

  it("tier disagreement blocks legibly, with the rule stated in operator copy", () => {
    render(
      <JudgeVerdicts
        results={[
          verdict("g1", "pass", HASH),
          verdict("g3_screen", "pass", HASH),
          verdict("g3_final", "fail", HASH),
        ]}
        bodyHash={HASH}
      />,
    );
    const receipt = screen.getByRole("group", { name: "Judge verdicts" });
    expect(receipt).toHaveAttribute("data-overall", "blocked_disagreement");
    expect(within(receipt).getByText("Blocked — disagreement")).toBeInTheDocument();
    expect(within(receipt).getByText(/two grounding tiers returned different verdicts/)).toBeInTheDocument();
  });
});
