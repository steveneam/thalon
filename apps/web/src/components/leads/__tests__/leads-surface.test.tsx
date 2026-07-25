// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LeadsSurface } from "../leads-surface";

/**
 * STEP 1 of the two-step rebuild: a STRUCTURAL pin of the sheet's own bands
 * (docs/research/mock-sheets/Leads.dc.html). No data is wired yet, so what is
 * pinned here is the geometry and copy grammar the founder verdicts —
 * step 2's suite re-pins the same bands carrying real reads.
 */
describe("Leads (exact-mock rebuild — Leads.dc.html, step 1 port)", () => {
  it("renders the sheet's header band: title, count pills, the List/Board seg and the import door", () => {
    const { container } = render(<LeadsSurface />);

    expect(screen.getByRole("heading", { name: "Leads" })).toHaveClass("t-headline");
    expect(screen.getByText("12 scored")).toHaveClass("pill", "pill-idle");
    expect(screen.getByText("2 hot · follow up")).toHaveClass("pill", "pill-warn");

    const seg = container.querySelector(".seg");
    expect(Array.from(seg?.children ?? []).map((el) => el.textContent)).toEqual(["List", "Board"]);
    expect(seg?.querySelector(".seg-opt.on")?.textContent).toBe("List");
    expect(screen.getByText("Import contacts")).toHaveClass("btn", "btn-ghost", "btn-sm");
  });

  it("renders the sheet's split: the ranked list card over the lead detail card", () => {
    const { container } = render(<LeadsSurface />);

    expect(container.querySelectorAll(".split > .card")).toHaveLength(2);

    // Four ranked rows, the first selected, each with badge + name + excerpt + score chip.
    const rows = container.querySelectorAll(".split .row");
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveClass("sel");
    expect(rows[0].querySelector(".mono-badge")?.textContent).toBe("MK");
    expect(rows[0].querySelector(".lead-name")?.textContent).toBe(
      "Mara Kessler · Fieldline Robotics",
    );
    expect(rows[0].querySelector(".excerpt")?.textContent).toBe(
      "Ops lead · asked about content automation on the webinar",
    );
    expect(rows[0].querySelector(".score-chip .t-data")?.textContent).toBe("0.88");
    expect(rows[0].querySelector<HTMLElement>(".score-chip .bar-fill")?.style.width).toBe("88%");

    // The list card's footer states the ordering rule and the keyboard grammar.
    expect(screen.getByText("best fit first · reasons on every score")).toHaveClass("t-label");
    expect(Array.from(container.querySelectorAll(".kbd")).map((el) => el.textContent)).toEqual([
      "j",
      "k",
    ]);
    expect(screen.getByText("move")).toHaveClass("t-label");
  });

  it("renders the detail card's three bands: why this score, activity, drafted outreach", () => {
    const { container } = render(<LeadsSurface />);

    const head = container.querySelector(".card-head");
    expect(head?.querySelector(".t-title")?.textContent).toBe("Mara Kessler · Fieldline Robotics");
    expect(head?.querySelector(".pill-warn")?.textContent).toBe("follow up");
    expect(head?.querySelector(".t-data")?.textContent).toBe("#8c31f2aa");

    expect(
      Array.from(container.querySelectorAll(".sec-label")).map((el) => el.textContent),
    ).toEqual([
      "Why this score",
      "Activity",
      "Drafted outreach — draft-only, never auto-sent",
    ]);

    // Every score reason is a named signal + its magnitude bar + the reason itself.
    const reasons = container.querySelectorAll(".reason");
    expect(reasons).toHaveLength(3);
    expect(reasons[0].querySelector(".rname")?.textContent).toBe("ICP fit 0.92");
    expect(reasons[0].querySelector<HTMLElement>(".bar-fill")?.style.width).toBe("92%");
    expect(container.querySelectorAll(".act-row")).toHaveLength(3);

    // The outreach band is draft-only, and the send is the operator's own act.
    expect(screen.getByText("judge passed")).toHaveClass("pill", "pill-ok");
    expect(container.querySelector(".mail")?.textContent).toContain(
      "mara@fieldline.example",
    );
    expect(
      Array.from(container.querySelectorAll(".mail ~ div .btn")).map((el) => el.textContent),
    ).toEqual(["Copy body", "Copy subject", "Open in your mail client", "Log a call"]);
    expect(screen.getByText("you send it — from your own mailbox")).toHaveClass("t-label");
  });

  it("carries no legacy bridge styling — the rebuilt surface speaks the sheet's classes", () => {
    const { container } = render(<LeadsSurface />);

    expect(container.querySelector('[class*="text-muted-foreground"]')).toBeNull();
    expect(container.querySelector('[class*="bg-card"]')).toBeNull();
    expect(container.querySelector('[class*="border-border"]')).toBeNull();
    expect(container.firstElementChild).toHaveClass("content", "leads-surface");
  });
});
