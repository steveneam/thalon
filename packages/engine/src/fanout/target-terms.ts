/**
 * Phase 2c (founder catch, s70c): TARGET-TERM derivation — generation's side
 * of the discoverability loop. The judge's advisory discoverability lens
 * (proprietary/judge) runs only when a draft's meta declares `targetTerms`;
 * this module is where those terms are derived, deterministically, from the
 * three inputs the charter names — in priority order:
 *
 *   1. the subject's canonical entities from the brief (declared by the
 *      generation shell — a post about AI must target "AI"),
 *   2. the caller's intel keywords (the monitored area's terms, when the
 *      draft came from an intel handoff),
 *   3. the active brand profile's identity topics.
 *
 * First term = the primary entity (the lens requires it in the body
 * unconditionally). The list stays short — capped, deduped, never stuffed.
 */

/** Hard cap on declared terms — short lists are targets, long lists are stuffing. */
export const MAX_TARGET_TERMS = 6;

/**
 * Dedup key: lowercase + collapse every non-alphanumeric run to one space —
 * the SAME normalization the discoverability lens applies to term matching,
 * so "Model-Agnostic" and "model agnostic" are one term here exactly as they
 * are one term to the lens.
 */
function termKey(term: string): string {
  return term
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Trim, drop empties/blank-normalizing terms, dedupe (first occurrence's casing wins), preserve order. */
export function normalizeTermList(terms: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of terms) {
    const term = raw.trim();
    const key = termKey(term);
    if (key === "" || seen.has(key)) continue;
    seen.add(key);
    out.push(term);
  }
  return out;
}

export interface DeriveTargetTermsInput {
  /** The generation shell's declared canonical entities from the brief ([0] = the primary entity). */
  shellTerms?: readonly string[];
  /** Caller-supplied candidates — the intel handoff's monitored-area keywords. */
  candidateTerms?: readonly string[];
  /** The active brand profile's identity topics (last-priority fill). */
  profileTopics?: readonly string[];
}

/**
 * The one derivation: concatenate in priority order, normalize + dedupe, cap
 * at MAX_TARGET_TERMS. Returns [] when every input is empty — the caller
 * then OMITS meta.targetTerms entirely, so a term-less draft judges
 * byte-identically to a pre-Phase-2c one (the lens stays opt-in by data).
 */
export function deriveTargetTerms(input: DeriveTargetTermsInput): string[] {
  return normalizeTermList([
    ...(input.shellTerms ?? []),
    ...(input.candidateTerms ?? []),
    ...(input.profileTopics ?? []),
  ]).slice(0, MAX_TARGET_TERMS);
}
