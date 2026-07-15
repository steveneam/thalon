// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApprovePanel } from "../approve-panel";
import { JudgeReasons } from "../judge-reasons";
import { draftB, fixtureDraftDetails, FIXTURE_DRAFT_B_ID } from "@/lib/approve-queue/fixtures";

const noop = () => {};

describe("JudgeReasons", () => {
  it("renders the failing claim in plain language under a readable gate name", () => {
    render(
      <JudgeReasons
        results={fixtureDraftDetails[FIXTURE_DRAFT_B_ID].judgeResults}
        bodyHash="hash-b"
      />,
    );
    expect(screen.getByText(/Grounding — final:/)).toBeInTheDocument();
    expect(
      screen.getByText(/Works with every platform — no provided source supports this claim/),
    ).toBeInTheDocument();
  });

  it("renders nothing when no live gate failed — no empty scaffolding", () => {
    const { container } = render(<JudgeReasons results={[]} bodyHash="hash-b" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ApprovePanel judge reasons (critique P1)", () => {
  it("a blocked draft shows WHY beside the verdict chips", () => {
    render(
      <ApprovePanel
        status="success"
        draft={draftB}
        judgeResults={fixtureDraftDetails[FIXTURE_DRAFT_B_ID].judgeResults}
        onApprove={noop}
        onReject={noop}
        onEditSave={noop}
        onReJudge={noop}
        onPublish={noop}
      />,
    );
    expect(screen.getByLabelText("Why the judge blocked this")).toHaveTextContent(
      /no provided source supports this claim/,
    );
  });
});
