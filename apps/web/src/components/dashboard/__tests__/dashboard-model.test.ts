import { describe, expect, it } from "vitest";
import {
  composingCount,
  needsYouRows,
  oldestWaitHours,
  platformLabel,
  publishedRows,
  slotsInWeek,
  thumbLabel,
} from "@/components/dashboard/dashboard-model";
import { weekDays } from "@/lib/workspace/week";
import type { PipelineAsset, PlannedSlotWire } from "@/lib/workspace/types";

const NOW = new Date("2026-07-24T12:00:00Z"); // a Friday

function asset(overrides: Partial<PipelineAsset> & { draftId: string }): PipelineAsset {
  return {
    runId: "run-1",
    platform: "linkedin",
    format: null,
    status: "queued",
    sourceKind: null,
    capturedAt: null,
    generatedAt: "2026-07-24T10:00:00Z",
    judgedAt: "2026-07-24T10:00:00Z",
    decidedAt: null,
    publishedAt: null,
    gates: [],
    reasons: [],
    deployRef: null,
    excerpt: "Our launch video has no editor file.",
    media: null,
    ...overrides,
  };
}

describe("dashboard model (the sheet's numbers, honestly derived)", () => {
  it("composing = at the judge gate: no verdict for the current body, not decided", () => {
    expect(
      composingCount([
        asset({ draftId: "a", judgedAt: null }),
        asset({ draftId: "b" }), // judged → queued, not composing
        asset({ draftId: "c", judgedAt: null, status: "approved" }), // decided → not composing
      ]),
    ).toBe(1);
  });

  it("oldest wait is whole hours since the oldest waiting draft — null when nothing waits", () => {
    expect(oldestWaitHours([], NOW)).toBeNull();
    expect(
      oldestWaitHours(
        [
          asset({ draftId: "a", judgedAt: "2026-07-23T10:00:00Z" }), // 26h
          asset({ draftId: "b", judgedAt: "2026-07-24T10:00:00Z", status: "blocked" }),
          asset({ draftId: "c", status: "approved", judgedAt: "2026-07-20T10:00:00Z" }), // decided — not waiting
        ],
        NOW,
      ),
    ).toBe(26);
  });

  it("needs-you rows come OLDEST FIRST; blocked rows carry the judge's first reason", () => {
    const rows = needsYouRows([
      asset({ draftId: "young", judgedAt: "2026-07-24T11:00:00Z" }),
      asset({
        draftId: "blocked",
        platform: "x",
        status: "blocked",
        judgedAt: "2026-07-24T09:00:00Z",
        reasons: ["Grounding — final: no provided source supports this claim."],
      }),
      asset({ draftId: "old", judgedAt: "2026-07-23T10:00:00Z", format: "clip_plan" }),
    ]);
    expect(rows.map((r) => r.draftId)).toEqual(["old", "blocked", "young"]);
    expect(rows[0].thumb).toBe("clip frame"); // media-first: clip formats show the frame placeholder
    expect(rows[1].lead).toBe("Blocked by the judge · X post");
    expect(rows[1].reason).toContain("no provided source");
    expect(rows[2].thumb).toBeNull(); // text post — the sheet draws no thumb
    expect(rows[0].href).toContain("/app/approve?run=");
  });

  it("published rows are newest first, bounded to three, honest about a missing live link", () => {
    const rows = publishedRows([
      asset({ draftId: "p1", status: "published", publishedAt: "2026-07-20T00:00:00Z" }),
      asset({
        draftId: "p2",
        platform: "web",
        status: "published",
        publishedAt: "2026-07-23T00:00:00Z",
        deployRef: "/blog/post",
      }),
      asset({ draftId: "p3", status: "published", publishedAt: "2026-07-21T00:00:00Z" }),
      asset({ draftId: "p4", status: "published", publishedAt: "2026-07-19T00:00:00Z" }),
      asset({ draftId: "unpublished" }),
    ]);
    expect(rows.map((r) => r.draftId)).toEqual(["p2", "p3", "p1"]);
    expect(rows[0].liveHref).toBe("/blog/post");
    expect(rows[0].title.startsWith("Blog · ")).toBe(true);
    expect(rows[1].liveHref).toBeNull();
  });

  it("slots bucket into the visible local week only", () => {
    const days = weekDays(NOW); // Mon 20 – Sun 26 July
    const slots: PlannedSlotWire[] = [
      { draftId: "in", platform: "facebook", scheduledFor: "2026-07-25T18:00:00Z", note: null },
      { draftId: "out", platform: "x", scheduledFor: "2026-08-02T11:00:00Z", note: null },
    ];
    expect(slotsInWeek(slots, days).map((s) => s.draftId)).toEqual(["in"]);
  });

  it("platform + thumb labels speak the sheet's grammar", () => {
    expect(platformLabel("linkedin")).toBe("LinkedIn");
    expect(platformLabel("x")).toBe("X");
    expect(platformLabel("web")).toBe("Blog");
    expect(platformLabel("facebook")).toBe("Facebook");
    expect(thumbLabel({ format: "web_page", platform: "web" })).toBe("page hero");
    expect(thumbLabel({ format: "image_post", platform: "facebook" })).toBe("post image");
    expect(thumbLabel({ format: null, platform: "x" })).toBeNull();
  });
});
