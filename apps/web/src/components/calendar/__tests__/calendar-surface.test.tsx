// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    // s78b: drag IS wired, so the sheet's ⋮⋮ drag handle is drawn again —
    // this is "the change that wires drag" the previous note pointed at.
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

    // s78: the write doors are LIVE — /api/calendar/slots exists.
    expect(within(detail).getByRole("button", { name: "Reschedule" })).toBeEnabled();
    expect(within(detail).getByRole("button", { name: "Remove" })).toBeEnabled();

    // Selection wears the sheet's own `.sel`.
    expect(container.querySelector(".ev-plan.sel")).not.toBeNull();

    await user.click(within(detail).getByRole("button", { name: "Close" }));
    expect(container.querySelector(".detail")).toBeNull();
  });

  /**
   * INVERTED s78b. Lane 2 pinned "never claims a drag it cannot do" while drag
   * was unwired — right then. The founder then hit the real gap by using the
   * calendar, drag was wired, and the sheet's own affordance came back. The
   * invariant is unchanged and still the point: the grip appears on a PLAN and
   * nowhere else, because a completed run is a record of when something
   * happened and dragging it would promise to move history.
   */
  it("advertises drag on a plan, and only on a plan", async () => {
    seedPlan({ plannedSlots: [PLAN_SLOT] });
    const { container } = render(<CalendarSurface />);
    await screen.findByText("1 planned");

    expect(
      screen.getByText("click an empty slot to plan · drag a plan to move it"),
    ).toBeInTheDocument();
    expect(container.querySelector(".ev-plan .grip")).not.toBeNull();
    for (const box of container.querySelectorAll(".ev")) {
      if (!box.classList.contains("ev-plan")) {
        expect(box.querySelector(".grip")).toBeNull();
      }
    }
    // Nothing is being dragged at rest, so no drop hint is drawn.
    expect(container.querySelector(".drop-hint")).toBeNull();
  });

  /**
   * s78 — the calendar's WRITE door. `/api/calendar/slots` rides the slot
   * store shipped in the Phase-I window: no new table, no new contract, no
   * migration. A slot is a PLAN — writing one publishes nothing.
   */
  it("Reschedule moves a real plan through the slot write route, then re-reads the plan", async () => {
    seedPlan({ plannedSlots: [PLAN_SLOT], assets: [asset({ draftId: "d-plan" })] });
    const posted: Array<Record<string, unknown>> = [];
    server.use(
      http.post("/api/calendar/slots", async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        posted.push(body);
        return HttpResponse.json({
          slot: { draftId: "d-plan", scheduledFor: body.scheduledFor, note: "pipeline thread" },
        });
      }),
    );
    const user = userEvent.setup();
    const { container } = render(<CalendarSurface />);

    await user.click((await screen.findByText("Planned · LinkedIn")).closest(".ev") as HTMLElement);
    const detail = container.querySelector(".detail") as HTMLElement;
    await user.click(within(detail).getByRole("button", { name: "Reschedule" }));

    const field = within(detail).getByLabelText("Move this plan to") as HTMLInputElement;
    // The field opens at the plan's CURRENT instant — a move starts from the truth.
    expect(field.value).toBe(
      `${today(9, 30).getFullYear()}-${`${today(9, 30).getMonth() + 1}`.padStart(2, "0")}-${`${today(9, 30).getDate()}`.padStart(2, "0")}T09:30`,
    );

    fireEvent.change(field, { target: { value: field.value.replace("T09:30", "T16:45") } });
    await user.click(within(detail).getByRole("button", { name: "Move" }));

    await waitFor(() => expect(posted).toHaveLength(1));
    expect(posted[0].draftId).toBe("d-plan");
    expect(new Date(posted[0].scheduledFor as string).getHours()).toBe(16);
    expect(new Date(posted[0].scheduledFor as string).getMinutes()).toBe(45);
  });

  it("Remove asks first, then unplans — and says nothing changed when the route refuses", async () => {
    seedPlan({ plannedSlots: [PLAN_SLOT], assets: [asset({ draftId: "d-plan" })] });
    server.use(
      http.delete("/api/calendar/slots", () =>
        HttpResponse.json({ error: "planned slot for draft not found" }, { status: 404 }),
      ),
    );
    const user = userEvent.setup();
    const { container } = render(<CalendarSurface />);

    await user.click((await screen.findByText("Planned · LinkedIn")).closest(".ev") as HTMLElement);
    const detail = container.querySelector(".detail") as HTMLElement;
    await user.click(within(detail).getByRole("button", { name: "Remove" }));

    // Destructive verbs confirm — and say what survives.
    expect(within(detail).getByText(/Remove this plan\?/)).toBeInTheDocument();
    await user.click(within(detail).getByRole("button", { name: "Remove" }));

    // A refused write is surfaced verbatim, never swallowed into a success.
    expect(await within(detail).findByRole("alert")).toHaveTextContent(
      "planned slot for draft not found",
    );
  });

  /*
   * THE CLOCK IS PINNED HERE, and it has to be (s80).
   *
   * This test seeded `nextSweepAt` two hours from the REAL now and asserted a
   * tick projects. But the grid's window is 06:00–21:00 (calendar-model.ts) and
   * `projectSweepTicks` clips to it — so whenever the suite ran after ~19:00
   * local, the only tick landed outside the window, zero projected, and the
   * assertion failed. It passed all day and turned main red every evening; it
   * was found at 20:06 UTC on a run that had been green five times earlier the
   * same session. A test whose verdict depends on what time somebody runs it is
   * not measuring the product.
   *
   * `shouldAdvanceTime` keeps the timers moving so testing-library's async
   * finds still resolve — a frozen clock would hang them.
   */
  it("projects the engine's next sweep, and nothing at all from an overdue pointer", async () => {
    const nineAm = today(9, 0);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(nineAm);
    try {
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
    } finally {
      vi.useRealTimers();
    }
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

  /**
   * s78 blocker — THE CLOCK DECIDES WHICH DAY IS TODAY. `weekDays` flags
   * today against its own argument, so passing the navigation anchor marked
   * one day of EVERY paged week as today: a "· today" label and a tinted
   * column in a week that has no today, a now-line drawn on it, and every
   * carried waiting draft piled onto that fake day.
   */
  describe("today is the clock's, never the pager's", () => {
    /** Three drafts that started waiting well before this week — the carry set. */
    const olderWaiting = [
      asset({ draftId: "w1", status: "queued", judgedAt: hoursAgo(24 * 20) }),
      asset({ draftId: "w2", status: "queued", judgedAt: hoursAgo(24 * 21) }),
      asset({ draftId: "w3", status: "blocked", judgedAt: hoursAgo(24 * 22) }),
    ];

    it("marks today on the current week and carries older waiting work into it", async () => {
      seedPlan({ assets: olderWaiting });
      const { container } = render(<CalendarSurface />);
      await screen.findByText("0 planned");

      expect(container.querySelectorAll(".cal-dh.today")).toHaveLength(1);
      expect(container.querySelector(".nowline")).not.toBeNull();
      expect(screen.getByText("+1 more")).toBeInTheDocument();
    });

    it("marks NO day today on a navigated week, draws no now-line, and carries nothing into it", async () => {
      seedPlan({ assets: olderWaiting });
      const user = userEvent.setup();
      const { container } = render(<CalendarSurface />);
      await screen.findByText("0 planned");

      await user.click(screen.getByRole("button", { name: "Next week" }));

      expect(container.querySelector(".cal-dh.today")).toBeNull();
      expect(container.querySelector(".dcol.today")).toBeNull();
      expect(screen.queryByText(/· today/)).not.toBeInTheDocument();
      // A line that means "now" may not be drawn on a week without now.
      expect(container.querySelector(".nowline")).toBeNull();
      // …and the carry has no day to land on, so it does not invent one.
      expect(container.querySelector(".amber-chip")).toBeNull();
      expect(screen.queryByText(/more$/)).not.toBeInTheDocument();
    });
  });

  /**
   * s78 — "+N more" stated a quantity and did nothing. Its only disclosure
   * was a mouse-only `title`, so keyboard and touch had no route at all.
   */
  it("+N more is a real control that opens the agenda at Needs-you scope", async () => {
    seedPlan({
      assets: [
        asset({ draftId: "w1", status: "queued", judgedAt: hoursAgo(2) }),
        asset({ draftId: "w2", status: "queued", judgedAt: hoursAgo(3) }),
        asset({ draftId: "w3", status: "blocked", judgedAt: hoursAgo(4) }),
        asset({ draftId: "w4", status: "queued", judgedAt: hoursAgo(5) }),
      ],
    });
    const user = userEvent.setup();
    render(<CalendarSurface />);
    await screen.findByText("0 planned");

    const more = screen.getByRole("button", { name: /Open all 4 waiting this week/ });
    await user.click(more);

    expect(screen.getByRole("button", { name: "Agenda" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Needs you" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // All four are listed, not two plus a count.
    expect(screen.getAllByText("needs you")).toHaveLength(4);
  });

  /**
   * s78 — a carried waiting row keeps its true instant but is filed under
   * today, so a bare weekday stamp named a day that also exists inside the
   * labelled range: a three-week-old draft read as in-range, and sorted to
   * the top as if it were the week's first item.
   */
  it("an agenda row carried from outside the range says so, and prints its true date", async () => {
    const started = new Date(Date.now() - 24 * 20 * 3_600_000);
    seedPlan({
      assets: [asset({ draftId: "w-old", status: "queued", judgedAt: started.toISOString() })],
    });
    const user = userEvent.setup();
    render(<CalendarSurface />);
    await screen.findByText("0 planned");

    await user.click(screen.getByRole("button", { name: "Agenda" }));

    expect(screen.getByText(/started waiting before this week/)).toBeInTheDocument();
    // The stamp is the real date, not a weekday the labelled week also has.
    const stamp = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(
      started,
    );
    expect(screen.getByText(new RegExp(stamp))).toBeInTheDocument();
  });
});
