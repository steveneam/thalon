import { generateObject } from "ai";
import {
  getGateway,
  isClaudeCliModel,
  modelTiers,
  parseCandidateJson,
  runClaudeCliJson,
} from "@thalon/platform";
import { flowMapPageUrls, type FlowMap } from "../flow-map";
import { storyboardShellOutputSchema } from "../schemas";
import { readPromptFile } from "./prompt-file";

const PROMPT_FILE = "storyboard-generate.v1.md";

/** `prompt_version` recorded on the demo-plan run and every `demo_plan` draft's `meta` (SPINE §3.2). */
export function storyboardPromptVersion(): string {
  return PROMPT_FILE.replace(/\.md$/, "");
}

export interface StoryboardRequest {
  /** Operator-named flow to storyboard, e.g. "search the docs for X and open a result". */
  flowName: string;
  voice: Record<string, unknown>;
  /** Core-derived facts (SPINE §1: the shell selects among these, it never invents a page or selector) — see ../flow-map.ts. */
  flowMap: FlowMap;
  /** Relevant crawl chunks (grounding context) for narration/expect-step accuracy. */
  crawlContext: string;
}

/** One driver invocation = one gateway call: the raw candidate plus its token spend. */
export interface StoryboardCall {
  candidate: unknown;
  tokensIn: number;
  tokensOut: number;
}

/**
 * The B2.5 storyboard shell (SPINE §1: shell is read-only). This module only
 * ever RETURNS a candidate step sequence — it never imports @thalon/db and
 * never writes anywhere; the core caller (../validate-shell-output.ts)
 * validates the output against `storyboardShellOutputSchema` plus flow-map
 * membership, and ../storyboard.ts is the one that persists it. Mirrors
 * ../../waterfall/shell/generator.ts.
 */
export type StoryboardDriver = (req: StoryboardRequest) => Promise<StoryboardCall>;

/**
 * The real driver: routes through this project's OWN gateway wiring
 * (getGateway/modelTiers) via `ai`'s generateObject against the Zod
 * boundary schema. Never called by tests (ground rule: keyless +
 * networkless) — only reached when a caller doesn't inject a driver and
 * AI_GATEWAY_API_KEY is set.
 */
export function gatewayStoryboardDriver(): StoryboardDriver {
  return async (req) => {
    const modelId = modelTiers().draft;
    const system = readPromptFile(PROMPT_FILE);
    const prompt = [
      `FLOW: ${req.flowName}`,
      `VOICE: ${JSON.stringify(req.voice)}`,
      `CRAWLED PAGES (every "goto" target must be one of these URLs; never invent one):\n${JSON.stringify(
        flowMapPageUrls(req.flowMap),
      )}`,
      `FLOW MAP (per-page links + affordances; every non-"goto" target must be one of these selectors):\n${JSON.stringify(
        req.flowMap.pages,
      )}`,
      `RELEVANT CRAWL CONTEXT:\n${req.crawlContext}`,
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
        prompt: `${prompt}\n\nReturn JSON: {"steps": [{"action": "goto"|"click"|"fill"|"press"|"expect", "target": string, "value": string, "narration": string}]}`,
      });
      return {
        candidate: parseCandidateJson(out.text),
        tokensIn: out.tokensIn,
        tokensOut: out.tokensOut,
      };
    }

    const { object, usage } = await generateObject({
      model: getGateway().languageModel(modelId),
      schema: storyboardShellOutputSchema,
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
 * Deterministic fake for tests: `goto`s the first crawled page, then clicks
 * every `nav_link` affordance on that page, in order (identical request ->
 * identical steps). No network, no AI_GATEWAY_API_KEY required — this is
 * what keeps every storyboard test keyless and networkless.
 */
export function createFakeStoryboardDriver(): StoryboardDriver {
  return async (req) => {
    const pageUrls = flowMapPageUrls(req.flowMap);
    const firstPage = req.flowMap.pages[0];
    const firstUrl = pageUrls[0];
    const steps = [
      { action: "goto" as const, target: firstUrl, value: "", narration: `Open ${firstUrl}.` },
      ...(firstPage?.affordances ?? [])
        .filter((a) => a.kind === "nav_link")
        .map((a) => ({
          action: "click" as const,
          target: a.selector,
          value: "",
          narration: `Click "${a.label}".`,
        })),
    ];
    const tokens = steps.reduce(
      (sum, s) => sum + s.narration.split(/\s+/).filter(Boolean).length,
      0,
    );
    return { candidate: { steps }, tokensIn: tokens, tokensOut: tokens };
  };
}
