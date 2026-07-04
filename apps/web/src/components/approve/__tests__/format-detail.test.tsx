// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { draft } from "@/lib/approve-queue/fixtures";
import { FormatDetail } from "../format-detail";

describe("FormatDetail", () => {
  it("renders nothing for a plain post draft with no exemplar provenance", () => {
    const plain = draft("d1", "run-1", "linkedin", "A plain post.", "queued", "hash-plain");
    const { container } = render(<FormatDetail draft={plain} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders clip_plan timing, structured hook/captions/platformCopy, and window/chunk provenance", () => {
    const clipPlan = draft("d2", "run-1", "linkedin", "hook\n\ncaptions\n\ncopy", "queued", "hash-clip", {
      format: "clip_plan",
      meta: {
        startMs: 12_000,
        endMs: 45_000,
        durationMs: 33_000,
        windowIndex: 2,
        chunkSeqs: [4, 5],
        hook: "hook",
        captions: "captions",
        platformCopy: "copy",
        promptVersion: "highlight-select.v1",
        brandProfileVersion: 1,
        platformProfileVersion: "brand-profile.v1",
      },
    });
    render(<FormatDetail draft={clipPlan} />);
    expect(screen.getByLabelText("Clip plan detail")).toBeInTheDocument();
    expect(screen.getByText(/0:12–0:45/)).toBeInTheDocument();
    expect(screen.getByText("hook")).toBeInTheDocument();
    expect(screen.getByText("captions")).toBeInTheDocument();
    expect(screen.getByText("copy")).toBeInTheDocument();
    expect(screen.getByText(/window 2/)).toBeInTheDocument();
    expect(screen.getByText(/chunks 4, 5/)).toBeInTheDocument();
  });

  it("renders demo_plan step table, pageUrls, and a captureStatus chip", () => {
    const demoPlan = draft("d3", "run-1", "linkedin", "narration one\n\nnarration two", "queued", "hash-demo", {
      format: "demo_plan",
      meta: {
        steps: [
          { stepIndex: 0, action: "goto", target: "https://example.com", value: "", narration: "narration one" },
          { stepIndex: 1, action: "click", target: "#cta", value: "", narration: "narration two" },
        ],
        crawlSourceId: "source-1",
        pageUrls: ["https://example.com"],
        captureStatus: "captured",
        captureRef: "object-store-key-1",
        promptVersion: "storyboard.v1",
        brandProfileVersion: 1,
        platformProfileVersion: "brand-profile.v1",
      },
    });
    render(<FormatDetail draft={demoPlan} />);
    expect(screen.getByLabelText("Demo plan detail")).toBeInTheDocument();
    expect(screen.getByText("capture: captured")).toBeInTheDocument();
    expect(screen.getByText("object-store-key-1")).toBeInTheDocument();
    expect(screen.getByText("goto")).toBeInTheDocument();
    expect(screen.getByText("narration one")).toBeInTheDocument();
    expect(screen.getByText(/pages: https:\/\/example\.com/)).toBeInTheDocument();
  });

  it("renders exemplar provenance for an exemplar-aware plain draft", () => {
    const exemplarAware = draft("d4", "run-1", "linkedin", "A grounded post.", "queued", "hash-exemplar", {
      meta: { exemplarIds: [{ sourceId: "src-1", chunkId: "chunk-1" }] },
    });
    render(<FormatDetail draft={exemplarAware} />);
    expect(screen.getByLabelText("Exemplar provenance")).toBeInTheDocument();
    expect(screen.getByText("Exemplar-grounded")).toBeInTheDocument();
    expect(screen.getByText(/src-1.{0,3}\/.{0,3}chunk-1/)).toBeInTheDocument();
  });
});
