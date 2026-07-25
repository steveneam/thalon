import { describe, expect, it } from "vitest";
import {
  admissionKnobOverridesSchema,
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

describe("admission knobs on area config (B-learn L0 window)", () => {
  it("admission overrides persist through the config parse instead of being stripped", () => {
    const parsed = monitoredAreaConfigSchema.parse({
      admission: { enabled: true, floors: { likes: 500 } },
    });
    expect(parsed.admission).toEqual({ enabled: true, floors: { likes: 500 } });
  });

  it("additivity: every pre-window config parses unchanged — admission is optional", () => {
    expect(monitoredAreaConfigSchema.parse({})).toEqual({});
    const preWindow = { weights: { velocity: 3 }, maxQueriesPerSweep: 2 };
    expect(monitoredAreaConfigSchema.parse(preWindow)).toEqual(preWindow);
  });

  it("overrides are explicit-optional, never `.partial()` of the defaulted knobs — an empty override sets NOTHING", () => {
    // The zod-4 trap: `.partial()` keeps `.default()`, which would fill unset
    // fields on parse and silently clobber the tenant default.
    expect(admissionKnobOverridesSchema.parse({})).toEqual({});
    const one = admissionKnobOverridesSchema.parse({ minBodyLength: 80 });
    expect(one).toEqual({ minBodyLength: 80 });
  });

  it("invalid knob values fail loud at the boundary — nothing stores", () => {
    expect(
      monitoredAreaConfigSchema.safeParse({ admission: { floors: { likes: -1 } } }).success,
    ).toBe(false);
    expect(
      monitoredAreaConfigSchema.safeParse({ admission: { velocityMultiple: 0 } }).success,
    ).toBe(false);
    expect(
      monitoredAreaConfigSchema.safeParse({ admission: { maxAdmissionsPerDay: 2.5 } }).success,
    ).toBe(false);
    // 0 admissions/day is legal config: watch the area but never admit.
    expect(
      admissionKnobOverridesSchema.parse({ maxAdmissionsPerDay: 0 }).maxAdmissionsPerDay,
    ).toBe(0);
  });
});
