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
import type { SourceDimsByRef } from "../derive";

const PROMPT_FILE = "edl-diff-propose.v2.md";

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
  /** Measured source dimensions per beat-lane ref (B-ve.7) — the crop-op bounds. Absent = crop ops are off the table, and the prompt says so. */
  dims?: SourceDimsByRef;
}

/**
 * The user-prompt context, as one pure string (exported so tests can pin
 * what the model actually sees). The EDL carries every clip's CURRENT crop;
 * the dims block carries the MEASURED bounds a proposed window must stay
 * inside — or an explicit "crop is off the table" when nothing was probed.
 */
export function edlDiffPromptContext(req: ProposeEdlDiffRequest): string {
  return [
    `EDL (the cut's complete build instruction — each video clip's current \`crop\`, if any, is in here):\n${JSON.stringify(req.edl, null, 2)}`,
    req.dims && Object.keys(req.dims).length > 0
      ? `MEASURED SOURCE DIMENSIONS (ffprobe, source pixels — every proposed crop window must stay inside its clip's source):\n${JSON.stringify(req.dims, null, 2)}`
      : "MEASURED SOURCE DIMENSIONS: none probed on this box — clip-crop ops are OFF the table; propose only caption/music ops.",
    req.ask?.trim()
      ? `OPERATOR ASK:\n${req.ask.trim()}`
      : "OPERATOR ASK: none — propose only what the editing doctrine says needs fixing, or nothing.",
  ].join("\n\n");
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
    const prompt = edlDiffPromptContext(req);

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
    const source = req.dims?.[req.edl.video[0]?.source.ref ?? ""];
    const candidate =
      source && /recenter|reframe|crop/i.test(req.ask ?? "")
        ? (() => {
            // Measured, deterministic: a centered half-width full-height
            // window of clip 0's probed source, the dims cited in the why.
            const width = Math.floor(source.width / 2 / 2) * 2;
            return {
              summary: `fake: recenter clip 0 for "${req.ask}"`,
              ops: [
                {
                  op: "clip-crop",
                  clip: 0,
                  crop: {
                    width,
                    height: source.height,
                    x: Math.round((source.width - width) / 2),
                    y: 0,
                  },
                  why: `fake driver: centered half-width window of the measured ${source.width}×${source.height} source`,
                },
              ],
            };
          })()
        : lines.length > 0
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
