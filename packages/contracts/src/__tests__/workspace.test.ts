import { describe, expect, it } from "vitest";
import {
  CAPTURE_KINDS,
  LEAD_STAGES,
  intelCaptureSchema,
  isLeadStage,
  plannedSlotSchema,
  savedViewPatchSchema,
  savedViewSchema,
} from "../index";

describe("Phase-I window contracts (s61)", () => {
  it("plannedSlotSchema demands a real draft uuid and a real instant", () => {
    const ok = plannedSlotSchema.parse({
      draftId: "8f14e45f-ceea-4a17-8f5e-2d5e9b2f3c4d",
      scheduledFor: "2026-07-21T09:30:00+10:00",
    });
    expect(ok.note).toBeUndefined();
    expect(() =>
      plannedSlotSchema.parse({ draftId: "not-a-uuid", scheduledFor: "2026-07-21T09:30:00Z" }),
    ).toThrow();
    expect(() =>
      plannedSlotSchema.parse({
        draftId: "8f14e45f-ceea-4a17-8f5e-2d5e9b2f3c4d",
        scheduledFor: "tomorrow-ish",
      }),
    ).toThrow();
  });

  it("savedViewSchema fills defaults; the PATCH schema fills NOTHING (the zod-4 .partial() trap, proven)", () => {
    const full = savedViewSchema.parse({ surface: "leads", name: "Hot" });
    expect(full.config).toEqual({});
    expect(full.position).toBe(0);
    // The explicit-partial shape: an empty patch stays empty — no default
    // re-fill, so an update can never silently reset config/position.
    expect(savedViewPatchSchema.parse({})).toEqual({});
    expect(() => savedViewSchema.parse({ surface: "dashboard", name: "x" })).toThrow();
    expect(() => savedViewSchema.parse({ surface: "leads", name: "" })).toThrow();
  });

  it("intelCaptureSchema enforces the closed kind set over an open payload", () => {
    const ok = intelCaptureSchema.parse({ kind: "lead_promote" });
    expect(ok.payload).toEqual({});
    expect(CAPTURE_KINDS).toContain("trend_dismiss");
    expect(() => intelCaptureSchema.parse({ kind: "made_up" })).toThrow();
  });

  it("LEAD_STAGES is the operator vocabulary, disjoint from the engine lifecycle", () => {
    expect(isLeadStage("qualified")).toBe(true);
    expect(isLeadStage("scored")).toBe(false); // engine status, never a stage
    expect(LEAD_STAGES).toHaveLength(5);
  });
});
