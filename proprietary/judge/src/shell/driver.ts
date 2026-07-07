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
  screen: "judge-g3-screen.v2.md",
  final: "judge-g3-final.v1.md",
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
