import { EXEMPLAR_OVERLAP_GATE } from "@/lib/approve-queue/formats/exemplar";
import type { JudgeResultLike } from "@/lib/approve-queue/judge-badge";

/** JudgeResultLike + the evidence column (jsonb on the wire and in db rows). */
export interface JudgeResultWithEvidence extends JudgeResultLike {
  evidence: unknown;
}

export interface JudgeReason {
  gate: string;
  /** Plain-language gate name — operator copy, never a bucket code. */
  gateLabel: string;
  /** One sentence per failing claim, from the recorded evidence. */
  line: string;
}

/** Operator-readable gate names (jargon copy rule — critique 2026-07-14). */
const GATE_LABELS: Record<string, string> = {
  g1: "Denylist",
  cadence: "Cadence",
  g3_screen: "Grounding — screen",
  g3_final: "Grounding — final",
  g5: "AI disclosure",
  [EXEMPLAR_OVERLAP_GATE]: "Exemplar overlap",
};

export function gateLabel(gate: string): string {
  return GATE_LABELS[gate] ?? gate;
}

interface EvidenceClaim {
  claim?: unknown;
  verdict?: unknown;
  evidence?: unknown;
}

/**
 * The plain-language WHY behind a verdict (critique P1: "withheld exactly
 * where trust is earned"). Walks the latest FAILING verdict per gate for the
 * draft's CURRENT body hash and turns each failing evidence claim into one
 * readable line. Structural reads only — an old or malformed evidence blob
 * yields a gate-level fallback line, never a crash (the judge writes
 * contracts judgeEvidenceSchema, but this module must survive anything).
 */
export function judgeReasons(results: JudgeResultWithEvidence[], bodyHash: string): JudgeReason[] {
  // Latest row per gate REGARDLESS of verdict — a gate that later passed (a
  // re-judge on the same body) must not resurface its old failing claims
  // (caught live: an approved draft carried stale screen-tier fail lines).
  const latestByGate = new Map<string, JudgeResultWithEvidence>();
  for (const r of results) {
    if (r.bodyHash !== bodyHash) continue;
    const prev = latestByGate.get(r.gate);
    if (!prev || new Date(r.createdAt).getTime() >= new Date(prev.createdAt).getTime()) {
      latestByGate.set(r.gate, r);
    }
  }

  const reasons: JudgeReason[] = [];
  for (const [gate, result] of latestByGate) {
    if (result.verdict !== "fail") continue;
    const label = gateLabel(gate);
    const ev = result.evidence as { claims?: unknown; notes?: unknown } | null;
    const claims = Array.isArray(ev?.claims) ? (ev.claims as EvidenceClaim[]) : [];
    const failing = claims.filter((c) => c.verdict === "fail");
    for (const c of failing) {
      const claim = typeof c.claim === "string" && c.claim.length > 0 ? c.claim : null;
      const detail = typeof c.evidence === "string" && c.evidence.length > 0 ? c.evidence : null;
      if (claim && detail) reasons.push({ gate, gateLabel: label, line: `${claim} — ${detail}` });
      else if (claim ?? detail) reasons.push({ gate, gateLabel: label, line: (claim ?? detail) as string });
    }
    if (failing.length === 0) {
      const notes = typeof ev?.notes === "string" && ev.notes.length > 0 ? ev.notes : null;
      reasons.push({
        gate,
        gateLabel: label,
        line: notes ?? "This check failed without recorded detail — re-judge to get a fresh verdict.",
      });
    }
  }
  return reasons;
}
