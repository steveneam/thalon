// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CalendarSurface } from "@/components/calendar/calendar-surface";

/**
 * STEP 1 of the two-step rebuild: this pins the PURE PORT of
 * docs/research/mock-sheets/Calendar.dc.html — the sheet's bands, in the
 * sheet's own classes, with the sheet's placeholder content. It is
 * deliberately structural: there is no data wiring to assert yet.
 *
 * Step 2 restores the behaviour coverage the old-design suite carried
 * (recoverable from git history at the commit before this one): the density
 * switch (month/week/agenda), the day panel, the channel/status filters, the
 * j/k keyboard grammar, and the honest read-failure state — plus the keeper
 * rows this surface owns (the calendar engine, the tenant-wide saved view).
 */
describe("Calendar (exact-mock rebuild step 1 — pure port of Calendar.dc.html)", () => {
  it("renders the sheet's header band: title, week nav, both segmented controls", () => {
    const { container } = render(<CalendarSurface />);

    expect(screen.getByRole("heading", { name: "Calendar" })).toBeInTheDocument();
    expect(screen.getByText("21 – 27 July")).toHaveClass("t-title");

    const segs = container.querySelectorAll(".seg");
    expect(segs).toHaveLength(2);
    // Density first, then the scope filter — the sheet's order.
    expect(Array.from(segs[0].children).map((el) => el.textContent)).toEqual([
      "Week",
      "Month",
      "Agenda",
    ]);
    expect(segs[0].querySelector(".seg-opt.on")?.textContent).toBe("Week");
    expect(Array.from(segs[1].children).map((el) => el.textContent)).toEqual([
      "All",
      "Plans",
      "Needs you",
      "⚑ Flagged",
    ]);
    expect(segs[1].querySelector(".seg-opt.on")?.textContent).toBe("All");

    expect(screen.getByText("3 planned")).toHaveClass("pill", "pill-idle");
    expect(
      screen.getByText("drag to reschedule — snaps to cadence-legal slots"),
    ).toBeInTheDocument();
  });

  it("renders the time grid: day header, waiting row, both quiet bands, seven columns", () => {
    const { container } = render(<CalendarSurface />);

    // Day header — a gutter cell plus seven days, Friday marked today.
    const days = container.querySelectorAll(".cal-days .cal-dh");
    expect(Array.from(days).map((el) => el.querySelector("b")?.textContent)).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
    expect(container.querySelector(".cal-dh.today b")?.textContent).toBe("Fri");

    // The all-day "waiting" lane carries the amber needs-you chip.
    expect(screen.getByText("waiting")).toHaveClass("allday-gut");
    expect(container.querySelectorAll(".allday .allday-cell")).toHaveLength(7);
    expect(screen.getByText("LinkedIn · your review · 26h →")).toHaveClass("amber-chip");

    // Quiet hours collapse at both ends of the day, each with its expand door.
    expect(container.querySelectorAll(".quiet")).toHaveLength(2);
    expect(screen.getByText("00–06")).toBeInTheDocument();
    expect(screen.getByText("21–24")).toBeInTheDocument();
    expect(screen.getAllByText("expand")).toHaveLength(2);

    // The grid itself: hour gutter 06:00–20:00, seven day columns, now-line.
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
    expect(container.querySelectorAll(".grid-wrap .dcol")).toHaveLength(7);
    expect(container.querySelector(".dcol.today")).not.toBeNull();
    expect(container.querySelector(".nowline")).not.toBeNull();
  });

  it("renders the sheet's event grammar: done, engine, planned, the drop ghost", () => {
    const { container } = render(<CalendarSurface />);

    // Two completed events (green, dimmed), one engine event, three plans.
    expect(container.querySelectorAll(".ev.done.ev-ok")).toHaveLength(2);
    expect(container.querySelectorAll(".ev-plan")).toHaveLength(3);
    expect(container.querySelectorAll(".ev-plan .grip")).toHaveLength(3);
    expect(screen.getByText("Sweep · engine").parentElement).toHaveClass("ev");
    expect(screen.getByText("Sweep · ran ✓").parentElement).toHaveClass("done", "ev-ok");

    // Exactly one plan is selected, and the flagged plan wears the warn mark.
    expect(container.querySelectorAll(".ev-plan.sel")).toHaveLength(1);
    expect(container.querySelector(".ev-plan .flag")).not.toBeNull();

    // The drag target reads its legality in place.
    expect(screen.getByText("drop · 15:00 ✓ cadence-legal")).toHaveClass("ghost");
  });

  it("renders the detail popover and the footer's two honesty lines", () => {
    const { container } = render(<CalendarSurface />);

    const detail = container.querySelector(".detail");
    expect(detail).not.toBeNull();
    expect(detail?.textContent).toContain("Planned · LinkedIn");
    expect(detail?.textContent).toContain("door unarmed — a plan");
    expect(detail?.querySelector(".excerpt")).not.toBeNull();
    expect(screen.getByText("Open draft →")).toHaveClass("card-link");
    expect(screen.getByText("Reschedule")).toBeInTheDocument();
    expect(screen.getByText("Remove")).toHaveClass("btn-danger");
    expect(screen.getByText("illegal slots refuse the drop")).toBeInTheDocument();

    expect(screen.getByText("Cadence — LinkedIn ≤ 2/day · X ≤ 4/day · 90m gap")).toBeInTheDocument();
    expect(
      screen.getByText("Plans, not uploads — each platform’s door arms on your GO."),
    ).toBeInTheDocument();
  });

  it("carries no legacy bridge styling — the port is the sheet's classes only", () => {
    const { container } = render(<CalendarSurface />);
    // The old implementation was Tailwind semantic-token markup; a rebuilt
    // surface enters the burn-down at zero (the bridge pin enforces this
    // repo-wide, this keeps the failure local and legible).
    expect(container.querySelector('[class*="text-muted-foreground"]')).toBeNull();
    expect(container.querySelector('[class*="bg-card"]')).toBeNull();
    // Rule 6: the surface root carries its scope class beside .content.
    expect(container.querySelector(".content.calendar-surface")).not.toBeNull();
  });
});
