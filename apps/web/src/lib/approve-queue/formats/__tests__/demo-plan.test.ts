import { describe, expect, it } from "vitest";
import { expectedDemoPlanBody, parseDemoPlanMeta, type DemoPlanDraftMeta } from "../demo-plan";

const VALID_META: DemoPlanDraftMeta = {
  steps: [
    { stepIndex: 0, action: "goto", target: "https://example.com", value: "", narration: "Open the docs search page." },
    { stepIndex: 1, action: "fill", target: "#search", value: "hello", narration: "Type a query." },
  ],
  crawlSourceId: "source-1",
  pageUrls: ["https://example.com"],
  captureStatus: "planned",
  captureRef: null,
  promptVersion: "storyboard.v1",
  brandProfileVersion: 2,
  platformProfileVersion: "brand-profile.v2",
};

describe("parseDemoPlanMeta", () => {
  it("parses a valid demo_plan meta shape", () => {
    expect(parseDemoPlanMeta(VALID_META)).toEqual(VALID_META);
  });

  it("tolerates unknown extra keys (B2.5 may only extend the pinned contract additively)", () => {
    expect(parseDemoPlanMeta({ ...VALID_META, futureField: "whatever" })).toEqual(VALID_META);
  });

  it("returns null for meta missing required fields", () => {
    expect(parseDemoPlanMeta({})).toBeNull();
  });

  it("returns null for a different format's meta", () => {
    expect(parseDemoPlanMeta({ hook: "x", captions: "y", platformCopy: "z" })).toBeNull();
  });

  it("accepts a captured run with a non-null captureRef", () => {
    const captured = { ...VALID_META, captureStatus: "captured" as const, captureRef: "object-store-key-1" };
    expect(parseDemoPlanMeta(captured)).toEqual(captured);
  });
});

describe("expectedDemoPlanBody", () => {
  it("joins every step's narration with \\n\\n — the pinned contract's body convention", () => {
    expect(expectedDemoPlanBody(VALID_META)).toBe("Open the docs search page.\n\nType a query.");
  });
});
