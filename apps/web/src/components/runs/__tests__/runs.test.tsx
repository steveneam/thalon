// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Runs } from "@/components/runs/runs";
import { run } from "@/lib/approve-queue/fixtures";
import { server } from "@/lib/testing/server";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/app/runs",
  useRouter: () => ({ push }),
}));

const TODAY_9AM = new Date(new Date().setHours(9, 0, 0, 0)).toISOString();
const FAILED_ID = "33333333-3333-3333-3333-333333333333";
const PUBLISHED_ID = "44444444-4444-4444-4444-444444444444";

/** Two runs today: one with a recorded failure, one that reached a live page. */
function seedFeed() {
  server.use(
    http.get("/api/runs", () =>
      HttpResponse.json({
        runs: [
          {
            ...run(FAILED_ID, TODAY_9AM, false),
            status: "failed",
            lastError: "IrrecoverableGenerationError: gateway 400 — malformed shell output",
          },
          run(PUBLISHED_ID, TODAY_9AM),
        ],
      }),
    ),
    http.get("/api/app/plan", () =>
      HttpResponse.json({
        sweep: {
          lastSweptAt: TODAY_9AM,
          nextSweepAt: TODAY_9AM,
          intervalMs: 4 * 3_600_000,
          source: "bluesky",
        },
        areas: 1,
        cadence: [],
        plannedSlots: [],
        assets: [
          {
            draftId: "dddddddd-dddd-dddd-dddd-dddddddddddd",
            runId: PUBLISHED_ID,
            platform: "web",
            format: "web_page",
            status: "approved",
            sourceKind: "url",
            capturedAt: null,
            generatedAt: TODAY_9AM,
            judgedAt: TODAY_9AM,
            decidedAt: TODAY_9AM,
            publishedAt: TODAY_9AM,
            gates: [],
            reasons: [],
            deployRef: "/blog/fixture-post",
            excerpt: "inside the build-step pipeline",
          },
        ],
      }),
    ),
  );
}

describe("Runs (exact-mock rebuild, Runs.dc.html)", () => {
  // `push` is module-scoped, so without this a later "never navigated" assertion
  // would see an earlier test's call and pass (or fail) for the wrong reason.
  beforeEach(() => push.mockClear());

  it("renders the sheet's bands: headline pills, the seg, a day card per day, the receipts footer", async () => {
    seedFeed();
    render(<Runs />);

    expect(screen.getByRole("heading", { name: "Runs" })).toBeInTheDocument();
    expect(await screen.findByText("2 this week")).toBeInTheDocument();
    // The error channel carries a REAL count only (the partial+failed run).
    expect(screen.getByText("1 failed")).toBeInTheDocument();
    for (const label of ["All", "Failed", "Published"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByText(/^Today · /)).toBeInTheDocument();
    expect(
      screen.getByText(/Every run keeps its receipts/),
    ).toBeInTheDocument();
  });

  it("keeps the B4.5 triage keepers: lastError VERBATIM, and Retry rests unarmed with its reason", async () => {
    seedFeed();
    render(<Runs />);

    expect(
      await screen.findByText(
        "IrrecoverableGenerationError: gateway 400 — malformed shell output",
      ),
    ).toBeInTheDocument();
    // The pill, not the seg option of the same word.
    expect(screen.getByText("Failed", { selector: ".pill-err" })).toBeInTheDocument();
    const retry = screen.getByText("Retry");
    expect(retry).toHaveAttribute("aria-disabled", "true");
    expect(retry).toHaveAttribute("title", expect.stringContaining("isn’t wired yet"));
  });

  it("published truth comes from the plan read — pill, live link, and the Published filter", async () => {
    seedFeed();
    const user = userEvent.setup();
    render(<Runs />);

    expect(await screen.findByText("Published")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /\/blog\/fixture-post ↗/ })).toHaveAttribute(
      "href",
      "/blog/fixture-post",
    );

    await user.click(screen.getByRole("button", { name: "Published" }));
    await waitFor(() =>
      expect(
        screen.queryByText(
          "IrrecoverableGenerationError: gateway 400 — malformed shell output",
        ),
      ).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Failed" }));
    expect(
      await screen.findByText(
        "IrrecoverableGenerationError: gateway 400 — malformed shell output",
      ),
    ).toBeInTheDocument();
  });

  it("j/k move the sheet's .row.sel and ↵ opens the run's receipts", async () => {
    seedFeed();
    const user = userEvent.setup();
    render(<Runs />);
    await screen.findByText("Failed");

    const rows = screen.getAllByRole("button", { name: /— (Failed|Published)$/ });
    expect(rows[0].className).toContain("row sel");
    await user.keyboard("j");
    await waitFor(() => expect(rows[1].className).toContain("row sel"));
    expect(rows[0].className).not.toContain("sel");

    await user.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith(`/app/approve?run=${PUBLISHED_ID}`);
  });

  /*
   * s77 finding (runs.tsx:149): `useListKeys` listens on WINDOW and only skips
   * typing targets, so the j/k grammar's Enter fired from every focused button
   * and link — cancelling the seg button's own activation (preventDefault kills
   * the keydown's default click) and navigating to the selected run instead.
   * Verified live in s78 before the fix; these pin the guard.
   */
  it("Enter on the filter seg operates the FILTER, and never opens a run", async () => {
    seedFeed();
    const user = userEvent.setup();
    render(<Runs />);
    await screen.findByText("Failed", { selector: ".pill-err" });

    const failedOption = screen.getByRole("button", { name: "Failed" });
    failedOption.focus();
    await user.keyboard("{Enter}");

    expect(push).not.toHaveBeenCalled();
    await waitFor(() => expect(failedOption).toHaveAttribute("aria-pressed", "true"));
    // The published run is filtered out; the failed one remains.
    expect(screen.getAllByRole("button", { name: /— (Failed|Published)$/ })).toHaveLength(1);
  });

  it("Enter on the published live-page link opens the page only — not Approve as well", async () => {
    seedFeed();
    const user = userEvent.setup();
    render(<Runs />);

    const live = await screen.findByRole("link", { name: /\/blog\/fixture-post ↗/ });
    live.focus();
    await user.keyboard("{Enter}");
    expect(push).not.toHaveBeenCalled();
  });

  it("the j/k grammar still opens the selected run when no control holds focus", async () => {
    seedFeed();
    const user = userEvent.setup();
    render(<Runs />);
    await screen.findByText("Failed", { selector: ".pill-err" });

    await user.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith(`/app/approve?run=${FAILED_ID}`);
  });

  /* The view knobs the founder asked to re-introduce (s77). */
  it("the platform filter and find narrow the rows, and an emptied view says the knob did it", async () => {
    seedFeed();
    const user = userEvent.setup();
    render(<Runs />);
    await screen.findByText("Failed", { selector: ".pill-err" });
    expect(screen.getAllByRole("button", { name: /— (Failed|Published)$/ })).toHaveLength(2);

    await user.type(screen.getByRole("searchbox", { name: "Find a run" }), "malformed shell");
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /— (Failed|Published)$/ })).toHaveLength(1),
    );

    await user.clear(screen.getByRole("searchbox", { name: "Find a run" }));
    await user.type(screen.getByRole("searchbox", { name: "Find a run" }), "nothing matches this");
    // "No runs yet" would be a lie — the operator's own knob emptied it.
    expect(await screen.findByText(/No runs match this view/)).toBeInTheDocument();
    expect(screen.queryByText(/No runs yet/)).not.toBeInTheDocument();
  });

  it("sorting oldest-first reverses the day groups", async () => {
    server.use(
      http.get("/api/runs", () =>
        HttpResponse.json({
          runs: [run(PUBLISHED_ID, TODAY_9AM), run(FAILED_ID, "2026-01-02T09:00:00.000Z")],
        }),
      ),
    );
    const user = userEvent.setup();
    render(<Runs />);
    await screen.findByText(/^Today · /);

    const headingsNow = screen.getAllByText(/July|January/).map((el) => el.textContent);
    await user.selectOptions(screen.getByRole("combobox", { name: "Sort order" }), "oldest");
    await waitFor(() => {
      const after = screen.getAllByText(/July|January/).map((el) => el.textContent);
      expect(after).toEqual([...headingsNow].reverse());
    });
  });

  it("a failed feed read is an alert with retry, never an empty history", async () => {
    server.use(http.get("/api/runs", () => HttpResponse.error()));
    render(<Runs />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Couldn’t read the runs/);
    expect(alert).toHaveTextContent(/read failure, not an empty history/);
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    // The unresolved count never fabricates a zero.
    expect(screen.getByText("– this week")).toBeInTheDocument();
  });

  it("an unreadable plan read leaves the Published view unresolved, not empty", async () => {
    server.use(
      http.get("/api/runs", () => HttpResponse.json({ runs: [run(PUBLISHED_ID, TODAY_9AM)] })),
      http.get("/api/app/plan", () => HttpResponse.error()),
    );
    const user = userEvent.setup();
    render(<Runs />);
    await screen.findByText("1 this week");

    await user.click(screen.getByRole("button", { name: "Published" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/unresolved, not empty/);
  });

  it("no runs at all reads as a first-run state, not a failure", async () => {
    server.use(http.get("/api/runs", () => HttpResponse.json({ runs: [] })));
    render(<Runs />);
    expect(await screen.findByText(/No runs yet/)).toBeInTheDocument();
  });

  it("the ?run= deep link lands selected on its row", async () => {
    seedFeed();
    window.history.replaceState({}, "", `/app/runs?run=${PUBLISHED_ID}`);
    render(<Runs />);
    const rows = await screen.findAllByRole("button", { name: /— (Failed|Published)$/ });
    // Feed order is newest-first; the deep-linked run is the second row.
    await waitFor(() => expect(rows[1].className).toContain("row sel"));
    const selected = rows[1];
    expect(within(selected).getByText("Published")).toBeInTheDocument();
    window.history.replaceState({}, "", "/app/runs");
  });
});
