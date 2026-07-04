import { generateObject } from "ai";
import {
  getGateway,
  isClaudeCliModel,
  modelTiers,
  parseCandidateJson,
  runClaudeCliJson,
} from "@thalon/platform";
import { readPromptFile } from "../../origination/shell/prompt-file";
import { webPageShellOutputSchema } from "../schemas";

const PROMPT_FILE = "web-page-generate.v1.md";

/** `prompt_version` recorded on the generation run and every `web_page` draft's `meta` (SPINE §3.2). */
export function webPagePromptVersion(): string {
  return PROMPT_FILE.replace(/\.md$/, "");
}

export interface GenerateWebPageRequest {
  /** The operator's brief — page purpose and angle only, never a source of facts. */
  operatorPrompt: string;
  voice: Record<string, unknown>;
  /** B3.8 rendered identity block (contracts `renderBrandIdentity`) — absent when the active profile carries no identity content. */
  identityBlock?: string;
  /** Combined text of every grounding source (site crawl / repo / docs) the page may draw claims from. */
  groundingText: string;
}

/** One driver invocation = one gateway call: the raw candidate plus its token spend. */
export interface WebPageCall {
  candidate: unknown;
  tokensIn: number;
  tokensOut: number;
}

/**
 * The B3.15 web-page shell (SPINE §1: shell is read-only). This module only
 * ever RETURNS a candidate page — it never imports @thalon/db and never
 * writes anywhere; the core caller (../validate-shell-output.ts) validates
 * the output against webPageShellOutputSchema + the self-containment
 * checks, and ../webpage.ts is the one that persists it. Mirrors
 * ../../origination/shell/generator.ts.
 */
export type WebPageDriver = (req: GenerateWebPageRequest) => Promise<WebPageCall>;

/**
 * The real driver: routes through this project's OWN gateway wiring
 * (getGateway/modelTiers) via `ai`'s generateObject against the Zod
 * boundary schema. Never called by tests (ground rule: keyless +
 * networkless) — only reached when a caller doesn't inject a driver and
 * AI_GATEWAY_API_KEY is set.
 */
export function gatewayWebPageDriver(): WebPageDriver {
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
        prompt: `${prompt}\n\nReturn JSON: {"title": string, "description": string, "html": string}`,
      });
      return {
        candidate: parseCandidateJson(out.text),
        tokensIn: out.tokensIn,
        tokensOut: out.tokensOut,
      };
    }

    const { object, usage } = await generateObject({
      model: getGateway().languageModel(modelId),
      schema: webPageShellOutputSchema,
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
 * self-contained page, always. No network, no AI_GATEWAY_API_KEY required —
 * this is what keeps every web-page test keyless and networkless (amendment
 * A9 pass-1 discipline).
 */
export function createFakeWebPageDriver(): WebPageDriver {
  return async (req) => {
    const topic = req.operatorPrompt.slice(0, 60);
    const grounding = req.groundingText.slice(0, 160);
    const candidate = {
      title: `Landing: ${topic}`,
      description: `A landing page about ${topic}`.slice(0, 140),
      html: [
        "<!doctype html>",
        '<html lang="en"><head><meta charset="utf-8">',
        `<title>Landing: ${topic}</title>`,
        "<style>body{font-family:system-ui;margin:0}main{max-width:40rem;margin:0 auto;padding:2rem}</style>",
        "</head><body>",
        `<main><h1>${topic}</h1>`,
        `<p>${grounding}</p>`,
        '<p><a href="#contact">Get in touch</a></p></main>',
        "</body></html>",
      ].join("\n"),
    };
    const tokens = req.operatorPrompt.split(/\s+/).filter(Boolean).length;
    return { candidate, tokensIn: tokens, tokensOut: tokens };
  };
}
