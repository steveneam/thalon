import { generateObject } from "ai";
import {
  getGateway,
  isClaudeCliModel,
  modelTiers,
  parseCandidateJson,
  runClaudeCliJson,
} from "@thalon/platform";
import { pillarScriptShellOutputSchema } from "../schemas";
import { readPromptFile } from "./prompt-file";

const PROMPT_FILE = "pillar-script-generate.v1.md";

/** `prompt_version` recorded on the origination run and every `pillar_script` draft's `meta` (SPINE §3.2). */
export function pillarScriptPromptVersion(): string {
  return PROMPT_FILE.replace(/\.md$/, "");
}

export interface GeneratePillarScriptRequest {
  /** The operator's brief — topic and angle only, never a source of facts. */
  operatorPrompt: string;
  voice: Record<string, unknown>;
  /** B3.8 rendered identity block (contracts `renderBrandIdentity`) — absent when the active profile carries no identity content. */
  identityBlock?: string;
  /** Combined text of every grounding source (site crawl / repo / docs) the script may draw claims from. */
  groundingText: string;
}

/** One driver invocation = one gateway call: the raw candidate plus its token spend. */
export interface PillarScriptCall {
  candidate: unknown;
  tokensIn: number;
  tokensOut: number;
}

/**
 * The B3.9 pillar-script shell (SPINE §1: shell is read-only). This module
 * only ever RETURNS a candidate script — it never imports @thalon/db and
 * never writes anywhere; the core caller (../validate-shell-output.ts)
 * validates the output against pillarScriptShellOutputSchema and
 * ../origination.ts is the one that persists it via repos.drafts.create.
 * Mirrors ../../fanout/shell/generator.ts.
 */
export type PillarScriptDriver = (req: GeneratePillarScriptRequest) => Promise<PillarScriptCall>;

/**
 * The real driver: routes through this project's OWN gateway wiring
 * (getGateway/modelTiers) via `ai`'s generateObject against the Zod
 * boundary schema. Never called by tests (ground rule: keyless +
 * networkless) — only reached when a caller doesn't inject a driver and
 * AI_GATEWAY_API_KEY is set.
 */
export function gatewayPillarScriptDriver(): PillarScriptDriver {
  return async (req) => {
    const modelId = modelTiers().draft;
    const system = readPromptFile(PROMPT_FILE);
    const prompt = [
      `OPERATOR PROMPT: ${req.operatorPrompt}`,
      `VOICE: ${JSON.stringify(req.voice)}`,
      ...(req.identityBlock
        ? [`BRAND IDENTITY (operator-asserted, judge-grounded):\n${req.identityBlock}`]
        : []),
      `GROUNDING SOURCES (judge-grounded — the only other material you may draw factual claims from):\n${req.groundingText}`,
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
        prompt: `${prompt}\n\nReturn JSON: {"title": string, "hook": string, "beats": [{"narration": string, "onScreenText"?: string, "visualHint"?: string, "durationHintMs"?: number}], "cta"?: string}`,
      });
      return {
        candidate: parseCandidateJson(out.text),
        tokensIn: out.tokensIn,
        tokensOut: out.tokensOut,
      };
    }

    const { object, usage } = await generateObject({
      model: getGateway().languageModel(modelId),
      schema: pillarScriptShellOutputSchema,
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
 * script, always. No network, no AI_GATEWAY_API_KEY required — this is what
 * keeps every origination test keyless and networkless.
 */
export function createFakePillarScriptDriver(): PillarScriptDriver {
  return async (req) => {
    const topic = req.operatorPrompt.slice(0, 60);
    const grounding = req.groundingText.slice(0, 120);
    const candidate = {
      title: `Pillar: ${topic}`,
      hook: `Here is the one thing to know about ${topic}`.slice(0, 120),
      beats: [
        { narration: `First: ${grounding}`.slice(0, 200) },
        { narration: `Finally, what this means in practice.`, onScreenText: "In practice" },
      ],
      cta: undefined,
    };
    const tokens = req.operatorPrompt.split(/\s+/).filter(Boolean).length;
    return { candidate, tokensIn: tokens, tokensOut: tokens };
  };
}
