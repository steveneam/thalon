import type { JudgeEvidence, TenantCtx } from "@thalon/contracts";
import type { Repos } from "@thalon/db";

/**
 * n-gram size (in words) for the verbatim-reuse gate (ADR 0002 decision 4:
 * "exemplars are grounding-only, never republished"). 8 consecutive words is
 * long enough that an independent, coincidental match between a generated
 * draft and an exemplar is vanishingly unlikely — natural-language entropy
 * grows combinatorially with n — but short enough to catch a copy-pasted
 * clause or sentence fragment well before an entire exemplar post is
 * reproduced. This is a hard "never republished" gate (any single match is a
 * breach), not a similarity score: a draft may draw on an exemplar's
 * tone/structure, it must never reproduce this many consecutive words from
 * it verbatim. Tune only here — every caller reads this constant.
 */
export const OVERLAP_NGRAM_SIZE = 8;

/** judge_results.gate value this module writes (open-ended text column — zero migrations, ADR 0002 decision 4). */
export const EXEMPLAR_OVERLAP_GATE = "exemplar_overlap";

export interface ExemplarChunkRef {
  sourceId: string;
  chunkId: string;
  text: string;
}

export interface OverlapMatch {
  ngram: string;
  exemplarSourceId: string;
  exemplarChunkId: string;
}

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function ngrams(words: string[], n: number): string[] {
  if (words.length < n) return [];
  const out: string[] = [];
  for (let i = 0; i + n <= words.length; i++) {
    out.push(words.slice(i, i + n).join(" "));
  }
  return out;
}

export interface NgramOverlapResult {
  breached: boolean;
  matches: OverlapMatch[];
}

/**
 * Deterministic core gate (SPINE §1 doctrine: "deterministic fallbacks...
 * are pure functions — never delegated to a model"). Given the same draft
 * body and exemplar chunks, always the same verdict — no I/O, no clock, no
 * randomness. Case/punctuation-insensitive so trivial formatting changes
 * cannot launder a verbatim lift.
 */
export function checkNgramOverlap(
  draftBody: string,
  exemplarChunks: readonly ExemplarChunkRef[],
  n: number = OVERLAP_NGRAM_SIZE,
): NgramOverlapResult {
  const draftNgrams = new Set(ngrams(normalizeWords(draftBody), n));
  const matches: OverlapMatch[] = [];
  if (draftNgrams.size > 0) {
    for (const chunk of exemplarChunks) {
      const seen = new Set<string>();
      for (const gram of ngrams(normalizeWords(chunk.text), n)) {
        if (seen.has(gram) || !draftNgrams.has(gram)) continue;
        seen.add(gram);
        matches.push({
          ngram: gram,
          exemplarSourceId: chunk.sourceId,
          exemplarChunkId: chunk.chunkId,
        });
      }
    }
  }
  return { breached: matches.length > 0, matches };
}

export interface RunExemplarOverlapGateInput {
  ctx: TenantCtx;
  draftId: string;
  exemplarChunks: readonly ExemplarChunkRef[];
}

export type ExemplarOverlapOutcome =
  | { status: "clear" }
  | { status: "blocked"; matches: OverlapMatch[] };

/**
 * Core orchestration (SPINE §1.1): runs immediately after generation for
 * exemplar-aware drafts, BEFORE the normal judge harness ever sees them. A
 * breach writes an append-only judge_results row (gate "exemplar_overlap",
 * verdict fail) and drives the draft to `blocked` through the ONE transition
 * function (repos.drafts.transition) via the only legal path — generated ->
 * judging -> blocked — so a verbatim-reuse draft can never reach `queued`.
 * A clear result writes nothing and leaves the draft in `generated`, exactly
 * as a plain fan-out draft, so it proceeds to the normal judge pipeline
 * (B1.3) unaffected.
 */
export async function runExemplarOverlapGate(
  repos: Repos,
  input: RunExemplarOverlapGateInput,
): Promise<ExemplarOverlapOutcome> {
  const draft = await repos.drafts.get(input.ctx, input.draftId);
  const { breached, matches } = checkNgramOverlap(draft.body, input.exemplarChunks);
  if (!breached) return { status: "clear" };

  const evidence: JudgeEvidence = {
    claims: matches.map((m) => ({
      claim: m.ngram,
      verdict: "fail",
      evidence: `verbatim ${OVERLAP_NGRAM_SIZE}-word overlap with an exemplar in this draft's generation context`,
      sourceRef: m.exemplarChunkId,
    })),
  };
  await repos.judgeResults.append(input.ctx, {
    draftId: draft.id,
    gate: EXEMPLAR_OVERLAP_GATE,
    verdict: "fail",
    bodyHash: draft.bodyHash,
    evidence,
  });

  // Legal path only (SPINE §1.1): generated -> judging -> blocked, both
  // through the ONE writer of drafts.status.
  await repos.drafts.transition(input.ctx, draft.id, "judging");
  await repos.drafts.transition(input.ctx, draft.id, "blocked", {
    reason: "exemplar overlap gate: verbatim reuse detected",
  });

  return { status: "blocked", matches };
}
