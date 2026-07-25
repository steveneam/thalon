// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { CalendarSurface } from "@/components/calendar/calendar-surface";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/app/calendar",
  useRouter: () => ({ push: (href: string) => push(href) }),
}));
import { listSavedViewsTestState, seedSavedView } from "@/lib/testing/handlers";
import { server } from "@/lib/testing/server";
import type { PipelineAsset, PlanPayload, PlannedSlotWire } from "@/lib/workspace/types";

/** Today at a fixed hour — the grid is built in the operator's local zone. */
function today(hour: number, minute = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

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
    generatedAt: hoursAgo(30),
    judgedAt: null,
    decidedAt: null,
    publishedAt: null,
    gates: [],
    reasons: [],
    deployRef: null,
    excerpt: "The pipeline thread — what deterministic video changes",
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

const PLAN_SLOT: PlannedSlotWire = {
  draftId: "d-plan",
  platform: "linkedin",
  scheduledFor: today(9, 30).toISOString(),
  note: "pipeline thread",
};

/**
 * STEP 2 of the two-step rebuild: the sheet's bands (pinned structurally at
 * the commit before this one) now carry the real plan read. These pin the
 * honesty rules — a fabricated time, a real-looking empty week, or a door
 * that pretends to write is a failure.
 */
describe("Calendar (exact-mock rebuild — Calendar.dc.html)", () => {
  it("renders the sheet's bands with real data behind them", async () => {
    seedPlan({
      plannedSlots: [PLAN_SLOT],
      cadence: [{ platform: "linkedin", maxPerDay: 2, minGapMinutes: 90 }],
    });
    const { container } = render(<CalendarSurface />);

    expect(screen.getByRole("heading", { name: "Calendar" })).toBeInTheDocument();
    await screen.findByText("1 planned");

    // Both segmented controls, in the sheet's order and vocabulary.
    const segs = container.querySelectorAll(".seg");
    expect(segs).toHaveLength(2);
    expect(Array.from(segs[0].children).map((el) => el.textContent)).toEqual([
      "Week",
      "Month",
      "Agenda",
    ]);
    expect(Array.from(segs[1].children).map((el) => el.textContent)).toEqual([
      "All",
      "Plans",
      "Needs you",
      "⚑ Flagged",
    ]);

    // The grid's own bands: seven day columns, the waiting lane, both quiet
    // bands, the hour gutter — all the sheet's classes.
    expect(container.querySelectorAll(".cal-days .cal-dh")).toHaveLength(7);
    expect(container.querySelectorAll(".allday .allday-cell")).toHaveLength(7);
    expect(container.querySelectorAll(".quiet")).toHaveLength(2);
    expect(container.querySelectorAll(".grid-wrap .dcol")).toHaveLength(7);
    expect(Array.from(container.querySelectorAll(".gut span")).map((el) => el.textContent)).toEqual([
      "06:00",
      "08:00",
      "10:00",
      "12:00",
      "14:00",
      "16:00",
      "18:00",
      "20:00",
    ]);

    // Today is marked in both the header and its column.
    expect(container.querySelector(".cal-dh.today")).not.toBeNull();
    expect(container.querySelector(".dcol.today")).not.toBeNull();

    // The footer's two lines: the tenant's REAL cadence, then the invariant.
    expect(screen.getByText("Cadence — LinkedIn ≤ 2/day 90m gap")).toBeInTheDocument();
    expect(
      screen.getByText("Plans, not uploads — each platform’s door arms on your GO."),
    ).toBeInTheDocument();

    // No legacy bridge styling survives the rebuild.
    expect(container.querySelector('[class*="text-muted-foreground"]')).toBeNull();
    expect(container.querySelector('[class*="bg-card"]')).toBeNull();
    expect(container.querySelector(".content.calendar-surface")).not.toBeNull();
  });

  it("places a plan at its own time, in the sheet's dashed dress", async () => {
    seedPlan({ plannedSlots: [PLAN_SLOT] });
    render(<CalendarSurface />);

    const plan = await screen.findByText("Planned · LinkedIn");
    const box = plan.closest(".ev");
    expect(box).toHaveClass("ev-plan");
    expect(box).toHaveStyle({ top: "154px" }); // 09:30 → (9.5 − 6) × 44
    expect(box?.textContent).toContain("09:30 · pipeline thread");
    expect(box?.querySelector(".grip")).not.toBeNull();
  });

  it("dresses published work as done and never dresses a rejection as a success", async () => {
    seedPlan({
      assets: [
        asset({
          draftId: "d-pub",
          platform: "web",
          status: "published",
          decidedAt: today(11).toISOString(),
          publishedAt: today(11).toISOString(),
          deployRef: "/blog/post",
        }),
        asset({
          draftId: "d-rej",
          status: "rejected",
          decidedAt: today(13).toISOString(),
        }),
      ],
    });
    const { container } = render(<CalendarSurface />);

    const published = (await screen.findByText("Blog · published ✓")).closest(".ev");
    expect(published).toHaveClass("done", "ev-ok");
    const rejected = screen.getByText("LinkedIn · rejected").closest(".ev");
    expect(rejected).toHaveClass("done");
    expect(rejected).not.toHaveClass("ev-ok");
    expect(container.querySelectorAll(".ev-ok")).toHaveLength(1);
  });

  it("the waiting lane carries what waits on you, with the hours it has waited", async () => {
    seedPlan({
      assets: [asset({ draftId: "d-wait", status: "queued", judgedAt: hoursAgo(26) })],
    });
    render(<CalendarSurface />);

    const chip = await screen.findByText(/LinkedIn · your review · 26h/);
    expect(chip).toHaveClass("amber-chip");
    expect(chip).toHaveAttribute("href", "/app/approve?run=run-1&draft=d-wait");
  });

  it("flags a plan that breaks the tenant's own cadence, and names the rule", async () => {
    seedPlan({
      cadence: [{ platform: "linkedin", maxPerDay: 1 }],
      plannedSlots: [
        PLAN_SLOT,
        { draftId: "d-plan-2", platform: "linkedin", scheduledFor: today(15).toISOString(), note: "second" },
      ],
    });
    const user = userEvent.setup();
    const { container } = render(<CalendarSurface />);

    await screen.findByText("2 planned");
    const flagged = container.querySelectorAll(".ev-plan .flag");
    expect(flagged).toHaveLength(1);

    // The ⚑ Flagged scope shows exactly that plan, and the popover says why.
    await user.click(screen.getByRole("button", { name: "⚑ Flagged" }));
    expect(container.querySelectorAll(".ev")).toHaveLength(1);
    await user.click(container.querySelector(".ev") as HTMLElement);
    expect(
      screen.getByText("LinkedIn is planned 2× that day — your cadence allows 1"),
    ).toBeInTheDocument();
  });

  it("the detail popover opens on a plan and states that its doors cannot write", async () => {
    seedPlan({ plannedSlots: [PLAN_SLOT], assets: [asset({ draftId: "d-plan" })] });
    const user = userEvent.setup();
    const { container } = render(<CalendarSurface />);

    await user.click((await screen.findByText("Planned · LinkedIn")).closest(".ev") as HTMLElement);

    const detail = container.querySelector(".detail") as HTMLElement;
    expect(detail).not.toBeNull();
    expect(detail.textContent).toContain("door unarmed — a plan");
    expect(within(detail).getByText("Open draft →")).toHaveAttribute(
      "href",
      "/app/approve?run=run-1&draft=d-plan",
    );

    // The write doors are honestly disabled — the slot store has no route.
    const reschedule = within(detail).getByRole("button", { name: "Reschedule" });
    const remove = within(detail).getByRole("button", { name: "Remove" });
    expect(reschedule).toBeDisabled();
    expect(remove).toBeDisabled();
    expect(reschedule).toHaveAttribute("title", expect.stringContaining("read route only"));

    // Selection wears the sheet's own `.sel`.
    expect(container.querySelector(".ev-plan.sel")).not.toBeNull();

    await user.click(within(detail).getByRole("button", { name: "Close" }));
    expect(container.querySelector(".detail")).toBeNull();
  });

  it("never claims a drag it cannot do", async () => {
    seedPlan({ plannedSlots: [PLAN_SLOT] });
    const { container } = render(<CalendarSurface />);
    await screen.findByText("1 planned");

    expect(
      screen.getByText("drag to reschedule isn’t wired — the slot store has no write route yet"),
    ).toBeInTheDocument();
    // No drop ghost: there is no drag to land.
    expect(container.querySelector(".ghost")).toBeNull();
  });

  it("projects the engine's next sweep, and nothing at all from an overdue pointer", async () => {
    seedPlan({
      sweep: {
        lastSweptAt: today(6, 30).toISOString(),
        nextSweepAt: new Date(Date.now() + 2 * 3_600_000).toISOString(),
        intervalMs: 8 * 3_600_000,
        source: "bluesky",
      },
    });
    const { unmount } = render(<CalendarSurface />);
    // The pointer projects a tick every interval to the end of the week.
    expect((await screen.findAllByText("Sweep · engine")).length).toBeGreaterThan(0);
    unmount();

    seedPlan({
      sweep: {
        lastSweptAt: hoursAgo(72),
        nextSweepAt: hoursAgo(48),
        intervalMs: 8 * 3_600_000,
        source: "bluesky",
      },
    });
    render(<CalendarSurface />);
    await screen.findByText("0 planned");
    expect(screen.queryByText("Sweep · engine")).not.toBeInTheDocument();
  });

  it("a failed read says so and offers retry — never a quiet week", async () => {
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
              assets: [],
              plannedSlots: [PLAN_SLOT],
            } satisfies PlanPayload);
      }),
    );
    const user = userEvent.setup();
    render(<CalendarSurface />);

    expect(
      await screen.findByText(
        "Couldn’t read the plan — this is a read failure, not an empty calendar.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("– planned")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("1 planned")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("the density switch is the keeper engine: month cells and an agenda list", async () => {
    seedPlan({ plannedSlots: [PLAN_SLOT] });
    const user = userEvent.setup();
    const { container } = render(<CalendarSurface />);
    await screen.findByText("1 planned");

    await user.click(screen.getByRole("button", { name: "Month" }));
    expect(container.querySelectorAll(".mcell").length % 7).toBe(0);
    expect(container.querySelector(".mcell.today")).not.toBeNull();
    expect(screen.getByText(/Planned · LinkedIn 09:30/)).toHaveClass("mark", "mark-plan");
    expect(
      screen.getByText("the plan read covers ±2 weeks — a month shows what it carries"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Agenda" }));
    expect(container.querySelector(".card-head .t-title")?.textContent).toBe("Agenda");
    const row = container.querySelector(".row") as HTMLElement;
    expect(row.textContent).toContain("Planned · LinkedIn");
    expect(within(row).getByText("plan")).toHaveClass("pill-idle");
  });

  it("an empty week says it is empty rather than showing nothing at all", async () => {
    seedPlan({});
    const user = userEvent.setup();
    render(<CalendarSurface />);
    await screen.findByText("0 planned");

    await user.click(screen.getByRole("button", { name: "Agenda" }));
    expect(screen.getByText(/Nothing in this week/)).toBeInTheDocument();
    expect(
      screen.getByText("No cadence rules configured — every platform plans unconstrained."),
    ).toBeInTheDocument();
  });

  it("restores the tenant-wide saved view, and saves changes back to it", async () => {
    seedSavedView({
      surface: "calendar",
      name: "Default",
      config: { density: "agenda", scope: "plans", expanded: false },
    });
    seedPlan({ plannedSlots: [PLAN_SLOT] });
    const user = userEvent.setup();
    render(<CalendarSurface />);

    // The stored view decides the resting density and scope — no new band.
    expect(await screen.findByText("Agenda")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Plans" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Week" }));
    await waitFor(() =>
      expect(listSavedViewsTestState()[0].config).toMatchObject({
        density: "week",
        scope: "plans",
      }),
    );
  });

  it("simply opening the calendar writes nothing back to the views store", async () => {
    seedPlan({ plannedSlots: [PLAN_SLOT] });
    render(<CalendarSurface />);
    await screen.findByText("1 planned");

    // A visit is not a change: the tenant's view record is created by the
    // operator choosing something, never by the surface rendering.
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(listSavedViewsTestState()).toEqual([]);
  });

  it("the quiet bands count what they hide, and expanding shows the whole day", async () => {
    seedPlan({
      plannedSlots: [
        { draftId: "d-early", platform: "x", scheduledFor: today(3).toISOString(), note: "early" },
      ],
    });
    const user = userEvent.setup();
    const { container } = render(<CalendarSurface />);

    await screen.findByText("1 planned");
    expect(screen.getByText(/quiet hours · collapsed — 1 hidden/)).toBeInTheDocument();
    expect(container.querySelector(".ev-plan")).toBeNull();

    await user.click(screen.getAllByRole("button", { name: "expand" })[0]);
    expect(container.querySelector(".ev-plan")).not.toBeNull();
    expect(container.querySelector(".dcol")).toHaveStyle({ height: "1056px" });
  });

  it("keeps the one list keyboard grammar: j/k walk the week in time order", async () => {
    seedPlan({
      plannedSlots: [
        PLAN_SLOT,
        { draftId: "d-plan-2", platform: "x", scheduledFor: today(15).toISOString(), note: "later" },
      ],
    });
    const user = userEvent.setup();
    const { container } = render(<CalendarSurface />);
    await screen.findByText("2 planned");

    await user.keyboard("j");
    expect(container.querySelector(".ev.sel")?.textContent).toContain("Planned · LinkedIn");
    await user.keyboard("j");
    expect(container.querySelector(".ev.sel")?.textContent).toContain("Planned · X");
    await user.keyboard("k");
    expect(container.querySelector(".ev.sel")?.textContent).toContain("Planned · LinkedIn");
    await user.keyboard("{Escape}");
    expect(container.querySelector(".ev.sel")).toBeNull();
  });

  it("↵ opens the selected event's own draft — the keeper's other half", async () => {
    push.mockClear();
    seedPlan({ plannedSlots: [PLAN_SLOT], assets: [asset({ draftId: "d-plan" })] });
    const user = userEvent.setup();
    render(<CalendarSurface />);
    await screen.findByText("1 planned");

    await user.keyboard("j");
    await user.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith("/app/approve?run=run-1&draft=d-plan");
  });
});
