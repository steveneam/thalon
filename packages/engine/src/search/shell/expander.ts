import { generateObject } from "ai";
import {
  getGateway,
  isClaudeCliModel,
  modelTiers,
  parseCandidateJson,
  runClaudeCliJson,
} from "@thalon/platform";
import { readPromptFile } from "../../origination/shell/prompt-file";
import { keywordExpansionShellOutputSchema } from "../schemas";

const PROMPT_FILE = "keyword-expand.v1.md";

/** `prompt_version` recorded on every ai_expansion target's `meta` (SPINE §3.2). */
export function keywordExpansionPromptVersion(): string {
  return PROMPT_FILE.replace(/\.md$/, "");
}

export interface ExpandKeywordsRequest {
  /** B3.8 rendered identity block (contracts `renderBrandIdentity`) — the expansion's ONLY subject matter. */
  identityBlock: string;
  /** Already-compiled targets (every origin/status) — the shell must not repeat them. */
  existingKeywords: string[];
  /** How many keywords to propose. */
  count: number;
}

/** One driver invocation = one gateway call: the raw candidate plus its token spend. */
export interface KeywordExpansionCall {
  candidate: unknown;
  tokensIn: number;
  tokensOut: number;
}

/**
 * The B6.8 keyword-expansion shell (SPINE §1: shell is read-only). This
 * module only ever RETURNS candidate keywords — it never imports @thalon/db
 * and never writes anywhere; the core caller (../expansion.ts) validates
 * against keywordExpansionShellOutputSchema, gates each candidate (G1
 * denylist + deterministic grounding to the identity), and persists the
 * survivors. Mirrors ../../webpage/shell/generator.ts.
 */
export type KeywordExpansionDriver = (req: ExpandKeywordsRequest) => Promise<KeywordExpansionCall>;

/**
 * The real driver: routes through this project's OWN gateway wiring
 * (getGateway/modelTiers) via `ai`'s generateObject against the Zod
 * boundary schema. Never called by tests (ground rule: keyless +
 * networkless) — only reached when a caller doesn't inject a driver and
 * AI_GATEWAY_API_KEY is set.
 */
export function gatewayKeywordExpansionDriver(): KeywordExpansionDriver {
  return async (req) => {
    const modelId = modelTiers().draft;
    const system = readPromptFile(PROMPT_FILE);
    const prompt = [
      `BRAND IDENTITY (operator-asserted — your only source of subject matter):\n${req.identityBlock}`,
      `EXISTING TARGETS (never repeat or trivially vary):\n${req.existingKeywords.map((k) => `- ${k}`).join("\n") || "(none yet)"}`,
      `COUNT: ${req.count}`,
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
        prompt: `${prompt}\n\nReturn JSON: {"keywords": [{"keyword": string, "rationale": string}]}`,
      });
      return {
        candidate: parseCandidateJson(out.text),
        tokensIn: out.tokensIn,
        tokensOut: out.tokensOut,
      };
    }

    const { object, usage } = await generateObject({
      model: getGateway().languageModel(modelId),
      schema: keywordExpansionShellOutputSchema,
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
 * Deterministic fake for tests/dogfood: identical request -> identical
 * candidates, always. Derives query-shaped phrasings from the identity
 * block's TOPICS line (falling back to its first content line), so the
 * grounding gate downstream accepts them — no network, no key (amendment
 * A9 discipline).
 */
export function createFakeKeywordExpansionDriver(): KeywordExpansionDriver {
  return async (req) => {
    const topicsLine = req.identityBlock
      .split("\n")
      .find((line) => line.startsWith("TOPICS:"));
    const subject =
      topicsLine?.replace("TOPICS:", "").split(",")[0]?.trim().toLowerCase() ||
      req.identityBlock.split("\n")[0]?.trim().toLowerCase() ||
      "the product";
    const shapes = [
      `${subject} vs doing it manually`,
      `why ${subject} saves time`,
      `${subject} pricing`,
      `how to start with ${subject}`,
      `${subject} alternatives`,
    ];
    const keywords = Array.from({ length: req.count }, (_, i) => ({
      keyword: shapes[i % shapes.length] + (i >= shapes.length ? ` ${Math.floor(i / shapes.length) + 1}` : ""),
      rationale: `targets the identity topic "${subject}"`,
    }));
    const tokens = req.identityBlock.split(/\s+/).filter(Boolean).length;
    return { candidate: { keywords }, tokensIn: tokens, tokensOut: keywords.length };
  };
}
