import type { JudgeEvidence, Verdict } from "@thalon/contracts";

export interface RunG1Input {
  body: string;
  /** Per-tenant denylist terms — always DATA from brand_profiles, never hard-coded here. */
  denylist: readonly string[];
}

export interface G1Result {
  verdict: Verdict;
  evidence: JudgeEvidence;
}

function escapeRegExp(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * G1 denylist gate — pure, deterministic, zero model calls (SPINE §1
 * doctrine: "deterministic fallbacks... denylist matching (G1)... are pure
 * functions — never delegated to a model"). Runs first because it is the
 * cheapest gate; a fail here must never reach a model call.
 *
 * Matching semantics (exact, so behavior never drifts silently):
 *  - Case-insensitive: "Guaranteed Returns" matches the term "guaranteed returns".
 *  - Word-boundary aware: `\b<term>\b` — a term matches only where it is
 *    bounded by non-word characters (or string start/end) on both ends, so
 *    "class" does not match inside "classroom". Internal characters of a
 *    multi-word term (e.g. the space in "guaranteed returns") are matched
 *    literally — only the two outer edges are boundary-checked.
 *  - Every occurrence of every term is recorded, not just the first —
 *    evidence carries the full match list (term + character index) for
 *    operator triage.
 *  - An empty denylist always passes (no per-tenant rules configured yet).
 */
export function runG1Denylist(input: RunG1Input): G1Result {
  const matches: Array<{ term: string; index: number }> = [];
  for (const term of input.denylist) {
    if (!term) continue;
    const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`, "gi");
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(input.body)) !== null) {
      matches.push({ term, index: match.index });
      if (pattern.lastIndex === match.index) pattern.lastIndex++;
    }
  }

  if (matches.length === 0) {
    return { verdict: "pass", evidence: { claims: [] } };
  }
  return {
    verdict: "fail",
    evidence: {
      claims: matches.map((m) => ({
        claim: m.term,
        verdict: "fail",
        evidence: `matched "${m.term}" at index ${m.index}`,
      })),
    },
  };
}
