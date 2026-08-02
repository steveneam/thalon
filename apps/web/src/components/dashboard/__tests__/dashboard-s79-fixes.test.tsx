// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "@/components/dashboard/dashboard";
import { WeekCard } from "@/components/dashboard/week-card";
import { PulseProvider } from "@/components/workspace/pulse-context";
import { fixturePlan, fixturePulse } from "@/lib/workspace/fixtures";
import type { PipelineAsset, PlanPayload } from "@/lib/workspace/types";
import { server } from "@/lib/testing/server";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/app",
  useRouter: () => ({ push }),
}));

function renderDashboard() {
  return render(
    <PulseProvider>
      <Dashboard />
    </PulseProvider>,
  );
}

/**
 * The s79 lane-3 fix pass — the five Dashboard findings that survived the
 * adversarial verify round (D1 blocker + D2/D3/D4/D5 high, 15 refuters, all
 * three lenses real on every one). Each test was run against the reverted fix
 * to prove it fails without it.
 */
describe("Dashboard — s79 verified fixes", () => {
  beforeEach(() => {
    push.mockClear();
  });

  /* ── D1 [blocker] — a focused control owns its own Enter ────────────────── */

  it("D1: Enter on a focused button activates THAT control, not the selected draft", async () => {
    const user = userEvent.setup();
    renderDashboard();
    // The binding is only armed once the card has rows.
    await screen.findByText(/oldest first/);

    const board = screen.getByRole("button", { name: "Board" });
    board.focus();
    await user.keyboard("{Enter}");

    // Measured live before this fix: Enter here landed on
    // /app/approve?run=…&draft=… instead of the Board the operator was on.
    // (s92: the toggle switches Home's state in place — /app?view=board —
    // since the /app/board route retired with the pipeline-board wiring.)
    expect(push).toHaveBeenCalledWith("/app?view=board");
    expect(push.mock.calls.every(([href]) => !String(href).includes("draft="))).toBe(true);
  });

  it("D1: Enter on a focused link does not fire the card's binding at all", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByText(/oldest first/);

    screen.getByRole("link", { name: "Open approve →" }).focus();
    await user.keyboard("{Enter}");

    // The Link owns Enter; jsdom follows no href, so the correct outcome is
    // that the surface pushed NOTHING of its own.
    expect(push).not.toHaveBeenCalled();
  });

  it("D1: a focused row keeps ONE Enter — the guard covers role=button too", async () => {
    const user = userEvent.setup();
    const { container } = renderDashboard();
    await screen.findByText(/oldest first/);

    const row = container.querySelector<HTMLElement>('.card-rows .row[role="button"]');
    expect(row).not.toBeNull();
    (row as HTMLElement).focus();
    await user.keyboard("{Enter}");

    // Before the fix the row's own onKeyDown AND the window binding both fired,
    // which is why the narrower `button, a` guard the other four siblings use
    // would not have been enough here.
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("D1: with nothing focused, ↵ still opens the selected draft (the footer promises it)", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByText(/oldest first/);

    document.body.focus();
    await user.keyboard("{Enter}");

    expect(push).toHaveBeenCalledTimes(1);
    expect(String(push.mock.calls[0][0])).toMatch(/^\/app\/approve\?run=.*&draft=/);
  });

  /* ── D2 [high] — j/k brings the selection with it ───────────────────────── */

  it("D2: j scrolls the newly selected row into view, block:nearest", async () => {
    const user = userEvent.setup();
    const calls: unknown[] = [];
    // jsdom implements no layout and no scrollIntoView — the house pattern
    // calls it optionally, so the assertion is on the CALL, not on a pixel.
    Element.prototype.scrollIntoView = function (arg?: unknown) {
      calls.push(arg);
    } as unknown as typeof Element.prototype.scrollIntoView;

    renderDashboard();
    await screen.findByText(/oldest first/);
    expect(calls).toHaveLength(0); // never on mount, before the operator moves

    await user.keyboard("j");
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    expect(calls[0]).toEqual({ block: "nearest" });

    // @ts-expect-error -- restore jsdom's own absence
    delete Element.prototype.scrollIntoView;
  });

  /* ── D3 [high] — two reads, two windows, the bound stated ───────────────── */

  it("D3: the card states the gap between the pulse count and the rows it lists", async () => {
    renderDashboard();
    // The fixture is the live shape in miniature: pulse says 3, the plan read
    // returns 2 waiting assets.
    expect(fixturePulse.needsYou).toBe(3);
    expect(fixturePlan.assets.filter((a) => a.status === "queued" || a.status === "blocked")).toHaveLength(2);

    const footer = await screen.findByText(/2 of 3 shown/);
    expect(footer).toBeInTheDocument();
    // A count is not a door: the remainder gets one.
    expect(
      within(footer).getByRole("link", { name: /the oldest wait in the queue →/ }),
    ).toHaveAttribute("href", "/app/approve");
    // The pill keeps the pulse's number — the topbar and rail render the same
    // fact on this screen, so ONE number for one fact.
    const card = screen.getByLabelText("Needs you");
    expect(within(card).getByText("3")).toHaveClass("pill", "pill-warn");
  });

  it("D3: the tile says which set its oldest-wait measures when the two disagree", async () => {
    renderDashboard();
    expect(await screen.findByText(/2 of 3 read · oldest of those/)).toBeInTheDocument();
  });

  it("D3: no gap, no bound line — the card says nothing when the reads agree", async () => {
    server.use(
      http.get("/api/app/pulse", () => HttpResponse.json({ ...fixturePulse, needsYou: 2 })),
    );
    renderDashboard();
    await screen.findByText(/oldest first/);
    expect(screen.queryByText(/of 2 shown/)).toBeNull();
    expect(screen.queryByText(/read · oldest of those/)).toBeNull();
  });

  /* ── D4 [high] — carried waiting work is not an event on today's clock ──── */

  it("D4 guard: the sweep-free plan really does carry exactly one waiting draft", () => {
    // A guard on the fixtures below: if `waitingPlan` stops producing a waiting
    // asset, the D4/D5 assertions would pass by rendering nothing.
    expect(waitingPlan(2).assets.filter((a) => a.status === "queued")).toHaveLength(1);
    expect(waitingPlan(2).sweep).toBeNull();
  });

  function waitingPlan(hoursAgo: number): PlanPayload {
    const asset: PipelineAsset = {
      ...fixturePlan.assets[0],
      draftId: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
      status: "queued",
      judgedAt: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(),
      generatedAt: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(),
      capturedAt: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(),
    };
    return { ...fixturePlan, assets: [asset], plannedSlots: [], sweep: null };
  }

  it("D4: a draft waiting since before this week goes in the lane, off the hour axis", async () => {
    const user = userEvent.setup();
    // 9 days: before the visible week, so `waitingEvents` carries it into today.
    const { container } = render(<WeekCard status="success" plan={waitingPlan(9 * 24)} now={new Date()} />);
    await user.click(screen.getByRole("button", { name: "Today" }));

    const lane = container.querySelector(".wd-wait");
    expect(lane).not.toBeNull();
    // 9 days reads as days (s93 waitLabel rollover) — "216h" hid the magnitude.
    expect(within(lane as HTMLElement).getByRole("link", { name: /your review · 9d →/ })).toHaveAttribute(
      "href",
      expect.stringContaining("/app/approve?run="),
    );
    // The assertion that shipped the bug: a chip positioned on today's axis.
    expect(container.querySelectorAll(".wd-ev.wd-you")).toHaveLength(0);
    // And the empty axis says which fact it is reporting.
    expect(screen.getByText(/Nothing is timed for today/)).toBeInTheDocument();
  });

  /**
   * PIN THE CLOCK — this asserts a chip lands on the visible time axis, and the
   * axis only spans 06:00–21:00. `waitingPlan(2)` means "2 hours ago", so the
   * chip is inside the axis only when the run starts after ~08:00: at 07:2x it
   * resolves to ~05:2x, falls off the axis, and the chip this test is about is
   * never rendered. Found by a wrap verify that happened to run at 07:21.
   *
   * Third instance of this class today (two in calendar-surface.test.tsx), so a
   * repo-wide sweep for the same shape followed rather than a fourth one-off.
   */
  it("D4: a draft that started waiting TODAY keeps its true place on the clock", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const noon = new Date();
    noon.setHours(12, 0, 0, 0);
    vi.setSystemTime(noon);
    try {
      const user = userEvent.setup();
      const { container } = render(
        <WeekCard status="success" plan={waitingPlan(2)} now={new Date()} />,
      );
      await user.click(screen.getByRole("button", { name: "Today" }));

      expect(container.querySelector(".wd-wait")).toBeNull();
      expect(container.querySelectorAll(".wd-ev.wd-you").length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  /* ── D5 [high] — the scope root the colour fix needs (rules: dashboard-css) ── */

  it("D5: the surface carries its scope root, so a shell override has somewhere to live", async () => {
    const { container } = renderDashboard();
    await screen.findByText(/oldest first/);
    expect(container.querySelector(".content.dashboard-surface")).not.toBeNull();
  });

  it("D5: every waiting mark is a link — which is why the cascade bit", () => {
    // The week rows, on a plan whose only marks are waiting drafts (the shared
    // fixture's 4-hourly sweep ticks fill today's 3-mark bound first).
    const { container } = render(<WeekCard status="success" plan={waitingPlan(2)} now={new Date()} />);
    const marks = container.querySelectorAll(".mark-you");
    expect(marks.length).toBeGreaterThan(0);
    for (const mark of marks) expect(mark.tagName).toBe("A");
  });
});
