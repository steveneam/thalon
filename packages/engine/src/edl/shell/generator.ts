import { generateObject } from "ai";
import { edlDiffSchema, type Edl } from "@thalon/contracts";
import {
  getGateway,
  isClaudeCliModel,
  modelTiers,
  parseCandidateJson,
  runClaudeCliJson,
} from "@thalon/platform";
import { readPromptFile } from "../../outreach/shell/prompt-file";

const PROMPT_FILE = "edl-diff-propose.v1.md";

/** `prompt_version` pinned into every proposal's attribution (SPINE §3.2). */
export function edlDiffPromptVersion(): string {
  return PROMPT_FILE.replace(/\.md$/, "");
}

/** The prompt file's text — the caller hashes it into the attribution pin. */
export function edlDiffPromptText(): string {
  return readPromptFile(PROMPT_FILE);
}

export interface ProposeEdlDiffRequest {
  /** The cut's parsed EDL — the complete edit surface the model reasons over. */
  edl: Edl;
  /** The operator's natural-language ask; absent = "look at this cut and propose what the doctrine says needs fixing". */
  ask?: string;
}

/** One driver invocation = one model call: the raw candidate plus its token spend. */
export interface EdlDiffCall {
  candidate: unknown;
  tokensIn: number;
  tokensOut: number;
}

/**
 * The EDL-diff shell (SPINE §1: shell is read-only). This module only ever
 * RETURNS a candidate diff — it never imports @thalon/db and never writes
 * anywhere; ../propose.ts validates the candidate against edlDiffSchema AND
 * dry-applies it to the target EDL before anything reaches the operator.
 * Mirrors ../../outreach/shell/generator.ts.
 */
export type EdlDiffDriver = (req: ProposeEdlDiffRequest) => Promise<EdlDiffCall>;

export function gatewayEdlDiffDriver(): EdlDiffDriver {
  return async (req) => {
    const modelId = modelTiers().draft;
    const system = edlDiffPromptText();
    const prompt = [
      `EDL (the cut's complete build instruction):\n${JSON.stringify(req.edl, null, 2)}`,
      req.ask?.trim()
        ? `OPERATOR ASK:\n${req.ask.trim()}`
        : "OPERATOR ASK: none — propose only what the editing doctrine says needs fixing, or nothing.",
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
        prompt: `${prompt}\n\nReturn JSON: {"summary": string, "ops": [...]}`,
      });
      return {
        candidate: parseCandidateJson(out.text),
        tokensIn: out.tokensIn,
        tokensOut: out.tokensOut,
      };
    }

    const { object, usage } = await generateObject({
      model: getGateway().languageModel(modelId),
      schema: edlDiffSchema,
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
 * diff, always. No network, no key — keeps every proposer test keyless.
 */
export function createFakeEdlDiffDriver(): EdlDiffDriver {
  return async (req) => {
    const lines = req.edl.captions?.lines ?? [];
    const candidate =
      lines.length > 0
        ? {
            summary: `fake: nudge line 0 for "${req.ask ?? "no ask"}"`,
            ops: [
              {
                op: "caption-move",
                line: 0,
                x: lines[0].x,
                y: lines[0].y - 8,
                why: "fake driver: 8px up, deterministic",
              },
            ],
          }
        : {
            summary: "fake: no captions — ease the music tail",
            ops: [
              {
                op: "music-align",
                cue: 0,
                fadeOut: { start: Math.max(0, req.edl.output.duration - 1.275), duration: 1.275 },
                why: "fake driver: standard tail ease",
              },
            ],
          };
    const tokens = JSON.stringify(req.edl).length / 4;
    return { candidate, tokensIn: Math.ceil(tokens), tokensOut: 64 };
  };
}
