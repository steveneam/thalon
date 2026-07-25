import { generateObject } from "ai";
import {
  getGateway,
  isClaudeCliModel,
  modelTiers,
  parseCandidateJson,
  runClaudeCliJson,
} from "@thalon/platform";
import { readPromptFile } from "./prompt-file";
import { shellJudgeOutputSchema } from "./schema";

export type JudgeTier = "screen" | "final";

export interface SourceChunkInput {
  ref: string;
  text: string;
}

export interface JudgeModelRequest {
  tier: JudgeTier;
  body: string;
  chunks: SourceChunkInput[];
}

/** One driver invocation = one gateway call: the raw candidate plus its token spend. */
export interface JudgeModelCall {
  candidate: unknown;
  tokensIn: number;
  tokensOut: number;
}

/**
 * A shell judge driver: read-only, returns a raw (unvalidated) candidate —
 * only ../validate-shell-output.ts (core) may treat it as trustworthy, and
 * only after it survives the Zod boundary guard. Token counts ride along so
 * the core can meter every attempt through the ONE gateway choke point
 * (`withGatewayGuard`, see pipeline.ts). Tests inject scripted fakes so
 * every judge test runs keyless (no AI_GATEWAY_API_KEY).
 */
export type JudgeModelDriver = (req: JudgeModelRequest) => Promise<JudgeModelCall>;

const PROMPT_FILE_FOR_TIER: Record<JudgeTier, string> = {
  // v2 (B6.7 eval-row refinement): the screen tier gained the final tier's
  // claim taxonomy — verifiable specifics gate, rhetorical commonplaces and
  // the draft's own argumentation do not. v1 failed page-length drafts on
  // non-factual framing ("fluency and accuracy are not the same property"),
  // reproducibly disagreeing with the final tier on doctrine rather than
  // judgment; golden rows g3-004/g3-005 pin the taxonomy. I3 is untouched:
  // tier disagreement still blocks.
  // screen v3 (s68 tuning pass): + the internal-mechanism rule — the one
  // leniency class left (golden g3-008: an invented threshold-refinement
  // mechanism passed screen while final caught it; I3 blocked the draft
  // either way, but the tier should agree on doctrine).
  // screen v4 (s69): v3's mechanism rule collided with its paraphrase rule
  // — the cheap tier bridged an invented mechanism to an adjacent stated
  // one as "paraphrase" roughly every other lap (g3-008 flipped 2-of-5 on
  // 2026-07-25). v4 makes the mechanism rule own the collision: part-by-part
  // comparison (trigger · signal · component · effect) + an explicit
  // never-bridges-mechanisms exception inside the paraphrase rule.
  screen: "judge-g3-screen.v4.md",
  // final v2 (s68 tuning pass, founder GO): explicit decision rules replace
  // v1's "inference fine / specifics not" collision, which the model
  // resolved toward refusing ENTAILED specifics (a date's month, arithmetic
  // over stated dates), rejecting operator attestations while citing them,
  // and drifting objections between laps on identical text (the 491089d0
  // twelve-lap record). v2 names admissible entailment exactly (calendar
  // containment · simple arithmetic · stated category membership · operator
  // attestation), excludes rhetorical/restatement lines from the claim set,
  // and keeps every real catch (wrong ordering, uncited specifics,
  // contradicted counts, ungrounded volume promises) — golden rows
  // g3-009..g3-015 pin both directions.
  final: "judge-g3-final.v2.md",
};

/** `prompt_version` recorded on the judge_results row (SPINE §3.2). */
export function promptVersionFor(tier: JudgeTier): string {
  return PROMPT_FILE_FOR_TIER[tier].replace(/\.md$/, "");
}

/**
 * The real driver: routes through this project's OWN gateway wiring
 * (`getGateway`/`modelTiers`) and reports its token spend. Budget assertion,
 * usage recording, and tracing are NOT here — the shell stays read-only; the
 * pipeline (core) wraps every invocation in `withGatewayGuard`. Never
 * constructed in tests.
 */
export function gatewayJudgeDriver(): JudgeModelDriver {
  return async (req) => {
    const tiers = modelTiers();
    const modelId = req.tier === "screen" ? tiers.judgeScreen : tiers.judgeFinal;
    const system = readPromptFile(PROMPT_FILE_FOR_TIER[req.tier]);
    const sources = req.chunks.map((c) => `[${c.ref}] ${c.text}`).join("\n\n");
    const prompt = `DRAFT:\n${req.body}\n\nPROVIDED SOURCES:\n${sources || "(none provided)"}`;

    // Dev-only transport (see @thalon/platform claude-cli.ts): a
    // `claude-cli/<alias>` tier routes through the local Claude Code CLI on
    // the operator's subscription instead of the gateway — build/test phase
    // only, selected purely by runtime config. Same versioned prompt file,
    // same Zod boundary in ../validate-shell-output.ts.
    if (isClaudeCliModel(modelId)) {
      const out = await runClaudeCliJson({
        model: modelId,
        system,
        prompt: `${prompt}\n\nReturn JSON: {"verdict": "pass" | "fail", "claims": [{"claim": string, "supported": boolean, "chunkRef"?: string}], "notes"?: string}`,
      });
      return {
        candidate: parseCandidateJson(out.text),
        tokensIn: out.tokensIn,
        tokensOut: out.tokensOut,
      };
    }

    const { object, usage } = await generateObject({
      model: getGateway().languageModel(modelId),
      schema: shellJudgeOutputSchema,
      system,
      prompt,
    });
    return {
      candidate: object,
      tokensIn: usage.inputTokens ?? 0,
      tokensOut: usage.outputTokens ?? 0,
    };
  };
}
