// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VideoEditor } from "@/components/videos/editor";

/**
 * STEP 1 of the two-step rebuild: the structural pin of Videos.dc.html.
 * Every assertion here is a band, a class or a copy line the sheet itself
 * draws — step 2 keeps this shape and puts the real cut behind it.
 */
describe("VideoEditor (exact-mock rebuild — Videos.dc.html, step 1)", () => {
  it("renders the sheet's bands: title row, copilot, timeline, takes, beats", () => {
    const { container } = render(<VideoEditor />);

    // The surface root carries the scope class the stylesheet is anchored to.
    expect(container.querySelector(".content.editor-surface")).not.toBeNull();

    expect(screen.getByRole("link", { name: "← Videos" })).toHaveAttribute("href", "/app/videos");
    expect(screen.getByRole("heading", { name: "One-prompt launch film" })).toBeInTheDocument();
    expect(screen.getByText("cut v1 · 42.3s")).toHaveClass("pill", "pill-idle");
    expect(screen.getByText("9 takes rendered")).toHaveClass("pill", "pill-ok");
    // The aspect lens, and the two doors beside it.
    expect(
      Array.from(container.querySelectorAll(".seg")[0].querySelectorAll(".seg-opt")).map(
        (el) => el.textContent,
      ),
    ).toEqual(["16:9", "9:16", "1:1"]);
    expect(screen.getByRole("button", { name: "Propose edits" })).toHaveClass("btn", "btn-ghost");
    expect(screen.getByRole("button", { name: "Send cut to Approve" })).toHaveClass(
      "btn",
      "btn-primary",
    );

    // The copilot band — the agent-native front door (founder s72).
    expect(container.querySelector(".copilot .cop-box")?.textContent).toContain(
      "the agent answers with a proposal on the timeline, never a silent change",
    );
    expect(Array.from(container.querySelectorAll(".chipbtn")).map((el) => el.textContent)).toEqual([
      "Tighten to 30s",
      "Recut 9:16",
      "Swap music",
      "Retake a beat",
    ]);
    expect(screen.getByRole("button", { name: "Propose" })).toHaveClass("btn", "btn-primary");

    // The proposal row: nothing applies until the operator says so.
    expect(screen.getByText("proposal")).toHaveClass("pill", "pill-warn");
    expect(screen.getByText(/nothing applies until you say so/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();

    // Three lanes: eight beats (one carrying the proposal), one music cue
    // with three measured crescendos, eight caption plates.
    expect(container.querySelectorAll(".tl-body .lane")).toHaveLength(3);
    expect(container.querySelectorAll(".lane-tr .blk")).toHaveLength(8);
    expect(container.querySelectorAll(".blk.on")).toHaveLength(1);
    expect(container.querySelectorAll(".blk.prop")).toHaveLength(1);
    expect(screen.getByText("−0.8s")).toHaveClass("prop-tag");
    expect(container.querySelectorAll(".blk-music .cresc")).toHaveLength(3);
    expect(container.querySelectorAll(".blk-cap")).toHaveLength(8);
    expect(container.querySelector(".tl-body .playhead")).not.toBeNull();

    // Takes strip for the picked beat, retake tile last.
    expect(screen.getByText("Takes — beat 02")).toHaveClass("t-title");
    expect(container.querySelectorAll(".strip .take")).toHaveLength(4);
    expect(screen.getByText("take 1 · keeper").closest(".take")).toHaveClass("on");
    expect(screen.getByText("5.0s · text drift")).toHaveClass("take-cap");

    // Beats rail — eight rows, the picked one marked.
    expect(container.querySelectorAll(".beat-row")).toHaveLength(8);
    expect(container.querySelectorAll(".beat-row.on")).toHaveLength(1);
    expect(screen.getByText("02 · The prompt goes in").closest(".beat-row")).toHaveClass("on");
    expect(screen.getByText(/every take’s reason on record/)).toHaveClass("t-label");
  });

  it("carries no legacy bridge styling — the rebuild speaks the sheet's own classes", () => {
    const { container } = render(<VideoEditor />);

    expect(container.querySelector('[class*="text-muted-foreground"]')).toBeNull();
    expect(container.querySelector('[class*="bg-muted"]')).toBeNull();
    expect(container.querySelector('[class*="border-border"]')).toBeNull();
  });
});
