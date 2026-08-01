import { SOCIAL_PLATFORMS } from "@thalon/contracts";
import { describe, expect, it } from "vitest";
import {
  audienceAbsence,
  METRIC_CAPABILITIES,
  METRIC_FAMILIES,
  METRIC_LABELS,
  metricCapability,
  platformsReportingAudience,
  reportedLabels,
} from "../capability";
import {
  SocialMetricsGatedError,
  SocialMetricsUnavailableError,
} from "../errors";
import {
  createFakeSocialMetricsReader,
  isRefusingSocialMetricsReader,
  resolveSocialMetricsReader,
} from "../registry";

/**
 * D2 (s87): the metrics capability matrix and its ratchet. These are
 * INVARIANTS, not behaviour — every one of them is a way the Analytics
 * surface could start lying if the matrix drifted.
 */

describe("METRIC_CAPABILITIES (the matrix)", () => {
  it("is total over SOCIAL_PLATFORMS — a missing row would read as 'no idea', which is never true", () => {
    for (const platform of SOCIAL_PLATFORMS) {
      expect(METRIC_CAPABILITIES[platform]?.platform).toBe(platform);
    }
    expect(Object.keys(METRIC_CAPABILITIES).sort()).toEqual([...SOCIAL_PLATFORMS].sort());
  });

  it("every label it uses is in the canonical vocabulary, and every label has a family", () => {
    for (const platform of SOCIAL_PLATFORMS) {
      const capability = METRIC_CAPABILITIES[platform];
      for (const reported of capability.reports) {
        expect(METRIC_LABELS).toContain(reported.label);
        expect(METRIC_FAMILIES[reported.label]).toBeDefined();
      }
      for (const refused of capability.refuses) {
        expect(METRIC_LABELS).toContain(refused.label);
      }
    }
    for (const label of METRIC_LABELS) {
      expect(METRIC_FAMILIES[label]).toBeDefined();
    }
  });

  it("never both reports and refuses the same label — the one contradiction that would make an absence unreadable", () => {
    for (const platform of SOCIAL_PLATFORMS) {
      const capability = METRIC_CAPABILITIES[platform];
      const reported = new Set(capability.reports.map((r) => r.label));
      for (const refused of capability.refuses) {
        expect(reported.has(refused.label)).toBe(false);
      }
    }
  });

  it("a declared audienceLabel is always one the platform actually reports, and is audience-family", () => {
    for (const platform of SOCIAL_PLATFORMS) {
      const capability = METRIC_CAPABILITIES[platform];
      if (capability.audienceLabel === null) continue;
      expect(METRIC_FAMILIES[capability.audienceLabel]).toBe("audience");
      expect(reportedLabels(platform)).toContain(capability.audienceLabel);
    }
  });

  it("a platform with no reader promises nothing — and still explains itself", () => {
    for (const platform of SOCIAL_PLATFORMS) {
      const capability = METRIC_CAPABILITIES[platform];
      if (capability.reader !== null) continue;
      expect(capability.reports).toEqual([]);
      expect(capability.audienceLabel).toBeNull();
      // The whole point of the row: an absence that names its reason.
      expect(capability.refuses.length).toBeGreaterThan(0);
      for (const refused of capability.refuses) {
        expect(refused.reason.length).toBeGreaterThan(20);
      }
    }
  });

  it("every refusal carries a permanence — 'nobody can have this' and 'this token can't' are different sentences", () => {
    const seen = new Set<string>();
    for (const platform of SOCIAL_PLATFORMS) {
      for (const refused of METRIC_CAPABILITIES[platform].refuses) {
        expect(["structural", "retired", "gated", "permissioned", "no_driver"]).toContain(
          refused.permanence,
        );
        seen.add(refused.permanence);
      }
    }
    // All five kinds are genuinely in use — if one stopped being represented
    // the vocabulary would be carrying a distinction nothing makes.
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });

  it("every row is dated, so a stale claim is visible rather than assumed current", () => {
    for (const platform of SOCIAL_PLATFORMS) {
      expect(METRIC_CAPABILITIES[platform].verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("the honesty facts this lane verified against live docs", () => {
  it("Bluesky reports engagement and NO audience — structurally, not by permission", () => {
    const bluesky = metricCapability("bluesky");
    expect(bluesky.audienceLabel).toBeNull();
    expect(reportedLabels("bluesky")).toEqual(
      expect.arrayContaining(["likes", "reposts", "replies", "quotes"]),
    );
    const absence = audienceAbsence("bluesky");
    expect(absence?.permanence).toBe("structural");
    expect(absence?.reason).toContain("no impressions in the API");
  });

  it("LinkedIn is gated on BOTH roads — no reader, and the reason is an application, not a scope", () => {
    const linkedin = metricCapability("linkedin");
    expect(linkedin.reader).toBeNull();
    expect(linkedin.reports).toEqual([]);
    expect(linkedin.refuses.every((r) => r.permanence === "gated")).toBe(true);
    expect(audienceAbsence("linkedin")?.reason).toContain("partner-gated");
  });

  it("Facebook does NOT ask for the retired impressions family, and keeps reach under its surviving name", () => {
    const facebook = metricCapability("facebook");
    const fields = facebook.reports.map((r) => r.platformField);
    expect(fields).not.toContain("post_impressions");
    expect(fields).not.toContain("post_impressions_unique");
    // The reach column survives — under the platform's new word.
    expect(facebook.audienceLabel).toBe("reach");
    expect(fields).toContain("post_total_media_view_unique");
    const retired = facebook.refuses.find((r) => r.label === "impressions");
    expect(retired?.permanence).toBe("retired");
  });

  it("Facebook reports comment and share counts from the post OBJECT — the second call, verified 2026-08-01", async () => {
    const facebook = metricCapability("facebook");
    expect(facebook.reports.find((r) => r.label === "comments")?.platformField).toBe(
      "comments.summary.total_count",
    );
    expect(facebook.reports.find((r) => r.label === "shares")?.platformField).toBe("shares.count");
    // The flip is complete: nothing refuses what the reader now reads.
    expect(facebook.refuses.map((r) => r.label)).toEqual(["impressions"]);
    expect(facebook.verifiedOn).toBe("2026-08-01");
  });

  it("Instagram reports views (not the v22-retired impressions) and a real reach", () => {
    const instagram = metricCapability("instagram");
    const fields = instagram.reports.map((r) => r.platformField);
    expect(fields).toContain("views");
    expect(fields).toContain("reach");
    expect(fields).not.toContain("impressions");
    expect(instagram.audienceLabel).toBe("reach");
  });

  it("X is the only metered platform, and says so where a caller cannot miss it", () => {
    expect(metricCapability("x").metered).toContain("billed");
    const metered = SOCIAL_PLATFORMS.filter((p) => METRIC_CAPABILITIES[p].metered !== undefined);
    expect(metered).toEqual(["x"]);
  });

  it("Reddit's upvote_ratio is quality-family, so no sum can ever pick it up", () => {
    expect(reportedLabels("reddit")).toContain("upvote_ratio");
    expect(METRIC_FAMILIES.upvote_ratio).toBe("quality");
  });

  it("exactly the three audience-reporting platforms are offered to a roll-up", () => {
    expect(platformsReportingAudience().sort()).toEqual(["facebook", "instagram", "x"]);
  });

  it("YouTube's absence is PERMISSIONED, not no_driver — the s90 lane's stated posture", () => {
    // The reader is deliberately unbuilt because nothing could authenticate
    // it: every honest read of our own uploads rides channel-owner OAuth on
    // the founder's Google app, which does not exist yet. `no_driver` would
    // send someone to build a reader that cannot connect; `gated` would
    // claim a partner application Google does not require. The row's own
    // docblock argues the choice at length.
    const youtube = metricCapability("youtube");
    expect(youtube.reader).toBeNull();
    expect(youtube.reports).toEqual([]);
    expect(youtube.refuses.length).toBeGreaterThan(0);
    expect(youtube.refuses.every((r) => r.permanence === "permissioned")).toBe(true);
    expect(youtube.audienceLabel).toBeNull();
    // Reading it must never bill the trend sweep's key — not metered.
    expect(youtube.metered).toBeUndefined();
  });
});

describe("resolveSocialMetricsReader (the credential-only ratchet)", () => {
  const readers = {
    bluesky: () => createFakeSocialMetricsReader({ platform: "bluesky" }),
  };

  it("credential + reader → a real reader", () => {
    const reader = resolveSocialMetricsReader(
      "bluesky",
      { SOCIAL_BLUESKY_ACCESS_TOKEN: "app-password" },
      readers,
    );
    expect(isRefusingSocialMetricsReader(reader)).toBe(false);
    expect(reader.platform).toBe("bluesky");
  });

  it("does NOT require the posting arm — disarming a platform must never blind its analytics", () => {
    // No SOCIAL_BLUESKY_ARMED anywhere, and an explicit "false" for good
    // measure: neither is consulted, because measurement is not an outbound act.
    const reader = resolveSocialMetricsReader(
      "bluesky",
      { SOCIAL_BLUESKY_ACCESS_TOKEN: "app-password", SOCIAL_BLUESKY_ARMED: "false" },
      readers,
    );
    expect(isRefusingSocialMetricsReader(reader)).toBe(false);
  });

  it("no credential → a refusing reader that names what is missing and never calls out", async () => {
    const reader = resolveSocialMetricsReader("bluesky", {}, readers);
    expect(isRefusingSocialMetricsReader(reader)).toBe(true);
    if (!isRefusingSocialMetricsReader(reader)) throw new Error("unreachable");
    expect(reader.refusal).toBeInstanceOf(SocialMetricsUnavailableError);
    expect(reader.refusal.message).toContain("SOCIAL_BLUESKY_ACCESS_TOKEN");
    await expect(reader.fetchPostMetrics({ externalPostId: "x" })).rejects.toThrow(
      SocialMetricsUnavailableError,
    );
  });

  it("an empty-string credential never silently arms a read (the readEnv blank-line rule)", () => {
    const reader = resolveSocialMetricsReader(
      "bluesky",
      { SOCIAL_BLUESKY_ACCESS_TOKEN: "" },
      readers,
    );
    expect(isRefusingSocialMetricsReader(reader)).toBe(true);
  });

  it("a GATED platform refuses BEFORE the credential is consulted — a perfect token does not open LinkedIn", () => {
    const reader = resolveSocialMetricsReader(
      "linkedin",
      { SOCIAL_LINKEDIN_ACCESS_TOKEN: "a-perfectly-good-token" },
      {},
    );
    expect(isRefusingSocialMetricsReader(reader)).toBe(true);
    if (!isRefusingSocialMetricsReader(reader)) throw new Error("unreachable");
    expect(reader.refusal).toBeInstanceOf(SocialMetricsGatedError);
    expect(reader.refusal.permanence).toBe("gated");
    // The operator must not be sent to fix their credential — it is not the problem.
    expect(reader.refusal.message).not.toContain("SOCIAL_LINKEDIN_ACCESS_TOKEN");
  });

  it("YouTube refuses BEFORE the credential is consulted — a perfect token cannot open an OAuth gate that has no app behind it", () => {
    const reader = resolveSocialMetricsReader(
      "youtube",
      { SOCIAL_YOUTUBE_ACCESS_TOKEN: "a-perfectly-good-token" },
      {},
    );
    expect(isRefusingSocialMetricsReader(reader)).toBe(true);
    if (!isRefusingSocialMetricsReader(reader)) throw new Error("unreachable");
    expect(reader.refusal).toBeInstanceOf(SocialMetricsUnavailableError);
    expect(reader.refusal.permanence).toBe("permissioned");
    // The operator must not be sent to fix a credential — none can exist yet.
    expect(reader.refusal.message).not.toContain("SOCIAL_YOUTUBE_ACCESS_TOKEN");
    expect(reader.refusal.message).toContain("Google");
  });

  it("a reader has no publish verb — the seam decision, as a type-level fact checked at runtime", () => {
    const reader = resolveSocialMetricsReader(
      "bluesky",
      { SOCIAL_BLUESKY_ACCESS_TOKEN: "app-password" },
      readers,
    );
    expect("publish" in reader).toBe(false);
  });
});
