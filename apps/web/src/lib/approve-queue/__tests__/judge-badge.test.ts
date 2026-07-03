import { describe, expect, it } from "vitest";
import { computeJudgeBadge, type JudgeResultLike } from "../judge-badge";

const HASH = "hash-a";
const OTHER_HASH = "hash-b";

function result(gate: string, verdict: "pass" | "fail", bodyHash = HASH): JudgeResultLike {
  return { gate, verdict, bodyHash, createdAt: "2026-07-04T00:00:00.000Z" };
}

describe("computeJudgeBadge", () => {
  it("pass: g1 + both g3 tiers agree pass", () => {
    const badge = computeJudgeBadge([result("g1", "pass"), result("g3_screen", "pass"), result("g3_final", "pass")], HASH);
    expect(badge.overall).toBe("pass");
  });

  it("fail: g1 denylist fails outright", () => {
    const badge = computeJudgeBadge([result("g1", "fail")], HASH);
    expect(badge.overall).toBe("fail");
  });

  it("fail: both g3 tiers agree on fail", () => {
    const badge = computeJudgeBadge(
      [result("g1", "pass"), result("g3_screen", "fail"), result("g3_final", "fail")],
      HASH,
    );
    expect(badge.overall).toBe("fail");
  });

  it("blocked_disagreement: tiers disagree — never a silent pass (I3)", () => {
    const badge = computeJudgeBadge(
      [result("g1", "pass"), result("g3_screen", "pass"), result("g3_final", "fail")],
      HASH,
    );
    expect(badge.overall).toBe("blocked_disagreement");
  });

  it("pending: no gates have run yet", () => {
    expect(computeJudgeBadge([], HASH).overall).toBe("pending");
  });

  it("ignores verdicts bound to a stale body hash (I1)", () => {
    const badge = computeJudgeBadge(
      [result("g1", "pass", OTHER_HASH), result("g3_screen", "pass", OTHER_HASH), result("g3_final", "pass", OTHER_HASH)],
      HASH,
    );
    expect(badge.overall).toBe("pending");
  });

  it("takes the latest verdict per gate when a gate has been re-run for the same hash", () => {
    const stale: JudgeResultLike = { gate: "g1", verdict: "fail", bodyHash: HASH, createdAt: "2026-07-01T00:00:00.000Z" };
    const fresh: JudgeResultLike = { gate: "g1", verdict: "pass", bodyHash: HASH, createdAt: "2026-07-04T00:00:00.000Z" };
    const badge = computeJudgeBadge(
      [stale, fresh, result("g3_screen", "pass"), result("g3_final", "pass")],
      HASH,
    );
    expect(badge.gates.g1).toBe("pass");
    expect(badge.overall).toBe("pass");
  });
});
