import { generateObject } from "ai";
import { getGateway, modelTiers } from "@thalon/platform";
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
  screen: "judge-g3-screen.v1.md",
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
    const model = getGateway().languageModel(modelId);
    const system = readPromptFile(PROMPT_FILE_FOR_TIER[req.tier]);
    const sources = req.chunks.map((c) => `[${c.ref}] ${c.text}`).join("\n\n");
    const { object, usage } = await generateObject({
      model,
      schema: shellJudgeOutputSchema,
      system,
      prompt: `DRAFT:\n${req.body}\n\nPROVIDED SOURCES:\n${sources || "(none provided)"}`,
    });
    return {
      candidate: object,
      tokensIn: usage.inputTokens ?? 0,
      tokensOut: usage.outputTokens ?? 0,
    };
  };
}
