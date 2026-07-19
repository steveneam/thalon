// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { draft, draftA, draftB, run } from "@/lib/approve-queue/fixtures";
import { ApprovePanel } from "../approve-panel";
import { formatExactStamp, QueueList, queueStatusWord } from "../queue-list";

const RUN = run("11111111-1111-1111-1111-111111111111", "2026-07-04T09:00:00.000Z");
const noop = () => {};

describe("queue list states (Bounded-List Rule)", () => {
  it("loading, empty, error", () => {
    const { rerender } = render(
      <QueueList status="loading" items={[]} selectedDraftId={null} onSelect={noop} />,
    );
    expect(screen.getByText(/Loading the queue/i)).toBeInTheDocument();

    rerender(<QueueList status="success" items={[]} selectedDraftId={null} onSelect={noop} />);
    expect(screen.getByText(/No drafts yet/i)).toBeInTheDocument();

    rerender(<QueueList status="error" items={[]} selectedDraftId={null} onSelect={noop} />);
    expect(screen.getByText(/Couldn.t load the queue/i)).toBeInTheDocument();
  });

  it("rows carry the status word, the run lineage, and the age; the footer states the bound + count", () => {
    render(
      <QueueList
        status="success"
        items={[
          { draft: draftA, run: RUN },
          { draft: draftB, run: RUN },
        ]}
        selectedDraftId={draftA.id}
        onSelect={noop}
      />,
    );
    const list = screen.getByRole("region", { name: "Approve queue" });
    // queued speaks as "waiting"; blocked keeps its word (signal channel).
    expect(within(list).getByText("waiting")).toBeInTheDocument();
    expect(within(list).getByText("blocked")).toBeInTheDocument();
    expect(within(list).getAllByText(/run #11111111/)).toHaveLength(2);
    expect(within(list).getByText(/2 of 2 · list is bounded/)).toBeInTheDocument();
  });

  it("status words: queued→waiting (neutral), blocked→blocked (signal), terminal states keep their own words", () => {
    expect(queueStatusWord("queued")).toEqual({ word: "waiting", signal: false });
    expect(queueStatusWord("blocked")).toEqual({ word: "blocked", signal: true });
    expect(queueStatusWord("approved")).toEqual({ word: "approved", signal: false });
    expect(queueStatusWord("rejected")).toEqual({ word: "rejected", signal: false });
  });

  it("stamps are the EXACT local date and time, never a relative age (founder s66)", () => {
    // Local-clock rendering: assert the shape plus the date parts that are
    // timezone-stable for a midday-UTC instant on this box.
    expect(formatExactStamp("2026-07-04T10:00:00.000Z")).toMatch(/^\d{1,2} Jul 2026, \d{2}:\d{2}$/);
    expect(formatExactStamp("2026-01-15T12:00:00.000Z")).toMatch(/^\d{1,2} Jan 2026, \d{2}:\d{2}$/);
    // Deterministic: the same instant always renders the same stamp.
    expect(formatExactStamp("2026-07-04T10:00:00.000Z")).toBe(
      formatExactStamp("2026-07-04T10:00:00.000Z"),
    );
  });
});

describe("draft detail states", () => {
  const panelProps = {
    run: null,
    judgeResults: [],
    onApprove: noop,
    onReject: noop,
    onEditSave: noop,
    onReJudge: noop,
    onPublish: noop,
    onBack: noop,
  };

  it("idle, loading, error", () => {
    const { rerender } = render(<ApprovePanel status="idle" draft={null} {...panelProps} />);
    expect(screen.getByText(/Select a draft/i)).toBeInTheDocument();

    rerender(<ApprovePanel status="loading" draft={null} {...panelProps} />);
    expect(screen.getByText(/Loading draft/i)).toBeInTheDocument();

    rerender(<ApprovePanel status="error" draft={null} {...panelProps} />);
    expect(screen.getByText(/Couldn.t load this draft/i)).toBeInTheDocument();
  });

  it("an incomplete run is flagged distinctly in the lineage instead of an indistinguishable row", () => {
    const incompleteRun = { ...RUN, draftsComplete: false };
    render(
      <ApprovePanel status="success" draft={draftA} {...panelProps} run={incompleteRun} />,
    );
    expect(screen.getByText(/this run is incomplete/i)).toBeInTheDocument();
  });

  it("a stranded judging draft explains itself", () => {
    const judging = draft("dj", RUN.id, "linkedin", "Judging draft", "judging", "hash-j");
    render(<ApprovePanel status="success" draft={judging} {...panelProps} run={RUN} />);
    expect(screen.getByText(/No passing verdict yet/i)).toBeInTheDocument();
    // Re-judge is the way back for a stranded draft.
    expect(screen.getByRole("button", { name: "Re-judge" })).toBeInTheDocument();
  });
});
