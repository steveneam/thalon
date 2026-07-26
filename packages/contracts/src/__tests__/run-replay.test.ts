import { describe, expect, it } from "vitest";
import { runReplayRequestSchema, runReplayResultSchema } from "../index";

describe("fan-out replay contract", () => {
  /**
   * The money invariant. A partial fan-out is the common failure — three
   * platforms, two drafted, one died — and a replay that defaults to the
   * whole set re-spends generation credits on drafts that already exist.
   */
  it("defaults to failed_only, so an unset scope never re-spends on what already succeeded", () => {
    expect(runReplayRequestSchema.parse({ runId: "run-1" }).scope).toBe("failed_only");
  });

  it("takes the wide re-run only when it is asked for by name", () => {
    expect(runReplayRequestSchema.parse({ runId: "run-1", scope: "all" }).scope).toBe("all");
    expect(runReplayRequestSchema.safeParse({ runId: "run-1", scope: "everything" }).success).toBe(false);
  });

  it("refuses a replay with no run to replay", () => {
    expect(runReplayRequestSchema.safeParse({}).success).toBe(false);
    expect(runReplayRequestSchema.safeParse({ runId: "" }).success).toBe(false);
  });

  /** A replay is a NEW run and says which one it came from — history stays append-only. */
  it("names both the new run and its lineage", () => {
    const result = runReplayResultSchema.parse({
      replayRunId: "run-2",
      replayedFromRunId: "run-1",
      scope: "failed_only",
      platforms: ["x"],
      skipped: [{ platform: "linkedin", reason: "already_succeeded" }],
    });
    expect(result.replayRunId).not.toBe(result.replayedFromRunId);
    expect(result.skipped[0]).toEqual({ platform: "linkedin", reason: "already_succeeded" });
  });

  it("requires a stated reason for every skip rather than leaving it inferred from a count", () => {
    expect(
      runReplayResultSchema.safeParse({
        replayRunId: "run-2",
        replayedFromRunId: "run-1",
        scope: "failed_only",
        platforms: ["x"],
        skipped: [{ platform: "linkedin" }],
      }).success,
    ).toBe(false);
    expect(
      runReplayResultSchema.safeParse({
        replayRunId: "run-2",
        replayedFromRunId: "run-1",
        scope: "failed_only",
        platforms: ["x"],
        skipped: [{ platform: "linkedin", reason: "changed_my_mind" }],
      }).success,
    ).toBe(false);
  });

  it("defaults skipped to empty — a full replay legitimately skips nothing", () => {
    const result = runReplayResultSchema.parse({
      replayRunId: "run-2",
      replayedFromRunId: "run-1",
      scope: "all",
      platforms: ["x", "linkedin"],
    });
    expect(result.skipped).toEqual([]);
  });
});
