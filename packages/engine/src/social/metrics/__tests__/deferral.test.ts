import { describe, expect, it } from "vitest";
import { STANDING_METRICS_DEFERRALS } from "../deferral";
import { SocialMetricsDeferredError } from "../errors";
import {
  createFakeSocialMetricsReader,
  isRefusingSocialMetricsReader,
  resolveSocialMetricsReader,
} from "../registry";

/**
 * The founder's standing deferral, made structural. These tests PIN the
 * ruling: they are part of the diff that lifts it — deleting the `x` entry
 * from deferral.ts makes them fail by name, which is exactly the
 * founder-visible act lifting is supposed to be.
 */

describe("STANDING_METRICS_DEFERRALS (the ruling's seat)", () => {
  it("names exactly X — the s87 ruling, and nothing has quietly joined it", () => {
    expect(Object.keys(STANDING_METRICS_DEFERRALS)).toEqual(["x"]);
  });

  it("carries the ruling verbatim, so every consumer prints the founder's own words", () => {
    expect(STANDING_METRICS_DEFERRALS.x).toContain(
      "X analytics and posting bill will only be paid once thalon is ready to launch",
    );
  });
});

describe("resolveSocialMetricsReader under a standing deferral", () => {
  it("refuses X BEFORE the credential and BEFORE the factory — a perfect token and an assembled reader change nothing", async () => {
    let factoryCalls = 0;
    const reader = resolveSocialMetricsReader(
      "x",
      { SOCIAL_X_ACCESS_TOKEN: "a-perfectly-good-token" },
      {
        x: () => {
          factoryCalls += 1;
          return createFakeSocialMetricsReader({ platform: "x" });
        },
      },
    );

    expect(isRefusingSocialMetricsReader(reader)).toBe(true);
    if (!isRefusingSocialMetricsReader(reader)) throw new Error("unreachable");
    expect(reader.refusal).toBeInstanceOf(SocialMetricsDeferredError);
    expect(reader.refusal.permanence).toBe("deferred");
    expect(reader.refusal.refusal).toBe("deferred_on_cost");
    // The refusal names the RULING — never the credential, which is not the
    // problem and must not be "fixed".
    expect(reader.refusal.message).toContain("only be paid once thalon is ready to launch");
    expect(reader.refusal.message).not.toContain("SOCIAL_X_ACCESS_TOKEN");
    // The factory was never consulted: no reader exists to spend anything.
    expect(factoryCalls).toBe(0);
    await expect(reader.fetchPostMetrics({ externalPostId: "1" })).rejects.toThrow(
      SocialMetricsDeferredError,
    );
  });

  it("refuses X even with NO credential — the deferral outranks the missing-credential complaint", () => {
    const reader = resolveSocialMetricsReader("x", {}, {});
    expect(isRefusingSocialMetricsReader(reader)).toBe(true);
    if (!isRefusingSocialMetricsReader(reader)) throw new Error("unreachable");
    expect(reader.refusal).toBeInstanceOf(SocialMetricsDeferredError);
  });

  it("defers ONLY X — every other platform's resolution is untouched", () => {
    const reader = resolveSocialMetricsReader(
      "bluesky",
      { SOCIAL_BLUESKY_ACCESS_TOKEN: "app-password" },
      { bluesky: () => createFakeSocialMetricsReader({ platform: "bluesky" }) },
    );
    expect(isRefusingSocialMetricsReader(reader)).toBe(false);
  });
});
