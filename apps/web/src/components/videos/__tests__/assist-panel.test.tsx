// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { edlSchema, type VideoCutAttribution } from "@thalon/contracts";
import { server } from "@/lib/testing/server";
import { AssistPanel } from "../assist-panel";

/**
 * B-ve.7: the diff view renders crop ops readably — the clip's CURRENT
 * window → the proposed one, source-pixel values — so the operator verifies
 * a reframe in one look. The applied preview rides the existing onApply
 * hand-off (the editor re-renders FrameComposer + track view from it).
 */

const BASE = edlSchema.parse({
  name: "film-9x16",
  output: { width: 405, height: 720, fps: 24, duration: 20 },
  video: [
    { name: "b1", source: { kind: "take", ref: "motion/keepers/b1.mp4" }, duration: 10 },
    {
      name: "b9",
      source: { kind: "take", ref: "motion/keepers/b9.mp4" },
      duration: 10,
      // Operator craft on the base: the expr arm renders as data in the view.
      crop: { width: 405, height: 720, x: { expr: "min(875*t/4.5,875)" }, y: 0 },
    },
  ],
});

const DIFF = {
  version: 1 as const,
  summary: "recenter b1 on the desk; settle b9's sweep",
  ops: [
    {
      op: "clip-crop" as const,
      clip: 0,
      crop: { width: 405, height: 720, x: { from: 220, to: 440 }, y: 0 },
      why: "measured 1280×720 source: desk center at x≈422",
    },
    {
      op: "clip-crop" as const,
      clip: 1,
      crop: { width: 405, height: 720, x: 300, y: 0 },
      why: "measured 1280×720 source: hold on the flame",
    },
  ],
};

const ATTRIBUTION: VideoCutAttribution = {
  authoredBy: "agent",
  proposal: {
    baseCutId: "c1",
    model: "claude-cli/sonnet",
    promptName: "edl-diff-propose.v2",
    promptHash: "a".repeat(64),
    diff: DIFF,
    decidedBy: "operator",
  },
};

const PREVIEW = edlSchema.parse({
  ...BASE,
  video: BASE.video.map((clip, i) =>
    i === 0 ? { ...clip, crop: DIFF.ops[0].crop } : { ...clip, crop: DIFF.ops[1].crop },
  ),
});

function armPropose() {
  server.use(
    http.post("/api/videos/p1/cuts/c1/propose", () =>
      HttpResponse.json({
        diff: DIFF,
        preview: PREVIEW,
        attribution: ATTRIBUTION,
        tokens: { in: 1200, out: 80 },
      }),
    ),
  );
}

describe("AssistPanel crop diffs (B-ve.7)", () => {
  it("renders each crop op as old → new source-pixel windows: full frame, pans, and expr-as-data", async () => {
    armPropose();
    render(
      <AssistPanel projectId="p1" cutId="c1" baseEdl={BASE} dirty={false} onApply={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Propose" }));

    await screen.findByText("recenter b1 on the desk; settle b9's sweep");
    // Uncropped clip: the honest "full frame" old side; the sweep renders from→to.
    expect(screen.getByText("full frame → 405×720 @ (220→440, 0)")).toBeInTheDocument();
    // Base expr axis shown as data (operator craft); proposed side is static.
    expect(
      screen.getByText("405×720 @ (min(875*t/4.5,875), 0) → 405×720 @ (300, 0)"),
    ).toBeInTheDocument();
    // Targets name the clip; every op carries its why.
    expect(screen.getByText("clip 0 “b1”")).toBeInTheDocument();
    expect(screen.getByText("clip 1 “b9”")).toBeInTheDocument();
    expect(screen.getByText("measured 1280×720 source: desk center at x≈422")).toBeInTheDocument();
  });

  it("Apply hands the applied preview + full attribution up (the save door replay-verifies)", async () => {
    armPropose();
    const onApply = vi.fn();
    render(
      <AssistPanel projectId="p1" cutId="c1" baseEdl={BASE} dirty={false} onApply={onApply} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Propose" }));
    await screen.findByText("recenter b1 on the desk; settle b9's sweep");
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(onApply).toHaveBeenCalledWith(PREVIEW, ATTRIBUTION);
    expect(onApply.mock.calls[0][0].video[0].crop).toEqual(DIFF.ops[0].crop);
  });
});
