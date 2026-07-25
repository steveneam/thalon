// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
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

    const rows = screen.getAllByRole("button", { name: /^Fan-out · / });
    expect(rows[0].className).toContain("row sel");
    await user.keyboard("j");
    await waitFor(() => expect(rows[1].className).toContain("row sel"));
    expect(rows[0].className).not.toContain("sel");

    await user.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith(`/app/approve?run=${PUBLISHED_ID}`);
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
    const rows = await screen.findAllByRole("button", { name: /^Fan-out · / });
    // Feed order is newest-first; the deep-linked run is the second row.
    await waitFor(() => expect(rows[1].className).toContain("row sel"));
    const selected = rows[1];
    expect(within(selected).getByText("Published")).toBeInTheDocument();
    window.history.replaceState({}, "", "/app/runs");
  });
});
