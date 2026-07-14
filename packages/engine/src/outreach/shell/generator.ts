import { generateObject } from "ai";
import {
  getGateway,
  isClaudeCliModel,
  modelTiers,
  parseCandidateJson,
  runClaudeCliJson,
} from "@thalon/platform";
import { outreachEmailShellOutputSchema } from "../schemas";
import { readPromptFile } from "./prompt-file";

const PROMPT_FILE = "outreach-email-generate.v1.md";

/** `prompt_version` recorded on the compose run and every `outreach_email` draft's `meta` (SPINE §3.2). */
export function outreachEmailPromptVersion(): string {
  return PROMPT_FILE.replace(/\.md$/, "");
}

export interface GenerateOutreachEmailRequest {
  /**
   * The lead brief — the operator-pruned lead DNA (company · contact · role ·
   * pain point · notes) plus any operator direction, already assembled into
   * one text block by the caller. This is ALSO the draft's grounding source:
   * the judge verifies every claim against exactly this text (+ identity).
   */
  leadBrief: string;
  /** Who the email addresses — display only; never a source of facts beyond the brief. */
  recipient: { email: string; name: string | null };
  voice: Record<string, unknown>;
  /** B3.8 rendered identity block (contracts `renderBrandIdentity`) — absent when the active profile carries no identity content. */
  identityBlock?: string;
}

/** One driver invocation = one gateway call: the raw candidate plus its token spend. */
export interface OutreachEmailCall {
  candidate: unknown;
  tokensIn: number;
  tokensOut: number;
}

/**
 * The outreach-email shell (SPINE §1: shell is read-only). This module only
 * ever RETURNS a candidate email — it never imports @thalon/db and never
 * writes anywhere; the core caller (../validate-shell-output.ts) validates
 * the output against outreachEmailShellOutputSchema and ../compose.ts is the
 * one that persists it via repos.drafts.create. Mirrors
 * ../../origination/shell/generator.ts.
 */
export type OutreachEmailDriver = (req: GenerateOutreachEmailRequest) => Promise<OutreachEmailCall>;

/**
 * The real driver: routes through this project's OWN gateway wiring
 * (getGateway/modelTiers) via `ai`'s generateObject against the Zod
 * boundary schema. Never called by tests (ground rule: keyless +
 * networkless) — only reached when a caller doesn't inject a driver and
 * AI_GATEWAY_API_KEY is set.
 */
export function gatewayOutreachEmailDriver(): OutreachEmailDriver {
  return async (req) => {
    const modelId = modelTiers().draft;
    const system = readPromptFile(PROMPT_FILE);
    const prompt = [
      `RECIPIENT: ${req.recipient.name ? `${req.recipient.name} <${req.recipient.email}>` : req.recipient.email}`,
      `LEAD BRIEF (judge-grounded — the ONLY material you may draw factual claims about the lead from):\n${req.leadBrief}`,
      `VOICE: ${JSON.stringify(req.voice)}`,
      ...(req.identityBlock
        ? [`BRAND IDENTITY (operator-asserted, judge-grounded):\n${req.identityBlock}`]
        : []),
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
        prompt: `${prompt}\n\nReturn JSON: {"subject": string, "body": string}`,
      });
      return {
        candidate: parseCandidateJson(out.text),
        tokensIn: out.tokensIn,
        tokensOut: out.tokensOut,
      };
    }

    const { object, usage } = await generateObject({
      model: getGateway().languageModel(modelId),
      schema: outreachEmailShellOutputSchema,
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
 * email, always. No network, no AI_GATEWAY_API_KEY required — this is what
 * keeps every outreach-compose test keyless and networkless.
 */
export function createFakeOutreachEmailDriver(): OutreachEmailDriver {
  return async (req) => {
    const briefLine = req.leadBrief.split("\n").find(Boolean) ?? "your work";
    const candidate = {
      subject: `A thought for ${req.recipient.name ?? req.recipient.email}`.slice(0, 200),
      body: [
        `Hi ${req.recipient.name ?? "there"},`,
        `I read this about you: ${briefLine}`.slice(0, 200),
        "Worth a short chat?",
      ].join("\n\n"),
    };
    const tokens = req.leadBrief.split(/\s+/).filter(Boolean).length;
    return { candidate, tokensIn: tokens, tokensOut: tokens };
  };
}
