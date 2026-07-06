// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { run } from "@/lib/approve-queue/fixtures";
import { ApprovePanel } from "../approve-panel";
import { FanoutGrid } from "../fanout-grid";
import { FeedPanel } from "../feed-panel";

describe("zone loading / empty / error states", () => {
  it("feed panel: loading, empty, error", () => {
    const { rerender } = render(
      <FeedPanel status="loading" runs={[]} selectedRunId={null} onSelect={() => {}} />,
    );
    expect(screen.getByText(/Loading runs/i)).toBeInTheDocument();

    rerender(<FeedPanel status="success" runs={[]} selectedRunId={null} onSelect={() => {}} />);
    expect(screen.getByText(/No fan-out runs yet/i)).toBeInTheDocument();

    rerender(<FeedPanel status="error" runs={[]} selectedRunId={null} onSelect={() => {}} />);
    expect(screen.getByText(/Couldn.t load runs/i)).toBeInTheDocument();
  });

  it("feed panel: flags an aborted/partial run distinctly instead of an indistinguishable row", () => {
    const complete = run("11111111-1111-1111-1111-111111111111", "2026-07-04T09:00:00.000Z", true);
    const incomplete = run("22222222-2222-2222-2222-222222222222", "2026-07-04T10:00:00.000Z", false);
    render(
      <FeedPanel status="success" runs={[incomplete, complete]} selectedRunId={null} onSelect={() => {}} />,
    );
    const items = screen.getAllByRole("button");
    expect(within(items[0]).getByText("Incomplete")).toBeInTheDocument();
    expect(within(items[1]).queryByText("Incomplete")).not.toBeInTheDocument();
  });

  it("fanout grid: idle, loading, empty, error", () => {
    const gridProps = { drafts: [], selectedDraftId: null, onSelect: () => {}, busy: false, queuedCount: 0, onBatchApprove: () => {} };
    const { rerender } = render(<FanoutGrid status="idle" {...gridProps} />);
    expect(screen.getByText(/Select a run/i)).toBeInTheDocument();

    rerender(<FanoutGrid status="loading" {...gridProps} />);
    expect(screen.getByText(/Loading drafts/i)).toBeInTheDocument();

    rerender(<FanoutGrid status="success" {...gridProps} />);
    expect(screen.getByText(/no drafts yet/i)).toBeInTheDocument();

    rerender(<FanoutGrid status="error" {...gridProps} />);
    expect(screen.getByText(/Couldn.t load drafts/i)).toBeInTheDocument();
  });

  it("approve panel: idle, loading, error", () => {
    const noop = () => {};
    const { rerender } = render(
      <ApprovePanel status="idle" draft={null} judgeResults={[]} onApprove={noop} onReject={noop} onEditSave={noop} onReJudge={noop} />,
    );
    expect(screen.getByText(/Select a draft/i)).toBeInTheDocument();

    rerender(
      <ApprovePanel status="loading" draft={null} judgeResults={[]} onApprove={noop} onReject={noop} onEditSave={noop} onReJudge={noop} />,
    );
    expect(screen.getByText(/Loading draft/i)).toBeInTheDocument();

    rerender(
      <ApprovePanel status="error" draft={null} judgeResults={[]} onApprove={noop} onReject={noop} onEditSave={noop} onReJudge={noop} />,
    );
    expect(screen.getByText(/Couldn.t load this draft/i)).toBeInTheDocument();
  });
});
