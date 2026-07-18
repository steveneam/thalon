// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  FIXTURE_DRAFT_A_ID,
  FIXTURE_DRAFT_B_ID,
  FIXTURE_RUN_2_ID,
} from "@/lib/approve-queue/fixtures";
import { ApproveQueue } from "../approve-queue";

describe("ApproveQueue — informed consent (Phase I design #6)", () => {
  it("the approve button is a sentence: consequence + the honest publish limit; reject wears its ellipsis", async () => {
    render(<ApproveQueue />);
    const detail = screen.getByRole("region", { name: "Draft detail" });
    await within(detail).findByText("Run2 LinkedIn draft");

    expect(
      within(detail).getByRole("button", {
        name: "Approve — records the approval; nothing publishes until the publish door arms",
      }),
    ).toBeInTheDocument();
    expect(within(detail).getByRole("button", { name: "Reject…" })).toBeInTheDocument();
    expect(within(detail).getByText(/reject asks for a named confirm/)).toBeInTheDocument();
  });

  it("lineage: the run and judge nodes are links, the seats show profile version + models, the ?draft chip deep-links", async () => {
    render(<ApproveQueue />);
    const detail = screen.getByRole("region", { name: "Draft detail" });
    await within(detail).findByText("Run2 LinkedIn draft");

    expect(within(detail).getByRole("link", { name: /run #22222222/ })).toHaveAttribute(
      "href",
      `/app/approve?run=${FIXTURE_RUN_2_ID}`,
    );
    expect(within(detail).getByRole("link", { name: /judge ✓ receipt/ })).toHaveAttribute(
      "href",
      "#judge-verdicts",
    );
    expect(within(detail).getByRole("link", { name: `?draft=${FIXTURE_DRAFT_A_ID.slice(0, 8)}` })).toHaveAttribute(
      "href",
      `/app/approve?draft=${FIXTURE_DRAFT_A_ID}`,
    );
    // The seats: which profile version and which models shaped this draft.
    expect(within(detail).getByText("profile v1")).toBeInTheDocument();
    expect(within(detail).getByText(/test\/model draft · test\/model judge/)).toBeInTheDocument();
  });

  it("fail-closed: a blocked draft has NO approve/reject — absent, not greyed — and the inset states the rule", async () => {
    const user = userEvent.setup();
    render(<ApproveQueue />);
    const queue = await screen.findByRole("region", { name: "Approve queue" });
    const detail = screen.getByRole("region", { name: "Draft detail" });

    await user.click(within(queue).getByRole("button", { name: `Select x draft ${FIXTURE_DRAFT_B_ID}` }));
    await within(detail).findByText("Run2 X draft");

    expect(within(detail).queryByRole("button", { name: /^Approve — / })).not.toBeInTheDocument();
    expect(within(detail).queryByRole("button", { name: "Reject…" })).not.toBeInTheDocument();
    expect(within(detail).getByText(/approve is simply absent while any check fails/)).toBeInTheDocument();
    // The ways forward stay: edit (judge re-runs) and re-judge.
    expect(within(detail).getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(within(detail).getByRole("button", { name: "Re-judge" })).toBeInTheDocument();
  });

  it("the blocked draft's failing reason is verbatim in the receipt — the recorded claim and evidence, never a paraphrase", async () => {
    const user = userEvent.setup();
    render(<ApproveQueue />);
    const queue = await screen.findByRole("region", { name: "Approve queue" });
    const detail = screen.getByRole("region", { name: "Draft detail" });

    await user.click(within(queue).getByRole("button", { name: `Select x draft ${FIXTURE_DRAFT_B_ID}` }));
    await within(detail).findByText("Run2 X draft");

    const receipt = within(detail).getByRole("group", { name: "Judge verdicts" });
    expect(
      within(receipt).getByText(/Works with every platform — no provided source supports this claim/),
    ).toBeInTheDocument();
  });
});
