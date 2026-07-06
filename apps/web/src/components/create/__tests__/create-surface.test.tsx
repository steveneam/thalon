// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CreateContextLoader } from "@/components/create/create-context-loader";
import { CreateSurface } from "@/components/create/create-surface";
import { fixtureTrendCards } from "@/lib/intel/fixtures";
import { promoteTrendCard } from "@/lib/intel/store";
import type { CreateContext } from "@/lib/intel/types";

const CONTEXT: CreateContext = {
  captureId: "intel-capture-1",
  kind: "trend_promote",
  family: "video",
  title: "Video as a build step: rendering launch clips from HTML",
  angle: "Show your own render pipeline end to end — prompt to playable file",
  hook: "Our launch video has no editor file. It has a build step.",
  sourceUrl: "https://example.com/demo/3kx3",
  areaName: "Short-form video tooling",
  score: 0.9,
  text: "Rendered our whole launch video from HTML.",
};

describe("CreateSurface — the context spine (wave-3 §3)", () => {
  it("renders the intel context as chips, pre-fills the working title, and pre-picks the family", () => {
    render(<CreateSurface initialPrompt="" initialKeyword="" context={CONTEXT} />);

    // Pre-fill, never re-ask: the picked title is the working title.
    expect(screen.getByLabelText("Creation prompt")).toHaveValue(CONTEXT.title);
    // The exit door's family arrives pre-picked (still changeable).
    expect(screen.getByRole("button", { name: /video/i, pressed: true })).toBeInTheDocument();

    const chips = screen.getByLabelText("Intel context");
    for (const value of [CONTEXT.title!, CONTEXT.angle!, CONTEXT.hook!, CONTEXT.areaName!]) {
      expect(within(chips).getByText(value)).toBeInTheDocument();
    }
    expect(within(chips).getByText("score 0.90")).toBeInTheDocument();
    expect(within(chips).getByRole("link", { name: /original item/i })).toHaveAttribute(
      "href",
      CONTEXT.sourceUrl,
    );
  });

  it("chips are removable — the operator prunes what rides into generation", async () => {
    const user = userEvent.setup();
    render(<CreateSurface initialPrompt="" initialKeyword="" context={CONTEXT} />);

    const chips = screen.getByLabelText("Intel context");
    await user.click(within(chips).getByRole("button", { name: /remove angle/i }));
    expect(within(chips).queryByText(CONTEXT.angle!)).not.toBeInTheDocument();
    // The rest of the context survives the prune.
    expect(within(chips).getByText(CONTEXT.title!)).toBeInTheDocument();
  });

  it("a search target-this context pre-picks Page and carries the keyword", () => {
    render(
      <CreateSurface
        initialPrompt=""
        initialKeyword=""
        context={{
          captureId: "intel-capture-2",
          kind: "search_target_this",
          family: "page",
          keyword: "what is content automation",
        }}
      />,
    );
    expect(screen.getByRole("button", { name: /page/i, pressed: true })).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Intel context")).getByText("what is content automation"),
    ).toBeInTheDocument();
  });

  it("without context the surface behaves as before — legacy prompt/keyword doors intact", () => {
    render(<CreateSurface initialPrompt="hello" initialKeyword="" context={null} />);
    expect(screen.getByLabelText("Creation prompt")).toHaveValue("hello");
    expect(screen.queryByLabelText("Intel context")).not.toBeInTheDocument();
  });
});

describe("CreateContextLoader — the capture-id door", () => {
  it("resolves a capture id through the context route and renders the chips", async () => {
    const card = fixtureTrendCards[0];
    const { capture } = promoteTrendCard(card.id, { family: "post", titleIndex: 1 });
    render(<CreateContextLoader contextId={capture.id} initialPrompt="" initialKeyword="" />);

    expect(await screen.findByLabelText("Intel context")).toBeInTheDocument();
    expect(screen.getByLabelText("Creation prompt")).toHaveValue(card.dossier.titles[1]);
    expect(screen.getByRole("button", { name: /post/i, pressed: true })).toBeInTheDocument();
  });

  it("a stale capture id degrades to a plain Create, never an error page", async () => {
    render(<CreateContextLoader contextId="intel-capture-nope" initialPrompt="" initialKeyword="" />);
    expect(await screen.findByLabelText("Creation prompt")).toBeInTheDocument();
    expect(screen.queryByLabelText("Intel context")).not.toBeInTheDocument();
  });
});
