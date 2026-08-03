// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { ScheduleSurface } from "@/components/schedule/schedule-surface";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/schedule",
  useRouter: () => ({ push: () => {} }),
}));
import { resolveDraftCardMedia } from "@/lib/media/resolve";
import { server } from "@/lib/testing/server";
import { draftCardMedia } from "@/lib/workspace/plan";
import type { PipelineAsset, PlanPayload, PlannedSlotWire } from "@/lib/workspace/types";

/**
 * s96 — the Schedule S1–S3 deltas, pinned against the AMENDED sheet
 * (Schedule.dc.html s95; founder verdict "W3 is approved"): the chip's own
 * picture through SourceThumb with the platform badge riding it, the Aa mark
 * for a text-only post, the +N-more count-door over a capped run, and the
 * month mark's platform glyph.
 */

const SHA = "d".repeat(64);

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
    excerpt: "The pipeline thread",
    media: null,
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

const slot = (draftId: string, hour: number, minute = 0): PlannedSlotWire => ({
  draftId,
  platform: "linkedin",
  scheduledFor: today(hour, minute).toISOString(),
  note: null,
});

describe("S1 — the chip wears its draft's own picture, the platform as a badge on it", () => {
  it("a draft with attached media renders the real image; the platform words stay accessible", async () => {
    seed({
      plan: {
        plannedSlots: [slot("d-media", 9)],
        assets: [asset({ draftId: "d-media", media: { sha256: SHA, ext: "webp", alt: "the chart" } })],
      },
    });
    render(<ScheduleSurface />);
    const chip = await screen.findByRole("button", { name: /^Planned · LinkedIn/ });
    const img = chip.querySelector(".ev-media img") as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.src).toContain(`/api/media/${SHA}.webp`);
    // The badge rides the thumb — LinkedIn's mark, not a text token.
    expect(chip.querySelector(".ev-media .badge svg")).not.toBeNull();
  });

  it("a text-only draft keeps its slot with the Aa mark — absence is information", async () => {
    seed({
      plan: { plannedSlots: [slot("d-text", 9)], assets: [asset({ draftId: "d-text" })] },
    });
    render(<ScheduleSurface />);
    const chip = await screen.findByRole("button", { name: /^Planned · LinkedIn/ });
    expect(chip.querySelector(".ev-media.none .img")?.textContent).toBe("Aa");
    expect(chip.querySelector("img")).toBeNull();
  });
});

describe("S3 — a run caps at two chips; the remainder is a count with a door", () => {
  it("draws the +N more door and it opens the day (agenda density)", async () => {
    seed({
      plan: {
        plannedSlots: [slot("d1", 11), slot("d2", 11), slot("d3", 11), slot("d4", 11)],
        assets: [
          asset({ draftId: "d1" }),
          asset({ draftId: "d2" }),
          asset({ draftId: "d3" }),
          asset({ draftId: "d4" }),
        ],
      },
    });
    const user = userEvent.setup();
    const { container } = render(<ScheduleSurface />);
    await screen.findByText("4 planned");
    // Two chips visible, two behind the count — nothing hidden silently.
    expect(container.querySelectorAll(".ev-plan")).toHaveLength(2);
    const door = screen.getByRole("button", { name: /\+2 more at 11:00 · open day/ });
    await user.click(door);
    // The day opens as the agenda, where every one of the four renders as a row.
    expect(await screen.findByRole("button", { name: "Agenda", pressed: true })).toBeInTheDocument();
  });
});

describe("S2 — the month mark leads with kind colour and carries the platform glyph", () => {
  it("the mark wears the platform badge exactly as the week chips do", async () => {
    seed({
      plan: { plannedSlots: [slot("d-m", 9)], assets: [asset({ draftId: "d-m" })] },
    });
    const user = userEvent.setup();
    const { container } = render(<ScheduleSurface />);
    await screen.findByText("1 planned");
    await user.click(screen.getByRole("button", { name: "Month" }));
    const mark = container.querySelector(".mark-plan");
    expect(mark).not.toBeNull();
    expect(mark?.querySelector(".badge svg")).not.toBeNull();
  });
});

describe("the S1 wire — draftCardMedia · resolveDraftCardMedia", () => {
  it("reads the first attached IMAGE off meta.mediaRefs, both stored families, tolerantly", () => {
    expect(
      draftCardMedia({
        mediaRefs: [{ ref: `social-media/${SHA}.png`, contentType: "image/png", altText: "a chart" }],
      }),
    ).toEqual({ sha256: SHA, ext: "png", alt: "a chart" });
    expect(
      draftCardMedia({ mediaRefs: [{ ref: `media/${SHA}.webp`, contentType: "image/webp" }] }),
    ).toEqual({ sha256: SHA, ext: "webp", alt: null });
    // A video attachment must not pretend to be a still.
    expect(
      draftCardMedia({ mediaRefs: [{ ref: `social-media/${SHA}.mp4`, contentType: "video/mp4" }] }),
    ).toBeNull();
    // Malformed shapes are a text-only card, never a crash.
    expect(draftCardMedia({ mediaRefs: "not-an-array" })).toBeNull();
    expect(draftCardMedia({ mediaRefs: [{ ref: 42 }] })).toBeNull();
    expect(draftCardMedia(null)).toBeNull();
  });

  it("resolves through the workspace door with operator provenance; a bad ext is the empty box", () => {
    const resolved = resolveDraftCardMedia({ sha256: SHA, ext: "webp", alt: "the chart" });
    expect(resolved.state).toBe("resolved");
    if (resolved.state === "resolved") {
      expect(resolved.src).toBe(`/api/media/${SHA}.webp`);
      expect(resolved.envelope.provenance).toBe("operator");
      expect(resolved.envelope.alt).toBe("the chart");
    }
    expect(resolveDraftCardMedia({ sha256: SHA, ext: "exe", alt: null }).state).toBe("empty");
    expect(resolveDraftCardMedia(null).state).toBe("empty");
  });
});
