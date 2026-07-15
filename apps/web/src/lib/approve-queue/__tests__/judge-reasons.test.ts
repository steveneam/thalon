import { describe, expect, it } from "vitest";
import { judgeReasons, type JudgeResultWithEvidence } from "../judge-reasons";

function result(
  gate: string,
  verdict: string,
  bodyHash: string,
  evidence: unknown,
  createdAt = "2026-07-14T09:05:00.000Z",
): JudgeResultWithEvidence {
  return { gate, verdict, bodyHash, evidence, createdAt };
}

describe("judgeReasons", () => {
  it("turns failing claims into plain-language lines under an operator-readable gate name", () => {
    const reasons = judgeReasons(
      [
        result("g1", "fail", "h1", {
          claims: [
            { claim: "body text", verdict: "fail", evidence: 'matched "guaranteed" at index 12' },
            { claim: "clean part", verdict: "pass" },
          ],
        }),
      ],
      "h1",
    );
    expect(reasons).toEqual([
      { gate: "g1", gateLabel: "Denylist", line: 'body text — matched "guaranteed" at index 12' },
    ]);
  });

  it("ignores verdicts for a stale body hash and passing gates (invariant I1)", () => {
    const reasons = judgeReasons(
      [
        result("g1", "fail", "old-hash", { claims: [{ claim: "x", verdict: "fail" }] }),
        result("g3_final", "pass", "h1", { claims: [] }),
      ],
      "h1",
    );
    expect(reasons).toEqual([]);
  });

  it("a gate that later PASSED on the same hash surfaces no stale reasons (caught live, s39)", () => {
    const reasons = judgeReasons(
      [
        result("g3_screen", "fail", "h1", { claims: [{ claim: "old fail", verdict: "fail" }] }, "2026-07-14T09:00:00.000Z"),
        result("g3_screen", "pass", "h1", { claims: [] }, "2026-07-14T10:00:00.000Z"),
      ],
      "h1",
    );
    expect(reasons).toEqual([]);
  });

  it("keeps only the LATEST failing row per gate", () => {
    const reasons = judgeReasons(
      [
        result("g1", "fail", "h1", { claims: [{ claim: "older", verdict: "fail" }] }, "2026-07-14T09:00:00.000Z"),
        result("g1", "fail", "h1", { claims: [{ claim: "newer", verdict: "fail" }] }, "2026-07-14T10:00:00.000Z"),
      ],
      "h1",
    );
    expect(reasons).toHaveLength(1);
    expect(reasons[0].line).toBe("newer");
  });

  it("survives malformed or empty evidence with an honest fallback line, never a crash", () => {
    for (const evidence of [null, "not an object", { claims: "nope" }, { claims: [] }]) {
      const reasons = judgeReasons([result("g3_final", "fail", "h1", evidence)], "h1");
      expect(reasons).toHaveLength(1);
      expect(reasons[0].gateLabel).toBe("Grounding — final");
      expect(reasons[0].line).toMatch(/failed without recorded detail/);
    }
  });

  it("falls back to evidence notes when no per-claim rows failed", () => {
    const reasons = judgeReasons(
      [result("cadence", "fail", "h1", { claims: [], notes: "email already posted twice today" })],
      "h1",
    );
    expect(reasons).toEqual([
      { gate: "cadence", gateLabel: "Cadence", line: "email already posted twice today" },
    ]);
  });
});
