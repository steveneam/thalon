// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DraftCard } from "@/components/approve/draft-card";
import { draft, run, verdict } from "@/lib/approve-queue/fixtures";

const RUN = run("11111111-1111-1111-1111-111111111111", "2026-07-04T09:00:00.000Z");

function gateNames(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll(".reason-gate")).map((el) => el.textContent ?? "");
}

/**
 * s77/s79 A3 — measured live on a real blocked draft: the checks band read
 * `✓ Grounding — screen` / `✗ Grounding — final` correctly, but the reasons
 * panel below it read `Denylist / Grounding / Grounding`, because the gate
 * name was recovered by splitting the LABEL on " — " rather than read from
 * the gate itself. The two rows that can disagree became indistinguishable —
 * directly above the composite note whose whole job is to say they disagreed.
 */
describe("the reasons panel names its gates", () => {
  const BLOCKED = draft("d1", RUN.id, "linkedin", "body", "blocked", "h");
  const DISAGREEING = [
    verdict("g1", "pass", "h"),
    verdict("g3_screen", "pass", "h", {
      claims: [{ claim: "Three releases in eight weeks", verdict: "pass", evidence: "supported" }],
    }),
    verdict("g3_final", "fail", "h", {
      claims: [
        { claim: "Three releases in eight weeks", verdict: "fail", evidence: "no provided source supports this claim" },
      ],
    }),
  ];

  function renderBlocked() {
    return render(
      <DraftCard
        status="success"
        draft={BLOCKED}
        run={RUN}
        judgeResults={DISAGREEING}
        busy={false}
        actionError={null}
        onApprove={() => {}}
        onReject={() => {}}
        onEditSave={() => {}}
        onReJudge={() => {}}
        onPublish={() => {}}
      />,
    );
  }

  it("distinguishes the two grounding tiers instead of collapsing both to 'Grounding'", () => {
    const { container } = renderBlocked();
    const names = gateNames(container);
    expect(names).toContain("Grounding — screen");
    expect(names).toContain("Grounding — final");
    expect(names.filter((n) => n === "Grounding")).toHaveLength(0);
  });

  it("gives every gate a distinct name, so no two rows read alike", () => {
    const { container } = renderBlocked();
    const names = gateNames(container);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain("Denylist");
  });

  it("keeps the composite note readable against the rows it describes", () => {
    renderBlocked();
    expect(
      screen.getByText(/The two grounding tiers returned different verdicts/),
    ).toBeInTheDocument();
  });

  it("does not let a failing gate's evidence leak into the gate NAME", () => {
    const { container } = renderBlocked();
    // The label carries "Grounding — final — <evidence>"; the name column
    // must be the gate, and the evidence belongs in the lines column.
    expect(gateNames(container)).not.toContain("Grounding — final — no provided source supports this claim");
    expect(container.querySelector(".reason-lines")?.textContent).toBeTruthy();
  });
});
