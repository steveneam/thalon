// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { ScheduleSurface } from "@/components/schedule/schedule-surface";
import { queueEvents } from "@/components/schedule/schedule-model";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/schedule",
  useRouter: () => ({ push: () => {} }),
}));
import { server } from "@/lib/testing/server";
import type { PipelineAsset, PlanPayload, PlannedSlotWire } from "@/lib/workspace/types";

function today(hour: number, minute = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

function asset(overrides: Partial<PipelineAsset> & { draftId: string }): PipelineAsset {
  return {
    runId: "run-1",
    platform: "linkedin",
    format: "post",
    status: "approved",
    sourceKind: "url",
    capturedAt: null,
    generatedAt: new Date(Date.now() - 30 * 3_600_000).toISOString(),
    judgedAt: null,
    decidedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
    publishedAt: null,
    gates: [],
    reasons: [],
    deployRef: null,
    excerpt: "The pipeline thread — what deterministic video changes",
    ...overrides,
  };
}

function queueRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "q1",
    draftId: "d-queued",
    platform: "linkedin",
    scheduledAt: today(14, 0).toISOString(),
    status: "pending",
    lastError: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function seed(opts: { plan?: Partial<PlanPayload>; rows?: unknown[] } = {}) {
  const plan: PlanPayload = {
    sweep: null,
    areas: 0,
    cadence: [],
    assets: [],
    plannedSlots: [],
    ...opts.plan,
  };
  server.use(
    http.get("/api/app/plan", () => HttpResponse.json(plan)),
    http.get("/api/social/queue", () => HttpResponse.json({ rows: opts.rows ?? [] })),
  );
}

const PLAN_SLOT: PlannedSlotWire = {
  draftId: "d-plan",
  platform: "linkedin",
  scheduledFor: today(9, 30).toISOString(),
  note: "pipeline thread",
};

/**
 * C4 (s82) — THE CALENDAR'S ONE HARD JOB HERE: say which is which. A
 * planned slot is the operator thinking "Tuesday-ish"; a queue row is a
 * commitment with an idempotency key behind it. If these two ever render
 * the same, the surface is lying about what will happen.
 */
describe("queueEvents (the model)", () => {
  const assets = [asset({ draftId: "d-queued" })];

  it("draws LIVE rows only — a cancelled or failed row is history, not a future instant", () => {
    const events = queueEvents(
      [
        queueRow({ id: "a", status: "pending" }),
        queueRow({ id: "b", status: "processing" }),
        queueRow({ id: "c", status: "cancelled" }),
        queueRow({ id: "d", status: "failed" }),
        queueRow({ id: "e", status: "published" }),
      ] as never,
      assets,
    );
    expect(events.map((e) => e.queueRowId)).toEqual(["a", "b"]);
    expect(events.every((e) => e.kind === "queued")).toBe(true);
  });

  it("says COMMITTED and names the disarmed publisher — never 'planned'", () => {
    const [event] = queueEvents([queueRow()] as never, assets);
    expect(event.lead).toBe("Scheduled · LinkedIn");
    expect(event.meta).toContain("committed — the publisher is disarmed");
    expect(event.meta).not.toContain("Planned");
  });

  it("a row being published right now says so", () => {
    const [event] = queueEvents([queueRow({ status: "processing" })] as never, assets);
    expect(event.meta).toContain("publishing now");
  });

  it("a row whose draft has aged out of the feed still renders — the commitment is the fact", () => {
    const [event] = queueEvents([queueRow()] as never, []);
    expect(event.href).toBeNull();
    expect(event.excerpt).toBe("");
    expect(event.lead).toBe("Scheduled · LinkedIn");
  });

  it("a row with no instant is not placed on a grid that has no place for it", () => {
    expect(queueEvents([queueRow({ scheduledAt: null })] as never, assets)).toEqual([]);
  });
});

describe("the calendar's scheduled state", () => {
  it("draws a plan and a commitment as DIFFERENT things", async () => {
    seed({
      plan: { plannedSlots: [PLAN_SLOT], assets: [asset({ draftId: "d-plan" }), asset({ draftId: "d-queued" })] },
      rows: [queueRow()],
    });
    const { container } = render(<ScheduleSurface />);

    await screen.findByText("1 planned");
    expect(await screen.findByText("1 scheduled")).toBeInTheDocument();

    // Structurally distinct, not just differently worded: a plan is dashed
    // and gripped, a commitment is solid and carries no grip.
    const plan = container.querySelector(".ev-plan");
    const queued = container.querySelector(".ev-queued");
    expect(plan).not.toBeNull();
    expect(queued).not.toBeNull();
    expect(plan?.querySelector(".grip")).not.toBeNull();
    expect(queued?.querySelector(".grip")).toBeNull();
    expect(queued?.textContent).toContain("Scheduled · LinkedIn");
  });

  it("the footer explains the two, and only once there is a commitment to explain", async () => {
    seed({ plan: { plannedSlots: [PLAN_SLOT], assets: [asset({ draftId: "d-plan" })] } });
    render(<ScheduleSurface />);
    await screen.findByText("1 planned");
    // Resting copy is the sheet's own, unchanged, while nothing is committed.
    expect(screen.getByText(/Plans, not uploads/)).toBeInTheDocument();
    expect(screen.queryByText(/1 scheduled/)).not.toBeInTheDocument();
  });

  it("names the distinction in the footer once something IS committed", async () => {
    seed({ plan: { assets: [asset({ draftId: "d-queued" })] }, rows: [queueRow()] });
    render(<ScheduleSurface />);
    await screen.findByText("1 scheduled");
    expect(screen.getByText(/Dashed is a plan \(an intention\); solid is scheduled/)).toBeInTheDocument();
    expect(screen.getByText(/Neither has published/)).toBeInTheDocument();
  });

  it("a queue read failure leaves the week intact — plans are true either way", async () => {
    server.use(
      http.get("/api/app/plan", () =>
        HttpResponse.json({
          sweep: null,
          areas: 0,
          cadence: [],
          assets: [asset({ draftId: "d-plan" })],
          plannedSlots: [PLAN_SLOT],
        }),
      ),
      http.get("/api/social/queue", () => HttpResponse.json({ error: "down" }, { status: 500 })),
    );
    render(<ScheduleSurface />);
    // The surface is NOT in its error state, and the plan still renders.
    expect(await screen.findByText("1 planned")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("withdraws a commitment through the queue door — cancel, never drag", async () => {
    seed({ plan: { assets: [asset({ draftId: "d-queued" })] }, rows: [queueRow()] });
    let cancelled = "";
    server.use(
      http.delete("/api/social/queue", ({ request }) => {
        cancelled = new URL(request.url).searchParams.get("id") ?? "";
        return HttpResponse.json({ row: queueRow({ status: "cancelled" }) });
      }),
    );
    const { container } = render(<ScheduleSurface />);
    await screen.findByText("1 scheduled");

    await userEvent.click(container.querySelector(".ev-queued") as HTMLElement);
    const popover = await screen.findByRole("dialog");
    // A commitment's footer never claims it is a mere record, nor a plan.
    expect(within(popover).getByText(/a commitment, not a publish/)).toBeInTheDocument();
    expect(within(popover).queryByRole("button", { name: "Reschedule" })).not.toBeInTheDocument();

    await userEvent.click(within(popover).getByRole("button", { name: "Cancel schedule" }));
    // Named confirm before a commitment is withdrawn.
    expect(within(popover).getByText(/The draft stays approved/)).toBeInTheDocument();
    await userEvent.click(within(popover).getByRole("button", { name: "Cancel it" }));
    await waitFor(() => expect(cancelled).toBe("q1"));
  });
});
