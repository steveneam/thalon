import { generateObject } from "ai";
import {
  getGateway,
  isClaudeCliModel,
  modelTiers,
  parseCandidateJson,
  runClaudeCliJson,
} from "@thalon/platform";
import { readPromptFile } from "../../origination/shell/prompt-file";
import { trendDossierShellOutputSchema } from "../dossier-schemas";

const PROMPT_FILE = "trend-dossier.v1.md";

/** Recorded on every generated dossier's provenance (SPINE §3.2). */
export function trendDossierPromptVersion(): string {
  return PROMPT_FILE.replace(/\.md$/, "");
}

export interface DossierShellRequest {
  /** The trend item's own text — the shell's ONLY source of subject matter. */
  itemText: string;
  source: string;
  account: string;
  /** The monitored area the item ranked into — the "why it matters" lens. */
  areaName: string;
  areaDescription: string;
}

/** One driver invocation = one gateway call: the raw candidate plus its token spend. */
export interface DossierShellCall {
  candidate: unknown;
  tokensIn: number;
  tokensOut: number;
}

/**
 * The B6.5 dossier shell (SPINE §1: shell is read-only). This module only
 * ever RETURNS a candidate dossier — it never imports @thalon/db and never
 * writes anywhere; the core caller (../dossier.ts) validates against
 * trendDossierShellOutputSchema, gates it (G1 denylist), and decides what
 * rides the sweep bundle. Mirrors ../../search/shell/expander.ts.
 */
export type DossierDriver = (req: DossierShellRequest) => Promise<DossierShellCall>;

/**
 * The real driver: routes through this project's OWN gateway wiring
 * (getGateway/modelTiers) via `ai`'s generateObject against the Zod
 * boundary schema. Never called by tests (ground rule: keyless +
 * networkless) — only reached when a caller doesn't inject a driver and
 * AI_GATEWAY_API_KEY is set.
 */
export function gatewayDossierDriver(): DossierDriver {
  return async (req) => {
    const modelId = modelTiers().draft;
    const system = readPromptFile(PROMPT_FILE);
    const prompt = [
      `TREND ITEM (from ${req.source}, by ${req.account} — your only source of subject matter):\n${req.itemText}`,
      `MONITORED AREA "${req.areaName}" (the operator's lens):\n${req.areaDescription}`,
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
        prompt: `${prompt}\n\nReturn JSON: {"titles": [string, ...], "angles": [string, ...], "hook": string}`,
      });
      return {
        candidate: parseCandidateJson(out.text),
        tokensIn: out.tokensIn,
        tokensOut: out.tokensOut,
      };
    }

    const { object, usage } = await generateObject({
      model: getGateway().languageModel(modelId),
      schema: trendDossierShellOutputSchema,
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
 * dossier, always — derived verbatim from the item text and area name so
 * assertions can see the provenance. No network, no key (amendment A9
 * discipline).
 */
export function createFakeDossierDriver(): DossierDriver {
  return async (req) => {
    const subject = req.itemText.split(/\s+/).slice(0, 6).join(" ");
    const candidate = {
      titles: [
        `What "${subject}" means for ${req.areaName}`,
        `${req.areaName}: a practitioner's read on "${subject}"`,
        `Responding to ${req.account} on ${req.source}`,
      ],
      angles: [
        `practitioner how-to grounded in the item`,
        `implications for ${req.areaName}`,
      ],
      hook: `Here's why "${subject}" matters.`,
    };
    const tokens = req.itemText.split(/\s+/).filter(Boolean).length;
    return { candidate, tokensIn: tokens, tokensOut: 32 };
  };
}
