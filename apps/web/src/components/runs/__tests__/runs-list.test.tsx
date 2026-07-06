// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { run } from "@/lib/approve-queue/fixtures";
import { server } from "@/lib/testing/server";
import { RunsList } from "@/components/runs/runs-list";

describe("RunsList", () => {
  it("surfaces lastError VERBATIM as the triage evidence, with the incomplete badge", async () => {
    const failing = {
      ...run("33333333-3333-3333-3333-333333333333", "2026-07-05T09:00:00.000Z", false),
      lastError: "IrrecoverableGenerationError: gateway 400 — malformed shell output",
    };
    server.use(
      http.get("/api/runs", () =>
        HttpResponse.json({ runs: [failing, run("44444444-4444-4444-4444-444444444444", "2026-07-04T09:00:00.000Z")] }),
      ),
    );

    render(<RunsList />);
    expect(
      await screen.findByText("IrrecoverableGenerationError: gateway 400 — malformed shell output"),
    ).toBeInTheDocument();
    expect(screen.getByText("incomplete")).toBeInTheDocument();
    // The healthy run renders without an alert row.
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("renders the tutorial empty state when no runs exist", async () => {
    server.use(http.get("/api/runs", () => HttpResponse.json({ runs: [] })));
    render(<RunsList />);
    expect(await screen.findByText(/no runs yet/i)).toBeInTheDocument();
  });
});
