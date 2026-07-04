import { generateObject } from "ai";
import type { PlatformProfile } from "@thalon/contracts";
import {
  getGateway,
  isClaudeCliModel,
  modelTiers,
  parseCandidateJson,
  runClaudeCliJson,
} from "@thalon/platform";
import { highlightSelectShellOutputSchema } from "../schemas";
import type { CandidateWindow } from "../windows";
import { readPromptFile } from "./prompt-file";

const PROMPT_FILE = "highlight-select.v1.md";

/** `prompt_version` recorded on the waterfall run and every `clip_plan` draft's `meta` (SPINE §3.2). */
export function highlightSelectPromptVersion(): string {
  return PROMPT_FILE.replace(/\.md$/, "");
}

export interface HighlightSelectRequest {
  platform: string;
  /** The full source transcript, for cross-window context. */
  sourceText: string;
  voice: Record<string, unknown>;
  platformProfile: PlatformProfile;
  /** Core-derived candidates (SPINE §1: the shell selects among these, it never invents new timing). Array position is the `windowIndex` clips are selected by. */
  candidateWindows: CandidateWindow[];
}

/** One driver invocation = one gateway call: the raw candidate plus its token spend. */
export interface HighlightSelectCall {
  candidate: unknown;
  tokensIn: number;
  tokensOut: number;
}

/**
 * The B2.3 highlight-select shell (SPINE §1: shell is read-only). This
 * module only ever RETURNS a candidate clip selection for one platform — it
 * never imports @thalon/db and never writes anywhere; the core caller
 * (../validate-shell-output.ts) validates the output against
 * highlightSelectShellOutputSchema and ../waterfall.ts is the one that
 * persists it via repos.drafts.create. Mirrors ../../fanout/shell/generator.ts.
 */
export type HighlightSelectDriver = (req: HighlightSelectRequest) => Promise<HighlightSelectCall>;

/**
 * The real driver: routes through this project's OWN gateway wiring
 * (getGateway/modelTiers) via `ai`'s generateObject against the Zod
 * boundary schema. Never called by tests (ground rule: keyless +
 * networkless) — only reached when a caller doesn't inject a driver and
 * AI_GATEWAY_API_KEY is set.
 */
export function gatewayHighlightSelectDriver(): HighlightSelectDriver {
  return async (req) => {
    const modelId = modelTiers().draft;
    const system = readPromptFile(PROMPT_FILE);
    const prompt = [
      `PLATFORM: ${req.platform}`,
      `VOICE: ${JSON.stringify(req.voice)}`,
      `PLATFORM PROFILE: ${JSON.stringify(req.platformProfile)}`,
      `CANDIDATE WINDOWS (select by windowIndex; never invent a new one):\n${JSON.stringify(
        req.candidateWindows.map((w, windowIndex) => ({
          windowIndex,
          startMs: w.startMs,
          endMs: w.endMs,
          durationMs: w.durationMs,
          text: w.text,
        })),
      )}`,
      `FULL TRANSCRIPT (context):\n${req.sourceText}`,
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
        prompt: `${prompt}\n\nReturn JSON: {"clips": [{"windowIndex": number, "hook": string, "captions": string, "platformCopy": string}]}`,
      });
      return {
        candidate: parseCandidateJson(out.text),
        tokensIn: out.tokensIn,
        tokensOut: out.tokensOut,
      };
    }

    const { object, usage } = await generateObject({
      model: getGateway().languageModel(modelId),
      schema: highlightSelectShellOutputSchema,
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
 * Deterministic fake for tests: selects every candidate window it's given,
 * always (identical request -> identical clips). No network, no
 * AI_GATEWAY_API_KEY required — this is what keeps every waterfall test
 * keyless and networkless.
 */
export function createFakeHighlightSelectDriver(): HighlightSelectDriver {
  return async (req) => {
    const clips = req.candidateWindows.map((window, windowIndex) => ({
      windowIndex,
      hook: `Hook: ${window.text.slice(0, 60)}`,
      captions: window.text,
      platformCopy: `[${req.platform}] ${window.text.slice(0, 200)}`,
    }));
    const tokens = clips.reduce(
      (sum, clip) => sum + clip.captions.split(/\s+/).filter(Boolean).length,
      0,
    );
    return { candidate: { clips }, tokensIn: tokens, tokensOut: tokens };
  };
}
