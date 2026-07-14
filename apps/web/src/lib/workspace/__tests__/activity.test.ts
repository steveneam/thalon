import { describe, expect, it } from "vitest";
import { describeActivity } from "@/lib/workspace/activity";
import { timeAgo, timeUntil } from "@/lib/workspace/format";
import type { ActivityItem } from "@/lib/workspace/types";

function item(event: string, entityType: string, payload: Record<string, unknown> = {}): ActivityItem {
  return { id: 1, event, entityType, entityId: "e-1", at: "2026-07-01T00:00:00.000Z", payload };
}

describe("describeActivity", () => {
  it("attributes engine work and routes to the entity's surface", () => {
    const view = describeActivity(item("trend_snapshot.captured", "trend_snapshot"));
    expect(view).toEqual({ summary: "Scout captured a trend snapshot", href: "/app/intel", tone: "engine" });
  });

  it("distinguishes operator actions from engine work on draft transitions", () => {
    expect(describeActivity(item("draft.transition", "draft", { to: "approved" })).tone).toBe("operator");
    expect(describeActivity(item("draft.transition", "draft", { to: "queued" })).tone).toBe("engine");
    expect(describeActivity(item("draft.transition", "draft", { to: "blocked" })).tone).toBe("alert");
  });

  it("marks failures as alerts and carries the recorded message", () => {
    const view = describeActivity(
      item("fanout_run.last_error_recorded", "fanout_run", { message: "gateway 400" }),
    );
    expect(view.tone).toBe("alert");
    expect(view.summary).toContain("gateway 400");
    expect(view.href).toBe("/app/runs");
  });

  it("credits operator-added vs engine-compiled keyword targets", () => {
    expect(
      describeActivity(item("search_target.created", "search_target", { keyword: "a", origin: "operator" })).tone,
    ).toBe("operator");
    expect(
      describeActivity(item("search_target.created", "search_target", { keyword: "a", origin: "profile_seed" })).tone,
    ).toBe("engine");
  });

  it("falls back to the raw event name for unmapped events — never hides activity", () => {
    const view = describeActivity(item("some_future.event", "widget"));
    expect(view.summary).toBe("some_future.event");
    expect(view.href).toBeNull();
  });

  it("deep-links draft events to the entity, not just the surface (recognition over recall)", () => {
    const view = describeActivity(item("draft.transition", "draft", { to: "queued" }));
    expect(view.href).toBe("/app/approve?draft=e-1");
  });
});

describe("timeAgo", () => {
  const now = Date.UTC(2026, 6, 6, 12, 0, 0);
  it("formats coarse relative buckets", () => {
    expect(timeAgo(new Date(now - 5_000).toISOString(), now)).toBe("just now");
    expect(timeAgo(new Date(now - 120_000).toISOString(), now)).toBe("2m ago");
    expect(timeAgo(new Date(now - 3 * 3_600_000).toISOString(), now)).toBe("3h ago");
    expect(timeAgo(new Date(now - 2 * 86_400_000).toISOString(), now)).toBe("2d ago");
  });
  it("never goes negative on clock skew", () => {
    expect(timeAgo(new Date(now + 60_000).toISOString(), now)).toBe("just now");
  });
});

describe("timeUntil", () => {
  const now = Date.UTC(2026, 6, 6, 12, 0, 0);
  it("formats coarse forward buckets — the critique-P1 fix: a future instant never reads 'just now'", () => {
    expect(timeUntil(new Date(now + 120_000).toISOString(), now)).toBe("in 2m");
    expect(timeUntil(new Date(now + 4 * 3_600_000).toISOString(), now)).toBe("in 4h");
    expect(timeUntil(new Date(now + 2 * 86_400_000).toISOString(), now)).toBe("in 2d");
  });
  it("reads 'now' for due or past instants", () => {
    expect(timeUntil(new Date(now).toISOString(), now)).toBe("now");
    expect(timeUntil(new Date(now - 60_000).toISOString(), now)).toBe("now");
  });
});
