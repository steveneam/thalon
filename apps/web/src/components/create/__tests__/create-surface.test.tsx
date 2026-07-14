// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { CreateContextLoader } from "@/components/create/create-context-loader";
import { CreateSurface } from "@/components/create/create-surface";
import { fixtureTrendCards } from "@/lib/intel/fixtures";
import { promoteTrendCard } from "@/lib/intel/store";
import type { CreateContext } from "@/lib/intel/types";
import { server } from "@/lib/testing/server";

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
    // The score reads as a heat grade (bar + word), the number lives in the tooltip.
    expect(within(chips).getByRole("img", { name: "heat hot — rank score 0.90 of 1" })).toBeInTheDocument();
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

const LEAD_CONTEXT: CreateContext = {
  captureId: "intel-capture-9",
  kind: "lead_promote",
  family: "email",
  leadId: "lead-1",
  company: "Riverbend Plumbing",
  contact: "Sam Reyes",
  painPoint: "website never brings in local work",
  text: "met at the trade expo",
};

describe("CreateSurface — the →Email compose door (B-crm.4 front half)", () => {
  it("a lead email context pre-picks Email and composes from the SURVIVING chips only", async () => {
    let sent: unknown;
    server.use(
      http.post("/api/create/email", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({
          draftId: "d1",
          runId: "r1",
          status: "queued",
          alreadyComposed: false,
        });
      }),
    );
    const user = userEvent.setup();
    render(<CreateSurface initialPrompt="" initialKeyword="" context={LEAD_CONTEXT} />);

    expect(screen.getByRole("button", { name: /email/i, pressed: true })).toBeInTheDocument();
    // Never sent automatically — the surface says so before composing.
    expect(screen.getByText(/It is never sent/)).toBeInTheDocument();

    // Prune the company chip: it must NOT reach the brief.
    const chips = screen.getByLabelText("Lead context");
    await user.click(within(chips).getByRole("button", { name: /remove company/i }));

    await user.click(screen.getByRole("button", { name: /compose email draft/i }));
    expect(await screen.findByText(/waiting for your approval/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /review it in the approve queue/i })).toHaveAttribute(
      "href",
      "/app/approve",
    );
    expect(sent).toMatchObject({
      leadId: "lead-1",
      context: {
        contact: "Sam Reyes",
        painPoint: "website never brings in local work",
        notes: "met at the trade expo",
      },
    });
    expect((sent as { context: Record<string, unknown> }).context.company).toBeUndefined();
  });

  it("a blocked verdict surfaces honestly with the gate reason", async () => {
    server.use(
      http.post("/api/create/email", () =>
        HttpResponse.json({
          draftId: "d1",
          runId: "r1",
          status: "blocked",
          alreadyComposed: false,
          blockedReason: "g1 denylist fail",
        }),
      ),
    );
    const user = userEvent.setup();
    render(<CreateSurface initialPrompt="" initialKeyword="" context={LEAD_CONTEXT} />);
    await user.click(screen.getByRole("button", { name: /compose email draft/i }));
    expect(await screen.findByText(/blocked this draft \(g1 denylist fail\)/i)).toBeInTheDocument();
  });

  it("the Email family without a lead context is an honest pointer to the lead-card exit, not a dead button", async () => {
    const user = userEvent.setup();
    render(<CreateSurface initialPrompt="" initialKeyword="" context={CONTEXT} />);
    await user.click(screen.getByRole("button", { name: /email/i }));
    expect(screen.getByText(/use the → Email exit on a lead card/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /compose email draft/i })).not.toBeInTheDocument();
  });
});

describe("CreateContextLoader — the capture-id door", () => {
  it("resolves a capture id through the context route and renders the chips", async () => {
    const card = fixtureTrendCards[0];
    const { capture } = promoteTrendCard(card.id, { family: "post", titleIndex: 1 });
    render(<CreateContextLoader contextId={capture.id} initialPrompt="" initialKeyword="" />);

    expect(await screen.findByLabelText("Intel context")).toBeInTheDocument();
    expect(screen.getByLabelText("Creation prompt")).toHaveValue(card.dossier!.titles[1]);
    expect(screen.getByRole("button", { name: /post/i, pressed: true })).toBeInTheDocument();
  });

  it("a stale capture id degrades to a plain Create, never an error page", async () => {
    render(<CreateContextLoader contextId="intel-capture-nope" initialPrompt="" initialKeyword="" />);
    expect(await screen.findByLabelText("Creation prompt")).toBeInTheDocument();
    expect(screen.queryByLabelText("Intel context")).not.toBeInTheDocument();
  });
});
