import { KNOWN_JUDGE_GATES, type KnownJudgeGate } from "@thalon/contracts";
import { EXEMPLAR_OVERLAP_GATE } from "@/lib/approve-queue/formats/exemplar";

/** Shape-compatible with both @thalon/db's JudgeResult (createdAt: Date) and the wire-typed PanelJudgeResult (createdAt: string). */
export interface JudgeResultLike {
  gate: string;
  verdict: string;
  bodyHash: string;
  createdAt: string | Date;
}

export type JudgeGateStatus = "pass" | "fail" | "pending";
export type JudgeOverallStatus = "pass" | "fail" | "blocked_disagreement" | "blocked_overlap" | "pending";

export interface JudgeBadgeInfo {
  overall: JudgeOverallStatus;
  /** Keyed by KNOWN_JUDGE_GATES plus, when present, the B2.4 exemplar_overlap gate (open-ended judge_results.gate text — not in contracts' frozen KNOWN_JUDGE_GATES). */
  gates: Record<string, JudgeGateStatus>;
}

/**
 * Verdicts bind to CONTENT (SPINE invariant I1): only rows for the draft's
 * CURRENT body_hash are live evidence — a stale verdict from before an edit
 * must never influence the badge. Tier disagreement between g3_screen and
 * g3_final blocks rather than silently passing (invariant I3). The B2.4
 * exemplar_overlap gate is a distinct, harder block (verbatim reuse) — it
 * takes priority over the ordinary g1/g3 reading and stays legible as its
 * own "blocked_overlap" status rather than folding into generic "fail".
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

  const known = Object.fromEntries(
    KNOWN_JUDGE_GATES.map((gate) => [gate, (latestByGate.get(gate)?.verdict ?? "pending") as JudgeGateStatus]),
  ) as Record<KnownJudgeGate, JudgeGateStatus>;

  // Absent entirely on a plain (non-exemplar-aware) run — only surfaced when
  // at least one live verdict exists for it.
  const overlap = latestByGate.get(EXEMPLAR_OVERLAP_GATE);
  const gates: Record<string, JudgeGateStatus> = { ...known };
  if (overlap) gates[EXEMPLAR_OVERLAP_GATE] = overlap.verdict as JudgeGateStatus;

  const g1 = known.g1;
  const screen = known.g3_screen;
  const final = known.g3_final;

  let overall: JudgeOverallStatus;
  if (overlap?.verdict === "fail") {
    overall = "blocked_overlap";
  } else if (g1 === "fail") {
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
