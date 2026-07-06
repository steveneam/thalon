import { describe, expect, it } from "vitest";
import {
  monitoredAreaConfigSchema,
  monitoredAreaSchema,
  rankerWeightsSchema,
} from "../intel";

describe("monitored-area config schemas (B6.4)", () => {
  it("ranker weights default every signal to 1 and reject negatives", () => {
    expect(rankerWeightsSchema.parse({})).toEqual({
      relevance: 1,
      engagement: 1,
      velocity: 1,
      freshness: 1,
    });
    expect(rankerWeightsSchema.safeParse({ relevance: -0.5 }).success).toBe(false);
    // Zero is a legal weight — "turn this signal off" is config, not an error.
    expect(rankerWeightsSchema.parse({ engagement: 0 }).engagement).toBe(0);
  });

  it("area config: everything optional, partial weight overrides allowed, query ration must be a positive int", () => {
    expect(monitoredAreaConfigSchema.parse({})).toEqual({});
    const parsed = monitoredAreaConfigSchema.parse({
      weights: { velocity: 3 },
      maxQueriesPerSweep: 2,
    });
    expect(parsed.weights).toEqual({ velocity: 3 }); // partial — unset signals keep tenant defaults
    expect(monitoredAreaConfigSchema.safeParse({ maxQueriesPerSweep: 0 }).success).toBe(false);
    expect(monitoredAreaConfigSchema.safeParse({ maxQueriesPerSweep: 1.5 }).success).toBe(false);
  });

  it("an area needs a name and a non-empty description — the description is load-bearing data", () => {
    const area = monitoredAreaSchema.parse({
      name: "agentic coding",
      description: "AI coding agents and harnesses",
    });
    expect(area.config).toEqual({});
    expect(monitoredAreaSchema.safeParse({ name: "x", description: "" }).success).toBe(false);
    expect(monitoredAreaSchema.safeParse({ name: "", description: "y" }).success).toBe(false);
  });
});
