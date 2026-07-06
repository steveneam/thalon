// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { PulseProvider } from "@/components/workspace/pulse-context";
import { server } from "@/lib/testing/server";
import { ApproveQueue } from "../approve-queue";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/approve",
}));

const ZERO_PULSE = {
  tenant: { slug: "self", name: "Thalon" },
  profile: { version: 1, company: "Thalon" },
  counts: { runs: 2, runsWithErrors: 0, drafts: 3, queued: 0, blocked: 0, approved: 3 },
  needsYou: 0,
};

describe("ApproveQueue — zero-inbox state (B6.2 [+])", () => {
  it("celebrates inbox zero when the pulse says nothing waits anywhere", async () => {
    server.use(http.get("/api/app/pulse", () => HttpResponse.json(ZERO_PULSE)));
    render(
      <PulseProvider>
        <ApproveQueue />
      </PulseProvider>,
    );
    expect(await screen.findByText("Inbox zero.")).toBeInTheDocument();
  });

  it("stays quiet while drafts wait (fixture pulse has needs-you 3)", async () => {
    render(
      <PulseProvider>
        <ApproveQueue />
      </PulseProvider>,
    );
    // Wait for the feed to settle, then assert the banner never showed.
    await screen.findByRole("region", { name: "Fan-out run feed" });
    expect(screen.queryByText("Inbox zero.")).not.toBeInTheDocument();
  });

  it("renders no banner outside the shell (no pulse provider)", async () => {
    render(<ApproveQueue />);
    await screen.findByRole("region", { name: "Fan-out run feed" });
    expect(screen.queryByText("Inbox zero.")).not.toBeInTheDocument();
  });
});
