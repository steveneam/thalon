import { describe, expect, it } from "vitest";
import {
  areaExpansionConfigSchema,
  expandArea,
  expandAreas,
  mergeQueries,
  sweepAreaSchema,
} from "../area-expansion";

const AREA = {
  id: "area-1",
  name: "AI video tooling",
  description:
    'New "HTML to video" frameworks. Deterministic render pipelines, faceless channel automation; and more.',
};

describe("expandArea (B6.4 candidate generation — deterministic, rationed)", () => {
  it("expands name → quoted phrases → clause keywords, in that priority order", () => {
    const result = expandArea(AREA, { maxQueriesPerSweep: 10 });
    expect(result.queries).toEqual([
      "AI video tooling", // the area name always leads
      "HTML to video", // operator-quoted phrase, verbatim
      "New frameworks", // clause remainder after the quote is lifted — short clauses stay verbatim
      "Deterministic render pipelines",
      "faceless channel automation",
      // "and more" is stopword-only — dropped, never a wasted search
    ]);
    expect(result.droppedQueries).toBe(0);
    expect(result.areaId).toBe("area-1");
    expect(result.areaName).toBe("AI video tooling");
  });

  it("is deterministic — same area + config, same queries, always", () => {
    expect(expandArea(AREA)).toEqual(expandArea(AREA));
  });

  it("rations to the tenant default and reports what was cut — never silent", () => {
    const result = expandArea(AREA); // default maxQueriesPerSweep = 4
    expect(result.queries).toHaveLength(4);
    expect(result.droppedQueries).toBe(1);
  });

  it("per-area config.maxQueriesPerSweep overrides the tenant default", () => {
    const result = expandArea(
      { ...AREA, config: { maxQueriesPerSweep: 1 } },
      { maxQueriesPerSweep: 10 },
    );
    expect(result.queries).toEqual(["AI video tooling"]); // the name survives any ration ≥ 1
    expect(result.droppedQueries).toBe(4);
  });

  it("collapses a long clause to its first significant words — search APIs match phrases, not paragraphs", () => {
    const result = expandArea(
      {
        id: "a",
        name: "growth",
        description:
          "We are tracking all of the new AI video generation tools that can automate faceless channels for creators.",
      },
      { maxQueriesPerSweep: 10 },
    );
    expect(result.queries).toEqual([
      "growth",
      "tracking AI video generation tools automate",
    ]);
  });

  it("dedups case-insensitively, first occurrence wins (the name repeated in the description is not a second query)", () => {
    const result = expandArea(
      { id: "a", name: "Faceless Channels", description: "faceless channels, retention editing" },
      { maxQueriesPerSweep: 10 },
    );
    expect(result.queries).toEqual(["Faceless Channels", "retention editing"]);
  });

  it("handles curly-quoted phrases and bullet-separated descriptions", () => {
    const result = expandArea(
      { id: "a", name: "hooks", description: "“cold open hooks” • pattern interrupts • loop endings" },
      { maxQueriesPerSweep: 10 },
    );
    expect(result.queries).toEqual([
      "hooks",
      "cold open hooks",
      "pattern interrupts",
      "loop endings",
    ]);
  });

  it("rejects empty name/description at the boundary — an area with no seed cannot expand", () => {
    expect(() => expandArea({ id: "a", name: "", description: "x" })).toThrow();
    expect(() => expandArea({ id: "a", name: "x", description: "" })).toThrow();
  });
});

describe("expandAreas", () => {
  it("skips paused areas entirely — no queries, no expansion record", () => {
    const result = expandAreas(
      [
        { id: "a1", name: "alpha topic", description: "alpha things" },
        { id: "a2", name: "beta topic", description: "beta things", status: "paused" },
      ],
      { maxQueriesPerSweep: 10 },
    );
    expect(result.expansions.map((e) => e.areaId)).toEqual(["a1"]);
    expect(result.queries).toEqual(["alpha topic", "alpha things"]);
  });

  it("merges queries across areas with case-insensitive first-occurrence dedup", () => {
    const result = expandAreas(
      [
        { id: "a1", name: "AI video", description: "faceless channels" },
        { id: "a2", name: "Shorts", description: "Faceless Channels, retention" },
      ],
      { maxQueriesPerSweep: 10 },
    );
    expect(result.queries).toEqual(["AI video", "faceless channels", "Shorts", "retention"]);
  });

  it("parses monitored_areas repo rows directly (extra row columns are stripped, config validates)", () => {
    const row = {
      id: "5f0f8f9a-0000-0000-0000-000000000000",
      tenantId: "t-1",
      name: "AI video",
      description: "render pipelines",
      config: { maxQueriesPerSweep: 2, weights: { relevance: 2 } },
      status: "active",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
    const area = sweepAreaSchema.parse(row);
    expect(area.config.maxQueriesPerSweep).toBe(2);
    expect(area.config.weights).toEqual({ relevance: 2 });
    expect(expandAreas([row]).expansions).toHaveLength(1);
  });
});

describe("mergeQueries / config", () => {
  it("mergeQueries preserves first-occurrence order and drops empties", () => {
    expect(mergeQueries(["b", "", "A", "a", "b", "c"])).toEqual(["b", "A", "c"]);
  });

  it("the ration default is config with a positive-int floor", () => {
    expect(areaExpansionConfigSchema.parse({})).toEqual({ maxQueriesPerSweep: 4 });
    expect(() => areaExpansionConfigSchema.parse({ maxQueriesPerSweep: 0 })).toThrow();
  });
});
