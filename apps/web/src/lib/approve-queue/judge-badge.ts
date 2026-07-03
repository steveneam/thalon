import { KNOWN_JUDGE_GATES, type KnownJudgeGate } from "@thalon/contracts";

/** Shape-compatible with both @thalon/db's JudgeResult (createdAt: Date) and the wire-typed PanelJudgeResult (createdAt: string). */
export interface JudgeResultLike {
  gate: string;
  verdict: string;
  bodyHash: string;
  createdAt: string | Date;
}

export type JudgeGateStatus = "pass" | "fail" | "pending";
export type JudgeOverallStatus = "pass" | "fail" | "blocked_disagreement" | "pending";

export interface JudgeBadgeInfo {
  overall: JudgeOverallStatus;
  gates: Record<KnownJudgeGate, JudgeGateStatus>;
}

/**
 * Verdicts bind to CONTENT (SPINE invariant I1): only rows for the draft's
 * CURRENT body_hash are live evidence — a stale verdict from before an edit
 * must never influence the badge. Tier disagreement between g3_screen and
 * g3_final blocks rather than silently passing (invariant I3).
 */
export function computeJudgeBadge(results: JudgeResultLike[], bodyHash: string): JudgeBadgeInfo {
  const live = results.filter((r) => r.bodyHash === bodyHash);
  const latestByGate = new Map<string, JudgeResultLike>();
  for (const r of live) {
    const prev = latestByGate.get(r.gate);
    if (!prev || new Date(r.createdAt).getTime() >= new Date(prev.createdAt).getTime()) {
      latestByGate.set(r.gate, r);
    }
  }

  const gates = Object.fromEntries(
    KNOWN_JUDGE_GATES.map((gate) => [gate, (latestByGate.get(gate)?.verdict ?? "pending") as JudgeGateStatus]),
  ) as Record<KnownJudgeGate, JudgeGateStatus>;

  const g1 = gates.g1;
  const screen = gates.g3_screen;
  const final = gates.g3_final;

  let overall: JudgeOverallStatus;
  if (g1 === "fail") {
    overall = "fail";
  } else if (screen !== "pending" && final !== "pending" && screen !== final) {
    overall = "blocked_disagreement";
  } else if (final === "fail" || screen === "fail") {
    overall = "fail";
  } else if (g1 === "pass" && screen === "pass" && final === "pass") {
    overall = "pass";
  } else {
    overall = "pending";
  }

  return { overall, gates };
}
