import type { Edl } from "@thalon/contracts";
import { runG1Denylist } from "./g1-denylist";

/**
 * B-ve.4 (ADR 0010 invariant): an edited caption/text layer is CONTENT —
 * a cut cannot be approved until every text layer passes the judge gate.
 * This lens is the deterministic G1 denylist run per caption line (pure,
 * zero model calls, per-tenant denylist as DATA), refusals verbatim per
 * line for the operator.
 *
 * Grounding seam, recorded honestly: cut captions carry no grounding
 * sources today (they are operator/agent-authored creative copy over the
 * tenant's own footage). When caption content gains provided sources, the
 * G3 grounding tiers bind here the same way they do for drafts — additively,
 * behind this same gate name.
 */

export const CUT_CAPTION_GATE = "g1-captions";

export interface CutCaptionFailure {
  /** Index into captions.lines. */
  line: number;
  text: string;
  /** Verbatim G1 matches ("matched <term> at index <i>") — the operator reads the actual refusal. */
  matches: string[];
}

export interface CutCaptionGateResult {
  verdict: "pass" | "fail";
  /** How many text layers were examined (0 = a caption-less cut passes trivially). */
  lines: number;
  failures: CutCaptionFailure[];
}

/** Every judgeable text layer of a cut's EDL, in caption-line order. */
export function cutTextLayers(edl: Edl): string[] {
  return (edl.captions?.lines ?? []).map((line) => line.text);
}

export function runCutCaptionGate(edl: Edl, denylist: readonly string[]): CutCaptionGateResult {
  const layers = cutTextLayers(edl);
  const failures: CutCaptionFailure[] = [];
  layers.forEach((text, line) => {
    const g1 = runG1Denylist({ body: text, denylist });
    if (g1.verdict === "fail") {
      failures.push({
        line,
        text,
        matches: g1.evidence.claims.map((c) => c.evidence ?? c.claim),
      });
    }
  });
  return {
    verdict: failures.length === 0 ? "pass" : "fail",
    lines: layers.length,
    failures,
  };
}
