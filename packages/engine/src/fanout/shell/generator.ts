import { generateObject } from "ai";
import type { PlatformProfile } from "@thalon/contracts";
import {
  getGateway,
  isClaudeCliModel,
  modelTiers,
  parseCandidateJson,
  runClaudeCliJson,
} from "@thalon/platform";
import { fanoutShellOutputSchema } from "../schemas";
import { readPromptFile } from "./prompt-file";

const PROMPT_FILE = "fanout-generate.v1.md";

/** `prompt_version` recorded on `fanout_runs` and every draft's `meta` (SPINE §3.2; charter B1.2-blocking provenance). */
export function fanoutPromptVersion(): string {
  return PROMPT_FILE.replace(/\.md$/, "");
}

export interface GenerateDraftRequest {
  platform: string;
  sourceText: string;
  voice: Record<string, unknown>;
  platformProfile: PlatformProfile;
}

/** One driver invocation = one gateway call: the raw candidate plus its token spend. */
export interface GenerateDraftCall {
  candidate: unknown;
  tokensIn: number;
  tokensOut: number;
}

/**
 * The fan-out generation shell (SPINE §1: shell is read-only). This module
 * only ever RETURNS a candidate draft — it never imports @thalon/db and
 * never writes anywhere; the core caller (../validate-shell-output.ts)
 * validates the output against fanoutShellOutputSchema and is the one that
 * persists it via repos.drafts.create.
 */
export type DraftGeneratorDriver = (req: GenerateDraftRequest) => Promise<GenerateDraftCall>;

/**
 * The real driver: routes through this project's OWN gateway wiring
 * (getGateway/modelTiers) via `ai`'s generateObject against the Zod
 * boundary schema. Never called by tests (ground rule: keyless +
 * networkless) — only reached when a caller doesn't inject a driver and
 * AI_GATEWAY_API_KEY is set.
 */
export function gatewayDraftGenerator(): DraftGeneratorDriver {
  return async (req) => {
    const modelId = modelTiers().draft;
    const system = readPromptFile(PROMPT_FILE);
    const prompt = [
      `PLATFORM: ${req.platform}`,
      `VOICE: ${JSON.stringify(req.voice)}`,
      `PLATFORM PROFILE: ${JSON.stringify(req.platformProfile)}`,
      `SOURCE CONTENT:\n${req.sourceText}`,
    ].join("\n\n");

    // Dev-only transport (see @thalon/platform claude-cli.ts): a
    // `claude-cli/<alias>` tier routes through the local Claude Code CLI on
    // the operator's subscription instead of the gateway — build/test phase
    // only, selected purely by runtime config. Same prompt file, same Zod
    // boundary downstream.
    if (isClaudeCliModel(modelId)) {
      const out = await runClaudeCliJson({
        model: modelId,
        system,
        prompt: `${prompt}\n\nReturn JSON: {"body": string (the complete draft), "format"?: string}`,
      });
      return {
        candidate: parseCandidateJson(out.text),
        tokensIn: out.tokensIn,
        tokensOut: out.tokensOut,
      };
    }

    const { object, usage } = await generateObject({
      model: getGateway().languageModel(modelId),
      schema: fanoutShellOutputSchema,
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

/**
 * Deterministic fake for tests: identical request -> identical synthesized
 * body, always. No network, no AI_GATEWAY_API_KEY required — this is what
 * keeps every fan-out test keyless and networkless.
 */
export function createFakeDraftGeneratorDriver(): DraftGeneratorDriver {
  return async (req) => {
    const body = `[${req.platform}] ${req.sourceText}`.slice(0, 500);
    const tokens = body.split(/\s+/).filter(Boolean).length;
    return {
      candidate: { body },
      tokensIn: tokens,
      tokensOut: tokens,
    };
  };
}
