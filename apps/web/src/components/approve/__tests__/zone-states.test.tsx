// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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

  it("fanout grid: idle, loading, empty, error", () => {
    const { rerender } = render(
      <FanoutGrid status="idle" drafts={[]} selectedDraftId={null} onSelect={() => {}} />,
    );
    expect(screen.getByText(/Select a run/i)).toBeInTheDocument();

    rerender(<FanoutGrid status="loading" drafts={[]} selectedDraftId={null} onSelect={() => {}} />);
    expect(screen.getByText(/Loading drafts/i)).toBeInTheDocument();

    rerender(<FanoutGrid status="success" drafts={[]} selectedDraftId={null} onSelect={() => {}} />);
    expect(screen.getByText(/no drafts yet/i)).toBeInTheDocument();

    rerender(<FanoutGrid status="error" drafts={[]} selectedDraftId={null} onSelect={() => {}} />);
    expect(screen.getByText(/Couldn.t load drafts/i)).toBeInTheDocument();
  });

  it("approve panel: idle, loading, error", () => {
    const noop = () => {};
    const { rerender } = render(
      <ApprovePanel status="idle" draft={null} judgeResults={[]} onApprove={noop} onReject={noop} onEditSave={noop} />,
    );
    expect(screen.getByText(/Select a draft/i)).toBeInTheDocument();

    rerender(
      <ApprovePanel status="loading" draft={null} judgeResults={[]} onApprove={noop} onReject={noop} onEditSave={noop} />,
    );
    expect(screen.getByText(/Loading draft/i)).toBeInTheDocument();

    rerender(
      <ApprovePanel status="error" draft={null} judgeResults={[]} onApprove={noop} onReject={noop} onEditSave={noop} />,
    );
    expect(screen.getByText(/Couldn.t load this draft/i)).toBeInTheDocument();
  });
});
