// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { BoardSurface } from "@/components/board/board-surface";
import { PulseProvider } from "@/components/workspace/pulse-context";
import type { TrendCard, TrendsPayload } from "@/lib/intel/types";
import { server } from "@/lib/testing/server";
import type { PipelineAsset, PlanPayload, PlannedSlotWire } from "@/lib/workspace/types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/board",
  useRouter: () => ({ push: vi.fn() }),
}));

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

function asset(overrides: Partial<PipelineAsset> & { draftId: string }): PipelineAsset {
  return {
    runId: "run-1",
    platform: "linkedin",
    format: "post",
    status: "queued",
    sourceKind: "url",
    capturedAt: null,
    generatedAt: hoursAgo(3),
    judgedAt: null,
    decidedAt: null,
    publishedAt: null,
    gates: [],
    reasons: [],
    deployRef: null,
    excerpt: "Our launch video has no editor file",
    ...overrides,
  };
}

function seedPlan(payload: Partial<PlanPayload> = {}) {
  const plan: PlanPayload = {
    sweep: null,
    areas: 0,
    cadence: [],
    assets: [],
    plannedSlots: [],
    ...payload,
  };
  server.use(http.get("/api/app/plan", () => HttpResponse.json(plan)));
}

function seedTrends(cards: Partial<TrendCard>[] = []) {
  const payload = {
    areas: [],
    demo: true,
    sweep: { lastSweptAt: hoursAgo(1), intervalHours: 8, source: "fixture" },
    sources: [],
    cards: cards.map((card, index) => ({
      id: `card-${index}`,
      source: "bluesky",
      externalId: `ext-${index}`,
      text: "Rendered our whole launch video from HTML — a build step",
      account: "someone",
      publishedAt: hoursAgo(2),
      areaName: "Short-form video tooling",
      score: 0.9,
      reasons: [],
      isOutlier: false,
      shareToView: null,
      bookmarkToView: null,
      metrics: {},
      ...card,
    })),
  } as unknown as TrendsPayload;
  server.use(http.get("/api/intel/trends", () => HttpResponse.json(payload)));
}

const SLOT: PlannedSlotWire = {
  draftId: "d-plan",
  platform: "facebook",
  scheduledFor: new Date(2026, 6, 24, 18, 0).toISOString(),
  note: null,
};

/**
 * STEP 2 of the two-step rebuild: the sheet's six columns (pinned
 * structurally at the commit before this one) now carry the real pipeline.
 * These pin the honesty rules — a draft in the wrong column, a count that
 * shrinks to what fits, or a read failure rendered as an empty board is a
 * failure.
 */
describe("Pipeline board (exact-mock rebuild — Board.dc.html)", () => {
  it("renders the sheet's header and its six columns in order", async () => {
    seedPlan();
    seedTrends();
    const { container } = render(<BoardSurface />);

    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    const seg = container.querySelector(".seg");
    expect(Array.from(seg?.children ?? []).map((el) => el.textContent)).toEqual([
      "Overview",
      "Board",
    ]);
    expect(seg?.querySelector(".seg-opt.on")?.textContent).toBe("Board");
    expect(
      screen.getByText("the pipeline as columns — cards move when the work moves"),
    ).toBeInTheDocument();

    await screen.findByText("Nothing at the judge.");
    expect(
      Array.from(container.querySelectorAll(".col-hd")).map((el) => el.firstChild?.textContent),
    ).toEqual([
      "Intel picks",
      "Composing",
      "At the judge",
      "Waiting on you",
      "Approved",
      "Planned",
    ]);
    expect(container.querySelector(".content.board-surface")).not.toBeNull();
    expect(container.querySelector('[class*="text-muted-foreground"]')).toBeNull();
  });

  it("puts each draft in the one column its recorded status names", async () => {
    seedTrends();
    seedPlan({
      assets: [
        asset({ draftId: "d-comp", status: "generated", excerpt: "composing draft" }),
        asset({
          draftId: "d-judge",
          status: "judging",
          excerpt: "judging draft",
          gates: [
            { gate: "g1", verdict: "pass" },
            { gate: "g3_screen", verdict: "pass" },
          ],
        }),
        asset({ draftId: "d-wait", status: "queued", judgedAt: hoursAgo(26) }),
        asset({
          draftId: "d-ok",
          status: "published",
          excerpt: "published piece",
          publishedAt: hoursAgo(5),
          deployRef: "/blog/post",
        }),
        asset({ draftId: "d-app", status: "approved", excerpt: "approved piece" }),
      ],
      plannedSlots: [SLOT],
    });
    const { container } = render(<BoardSurface />);
    // Platform-led title, as the sheet draws it (see the B4 ratchet below).
    await screen.findByText("LinkedIn · composing draft");

    const cols = Array.from(container.querySelectorAll(".col"));
    const bodyOf = (label: string) =>
      cols.find((c) => c.querySelector(".col-hd")?.textContent?.startsWith(label)) as HTMLElement;

    expect(
      within(bodyOf("Composing")).getByText("LinkedIn · composing draft"),
    ).toBeInTheDocument();
    expect(within(bodyOf("Composing")).getByText("drafting · 3h in")).toBeInTheDocument();
    expect(within(bodyOf("At the judge")).getByText("2 gates · running")).toBeInTheDocument();
    expect(
      within(bodyOf("Waiting on you")).getByText("Our launch video has no editor file"),
    ).toBeInTheDocument();
    expect(within(bodyOf("Waiting on you")).getByText("LinkedIn · 26h")).toBeInTheDocument();
    expect(within(bodyOf("Approved")).getByText("published ↗")).toBeInTheDocument();
    expect(within(bodyOf("Approved")).getByText("ready to plan")).toBeInTheDocument();
    expect(within(bodyOf("Planned")).getByText(/18:00 · Facebook/)).toBeInTheDocument();
    expect(within(bodyOf("Planned")).getByText("door unarmed — a plan")).toBeInTheDocument();

    // Every count is the real one, and the waiting column wears the signal.
    expect(
      Array.from(container.querySelectorAll(".col-ct")).map((el) => el.textContent),
    ).toEqual(["0", "1", "1", "1", "2", "1"]);
    expect(bodyOf("Waiting on you")).toHaveClass("col-signal");
    expect(bodyOf("Waiting on you").querySelector(".col-ct")).toHaveClass("col-ct-signal");
  });

  it("a blocked draft leads with the judge's reason, in the error channel", async () => {
    seedTrends();
    seedPlan({
      assets: [
        asset({
          draftId: "d-blocked",
          status: "blocked",
          judgedAt: hoursAgo(1),
          reasons: ["Grounding — final: Works with every platform — no source supports this."],
        }),
      ],
    });
    const { container } = render(<BoardSurface />);

    const title = await screen.findByText(
      "Grounding — final: Works with every platform — no source supports this.",
    );
    expect(title).toHaveClass("k-title", "k-title-err");
    expect(screen.getByText("needs your edit · 1h")).toBeInTheDocument();
    // Amber stays needs-you ONLY: a block is the error channel, not the signal.
    expect(container.querySelector(".k-title-err")).not.toHaveClass("col-ct-signal");
  });

  it("intel cards carry their real rank band and their source media", async () => {
    seedPlan();
    seedTrends([
      { score: 0.92, thumbnailUrl: "https://cdn.test/thumb.jpg" },
      { id: "card-cool", score: 0.2, text: "a quieter card", areaName: "Editing tools" },
    ]);
    const { container } = render(<BoardSurface />);

    expect(await screen.findByText("Hot")).toHaveClass("pill", "pill-heat-hot");
    expect(screen.getByText("Cool")).toHaveClass("pill", "pill-heat-cool");
    expect(screen.getByText("Short-form video tooling")).toBeInTheDocument();

    // A real source thumbnail rides the sheet's own frame; the card without
    // one keeps the striped placeholder with its mono explainer.
    expect(container.querySelector(".k-thumb-live img")).toHaveAttribute(
      "src",
      "https://cdn.test/thumb.jpg",
    );
    expect(container.querySelector(".k-thumb span")?.textContent).toBe("bluesky");
  });

  it("every card is a door to the surface that owns it", async () => {
    seedTrends([{}]);
    seedPlan({
      assets: [asset({ draftId: "d-wait", status: "queued" })],
      plannedSlots: [SLOT],
    });
    render(<BoardSurface />);

    const waiting = await screen.findByText("Our launch video has no editor file");
    expect(waiting.closest("a")).toHaveAttribute(
      "href",
      "/app/approve?run=run-1&draft=d-wait",
    );
    expect(screen.getByText(/18:00 · Facebook/).closest("a")).toHaveAttribute(
      "href",
      "/app/calendar",
    );
    expect(
      screen.getByText("Rendered our whole launch video from HTML — a build step").closest("a"),
    ).toHaveAttribute("href", "/app/intel");
  });

  it("a failed pipeline read says so and retries — the columns never fake empty", async () => {
    seedTrends();
    let calls = 0;
    server.use(
      http.get("/api/app/plan", () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ error: "engine unreachable" }, { status: 503 })
          : HttpResponse.json({
              sweep: null,
              areas: 0,
              cadence: [],
              assets: [asset({ draftId: "d-wait", status: "queued" })],
              plannedSlots: [],
            } satisfies PlanPayload);
      }),
    );
    const user = userEvent.setup();
    const { container } = render(<BoardSurface />);

    expect(
      await screen.findByText(
        "Couldn’t read the pipeline — this is a read failure, not an empty board.",
      ),
    ).toBeInTheDocument();
    // Counts are honestly unresolved, not zero — in every plan-backed column.
    expect(
      Array.from(container.querySelectorAll(".col-ct")).slice(1).map((el) => el.textContent),
    ).toEqual(["–", "–", "–", "–", "–"]);

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Our launch video has no editor file")).toBeInTheDocument();
  });

  it("the two reads are independent: intel failing leaves the pipeline standing", async () => {
    seedPlan({ assets: [asset({ draftId: "d-wait", status: "queued" })] });
    server.use(
      http.get("/api/intel/trends", () =>
        HttpResponse.json({ error: "sweep unreachable" }, { status: 503 }),
      ),
    );
    render(<BoardSurface />);

    expect(await screen.findByText(/couldn’t read this column/)).toBeInTheDocument();
    expect(screen.getByText("Our launch video has no editor file")).toBeInTheDocument();
    expect(screen.queryByText(/not an empty board/)).not.toBeInTheDocument();
  });

  it("an empty column says what would land there", async () => {
    seedPlan();
    seedTrends();
    render(<BoardSurface />);

    expect(await screen.findByText("Nothing waiting — you’re clear.")).toBeInTheDocument();
    expect(screen.getByText("No plans yet — approve a draft, then plan its slot.")).toBeInTheDocument();
    expect(screen.getByText("No cards yet — the sweep's rising items land here.")).toBeInTheDocument();
  });

  /*
   * s77 findings (board-surface.tsx:183 + board-model.ts:46), fixed together
   * because they are one sentence on screen: the column rendered 12 of 21 under
   * a note reading "column scrolls — all 21 counted above" (which explained the
   * gap away and offered no door), while the shell topbar said "Needs you · 25"
   * from the wider pulse window. One number, and an honest N-of-M with a door.
   */
  it("a bounded column says N of M and points at the queue that holds the rest", async () => {
    seedTrends();
    seedPlan({
      assets: Array.from({ length: 15 }, (_, i) =>
        asset({ draftId: `q${i}`, status: "queued", judgedAt: hoursAgo(i + 1) }),
      ),
    });
    const { container } = render(<BoardSurface />);
    await screen.findByText(/12 of 15 shown/);

    const note = screen.getByText(/12 of 15 shown/);
    expect(within(note).getByRole("link", { name: /open the queue for the rest/ })).toHaveAttribute(
      "href",
      "/app/approve",
    );
    // The old copy claimed scrolling reached everything. It never did.
    expect(screen.queryByText(/counted above/)).not.toBeInTheDocument();
    const waiting = Array.from(container.querySelectorAll(".col")).find((c) =>
      c.querySelector(".col-hd")?.textContent?.startsWith("Waiting on you"),
    ) as HTMLElement;
    expect(waiting.querySelectorAll(".k-card")).toHaveLength(12);
  });

  it("the waiting count is the pulse's number — the one the topbar and rail show", async () => {
    seedTrends();
    seedPlan({
      assets: Array.from({ length: 3 }, (_, i) =>
        asset({ draftId: `q${i}`, status: "queued", judgedAt: hoursAgo(i + 1) }),
      ),
    });
    // The pulse counts a WIDER run window than the plan read, so it legitimately
    // knows about waiting work the board's own window cannot see.
    server.use(
      http.get("/api/app/pulse", () =>
        HttpResponse.json({ tenant: null, profile: null, counts: {}, needsYou: 7 }),
      ),
    );
    const { container } = render(
      <PulseProvider>
        <BoardSurface />
      </PulseProvider>,
    );
    await screen.findByText(/3 of 7 shown/);

    const waiting = Array.from(container.querySelectorAll(".col")).find((c) =>
      c.querySelector(".col-hd")?.textContent?.startsWith("Waiting on you"),
    ) as HTMLElement;
    expect(waiting.querySelector(".col-ct")?.textContent).toBe("7");
  });

  /* The view knobs the founder asked to re-introduce (s77). */
  it("the platform filter narrows the columns and says so where it cannot apply", async () => {
    seedTrends([{ text: "a rising card", score: 0.8 }]);
    seedPlan({
      assets: [
        asset({ draftId: "p-li", platform: "linkedin", status: "queued" }),
        asset({ draftId: "p-x", platform: "x", status: "queued", excerpt: "an X draft" }),
      ],
    });
    const user = userEvent.setup();
    const { container } = render(<BoardSurface />);
    await screen.findByText("Our launch video has no editor file");

    await user.selectOptions(screen.getByRole("combobox", { name: "Platform filter" }), "x");

    await waitFor(() =>
      expect(screen.queryByText("Our launch video has no editor file")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("an X draft")).toBeInTheDocument();
    // Sweep cards have no platform, so that column is NOT narrowed — and says it.
    expect(screen.getByText(/not narrowed — a sweep card has no platform/)).toBeInTheDocument();
    // A column emptied BY the filter must not claim the pipeline is clear.
    const composing = Array.from(container.querySelectorAll(".col")).find((c) =>
      c.querySelector(".col-hd")?.textContent?.startsWith("Composing"),
    ) as HTMLElement;
    expect(within(composing).getByText(/Nothing here on X/)).toBeInTheDocument();
    expect(within(composing).queryByText("Nothing composing right now.")).not.toBeInTheDocument();
  });
});
