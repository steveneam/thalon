import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runDiscoverabilityLens } from "../discoverability";

/**
 * Phase 2c pins: the discoverability lens is deterministic, honest about
 * WHY, and anchored on the founder's live correction — the golden pair in
 * eval/golden/discoverability-seed.jsonl runs HERE, so the founder-catch
 * that chartered this gate is an executable test, not a story.
 */

describe("runDiscoverabilityLens", () => {
  it("term matching is word-boundary + separator-insensitive; casing never matters", () => {
    const result = runDiscoverabilityLens({
      platform: "linkedin",
      targetTerms: ["AI", "model-agnostic"],
      body: "Ai systems built model agnostic win.\n\n#ai",
    });
    expect(result.verdict).toBe("pass");
    expect(result.coverage).toBe(1);
  });

  it("a missing primary entity fails loud with the reason spelled out", () => {
    const result = runDiscoverabilityLens({
      platform: "linkedin",
      targetTerms: ["AI", "framework"],
      body: "A framework for building things.\n\n#framework",
    });
    expect(result.verdict).toBe("fail");
    const primary = result.findings.find((f) => f.check === "primary_entity_in_body");
    expect(primary?.status).toBe("warn");
    expect(primary?.reason).toContain('"AI"');
    // "AI" must never match inside words like "maintain" — boundary honesty.
    expect(
      runDiscoverabilityLens({
        platform: "x",
        targetTerms: ["AI"],
        body: "We maintain quality. #ai",
      }).findings.find((f) => f.check === "primary_entity_in_body")?.status,
    ).toBe("warn");
  });

  it("hashtag expectation is per-platform: subject tag passes, absent tags warn, non-hashtag platforms skip", () => {
    const tagged = runDiscoverabilityLens({
      platform: "linkedin",
      targetTerms: ["AI"],
      body: "AI everywhere. #aisystems",
    });
    expect(tagged.findings.find((f) => f.check === "subject_hashtag")?.status).toBe("pass");

    const untagged = runDiscoverabilityLens({
      platform: "linkedin",
      targetTerms: ["AI"],
      body: "AI everywhere, no tags.",
    });
    expect(untagged.verdict).toBe("fail");
    expect(untagged.findings.find((f) => f.check === "subject_hashtag")?.status).toBe("warn");

    const facebook = runDiscoverabilityLens({
      platform: "facebook",
      targetTerms: ["AI"],
      body: "AI everywhere, no tags.",
    });
    expect(facebook.findings.find((f) => f.check === "subject_hashtag")?.status).toBe("skipped");
    expect(facebook.verdict).toBe("pass");
  });

  it("empty targets warn honestly instead of vacuously passing", () => {
    const result = runDiscoverabilityLens({ platform: "x", targetTerms: [" "], body: "anything" });
    expect(result.verdict).toBe("fail");
    expect(result.findings[0].check).toBe("targets_declared");
  });
});

describe("the golden pair (the founder catch, executable)", () => {
  interface GoldenRow {
    kind: string;
    input: { platform: string; targetTerms: string[]; body: string };
    expected: { verdict: "pass" | "fail" };
    sourceRef: string;
  }

  const seedPath = fileURLToPath(
    new URL("../../../../eval/golden/discoverability-seed.jsonl", import.meta.url),
  );
  const rows = readFileSync(seedPath, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as GoldenRow);

  it("carries both rows of the pair", () => {
    expect(rows.map((r) => r.sourceRef)).toEqual(["golden/disc-001", "golden/disc-002"]);
  });

  for (const row of rows) {
    it(`${row.sourceRef} → ${row.expected.verdict}`, () => {
      const result = runDiscoverabilityLens(row.input);
      expect(result.verdict).toBe(row.expected.verdict);
    });
  }
});
