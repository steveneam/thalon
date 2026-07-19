import { generateObject } from "ai";
import { parseDirectionMd } from "@thalon/contracts";
import {
  getGateway,
  isClaudeCliModel,
  modelTiers,
  parseCandidateJson,
  runClaudeCliJson,
} from "@thalon/platform";
import {
  directionPolishShellOutputSchema,
  directionScenesShellOutputSchema,
  storyboardStageShellOutputSchema,
} from "../schemas";
import { readPromptFile } from "./prompt-file";

/**
 * The B5.2 staged-video shells (SPINE §1: shell is read-only). Each driver
 * only ever RETURNS a candidate — it never imports @thalon/db and never
 * writes anywhere; ../validate-shell-output.ts validates against the stage
 * boundary schema and ../../pipeline/staged-video.ts is what persists.
 * Mirrors ../../origination/shell/generator.ts.
 *
 * Prompt files are named by the stage plan's `promptSlug`
 * (@thalon/contracts stage-registry) — the slug IS the prompt_version
 * recorded on runs and drafts, so a prompt edit is a version bump is a new
 * generation key.
 */

/** One driver invocation = one gateway call: the raw candidate plus its token spend. */
export interface StageShellCall {
  candidate: unknown;
  tokensIn: number;
  tokensOut: number;
}

export interface StoryboardStageRequest {
  /** The operator's brief — topic and angle only, never a source of facts. */
  operatorPrompt: string;
  voice: Record<string, unknown>;
  identityBlock?: string;
  groundingText: string;
}
export type StoryboardStageDriver = (req: StoryboardStageRequest) => Promise<StageShellCall>;

export interface DirectionScenesRequest {
  /** The PREFILLED direction document, rendered as strict direction.md — the model-facing representation IS the wire format. */
  prefilledMd: string;
  /** Storyboard visual hints, by sceneIndex — operator/structure guidance for the creative fill. */
  visualHints: { sceneIndex: number; hint: string }[];
  voice: Record<string, unknown>;
  identityBlock?: string;
}
export type DirectionScenesDriver = (req: DirectionScenesRequest) => Promise<StageShellCall>;

export interface DirectionPolishRequest {
  /** The CURRENT direction document as strict direction.md. */
  currentMd: string;
  voice: Record<string, unknown>;
  identityBlock?: string;
  groundingText: string;
}
export type DirectionPolishDriver = (req: DirectionPolishRequest) => Promise<StageShellCall>;

function promptFileFor(promptSlug: string): string {
  return `${promptSlug}.md`;
}

/**
 * The 0-based/1-based bridge, stated where the JSON contract is stated:
 * direction.md numbers scenes for humans ("## Scene 1"), the schema wants
 * machine sceneIndex. Every scenes-bearing stage prompt carries this rule —
 * without it, models echo the document numbering (proven twice, s66).
 */
const SCENE_INDEXING_RULE =
  'INDEXING RULE: "sceneIndex" is ZERO-BASED. The document heading "Scene 1" is sceneIndex 0, "Scene 2" is sceneIndex 1, and the last "Scene N" is sceneIndex N-1. Cover every scene exactly once with these exact indices.';

const identityLines = (identityBlock?: string): string[] =>
  identityBlock
    ? [`BRAND IDENTITY (operator-asserted, judge-grounded):\n${identityBlock}`]
    : [];

/**
 * Real structure-stage driver: routes through this project's OWN gateway
 * wiring via `ai`'s generateObject against the Zod boundary schema. Never
 * called by tests (ground rule: keyless + networkless).
 */
export function gatewayStoryboardStageDriver(promptSlug: string): StoryboardStageDriver {
  return async (req) => {
    const modelId = modelTiers().draft;
    const system = readPromptFile(promptFileFor(promptSlug));
    const prompt = [
      `OPERATOR PROMPT: ${req.operatorPrompt}`,
      `VOICE: ${JSON.stringify(req.voice)}`,
      ...identityLines(req.identityBlock),
      `GROUNDING SOURCES (judge-grounded — the only other material you may draw factual claims from):\n${req.groundingText}`,
    ].join("\n\n");

    // Dev-only transport (see @thalon/platform claude-cli.ts): build/test
    // tiers may route through the local Claude Code CLI — runtime config
    // only. Same prompt file, same Zod boundary downstream.
    if (isClaudeCliModel(modelId)) {
      const out = await runClaudeCliJson({
        model: modelId,
        system,
        prompt: `${prompt}\n\nReturn JSON: {"title": string, "scenes": [{"heading": string, "narration": string, "onScreenText"?: string, "visualHint"?: string, "durationHintMs"?: number}], "cta"?: string}`,
      });
      return { candidate: parseCandidateJson(out.text), tokensIn: out.tokensIn, tokensOut: out.tokensOut };
    }

    const { object, usage } = await generateObject({
      model: getGateway().languageModel(modelId),
      schema: storyboardStageShellOutputSchema,
      system,
      prompt,
    });
    return { candidate: object, tokensIn: usage.inputTokens ?? 0, tokensOut: usage.outputTokens ?? 0 };
  };
}

export function gatewayDirectionScenesDriver(promptSlug: string): DirectionScenesDriver {
  return async (req) => {
    const modelId = modelTiers().draft;
    const system = readPromptFile(promptFileFor(promptSlug));
    // sceneIndex is 0-BASED while direction.md's headings are 1-based
    // ("## Scene 1"). Render hints by sceneIndex and state the mapping
    // outright — without it, models echo the 1-based document numbering
    // (both llama-3.3 and sonnet-4.5 did, s66: missing [0], unknown [N]).
    const hints = req.visualHints
      .map((h) => `- sceneIndex ${h.sceneIndex} (document "Scene ${h.sceneIndex + 1}"): ${h.hint}`)
      .join("\n");
    const prompt = [
      `PREFILLED DIRECTION DOCUMENT (strict direction.md — deterministic fields are pinned):\n${req.prefilledMd}`,
      ...(hints ? [`VISUAL HINTS (structure-stage guidance):\n${hints}`] : []),
      SCENE_INDEXING_RULE,
      `VOICE: ${JSON.stringify(req.voice)}`,
      ...identityLines(req.identityBlock),
    ].join("\n\n");

    if (isClaudeCliModel(modelId)) {
      const out = await runClaudeCliJson({
        model: modelId,
        system,
        prompt: `${prompt}\n\nReturn JSON: {"scenes": [{"sceneIndex": number, "visual": string, "motion": "smooth"|"snappy"|"bouncy"|"dramatic", "onScreenText": string|null}]}`,
      });
      return { candidate: parseCandidateJson(out.text), tokensIn: out.tokensIn, tokensOut: out.tokensOut };
    }

    const { object, usage } = await generateObject({
      model: getGateway().languageModel(modelId),
      schema: directionScenesShellOutputSchema,
      system,
      prompt,
    });
    return { candidate: object, tokensIn: usage.inputTokens ?? 0, tokensOut: usage.outputTokens ?? 0 };
  };
}

export function gatewayDirectionPolishDriver(promptSlug: string): DirectionPolishDriver {
  return async (req) => {
    const modelId = modelTiers().draft;
    const system = readPromptFile(promptFileFor(promptSlug));
    const prompt = [
      `CURRENT DIRECTION DOCUMENT (strict direction.md — aspect/fps/pacing and the scene set are pinned):\n${req.currentMd}`,
      SCENE_INDEXING_RULE,
      `VOICE: ${JSON.stringify(req.voice)}`,
      ...identityLines(req.identityBlock),
      `GROUNDING SOURCES (judge-grounded — the only material narration claims may come from):\n${req.groundingText}`,
    ].join("\n\n");

    if (isClaudeCliModel(modelId)) {
      const out = await runClaudeCliJson({
        model: modelId,
        system,
        prompt: `${prompt}\n\nReturn JSON: {"title": string, "cta": string|null, "scenes": [{"sceneIndex": number, "heading": string, "narration": string, "onScreenText": string|null, "visual": string, "motion": "smooth"|"snappy"|"bouncy"|"dramatic", "durationMs": number}]}`,
      });
      return { candidate: parseCandidateJson(out.text), tokensIn: out.tokensIn, tokensOut: out.tokensOut };
    }

    const { object, usage } = await generateObject({
      model: getGateway().languageModel(modelId),
      schema: directionPolishShellOutputSchema,
      system,
      prompt,
    });
    return { candidate: object, tokensIn: usage.inputTokens ?? 0, tokensOut: usage.outputTokens ?? 0 };
  };
}

/**
 * Deterministic fakes: identical request -> identical candidate, always.
 * No network, no AI_GATEWAY_API_KEY — what keeps every staged-video test
 * keyless and networkless.
 */
export function createFakeStoryboardStageDriver(): StoryboardStageDriver {
  return async (req) => {
    const topic = req.operatorPrompt.slice(0, 60);
    const grounding = req.groundingText.slice(0, 120);
    const candidate = {
      title: `Video: ${topic}`,
      scenes: [
        {
          heading: "Hook",
          narration: `Here is the one thing to know about ${topic}`.slice(0, 200),
          onScreenText: "One thing",
        },
        {
          heading: "Grounded point",
          narration: `First: ${grounding}`.slice(0, 200),
          visualHint: "show the product surface this claim comes from",
        },
        { heading: "So what", narration: "Finally, what this means in practice." },
      ],
      cta: undefined,
    };
    const tokens = req.operatorPrompt.split(/\s+/).filter(Boolean).length;
    return { candidate, tokensIn: tokens, tokensOut: tokens };
  };
}

export function createFakeDirectionScenesDriver(): DirectionScenesDriver {
  return async (req) => {
    // The fake reads the SAME representation the real model sees — the
    // strict md — proving the request wiring end-to-end, deterministically.
    const doc = parseDirectionMd(req.prefilledMd);
    const hintByIndex = new Map(req.visualHints.map((h) => [h.sceneIndex, h.hint]));
    const candidate = {
      scenes: doc.scenes.map((scene) => ({
        sceneIndex: scene.sceneIndex,
        visual: hintByIndex.get(scene.sceneIndex) ?? `Show: ${scene.heading}`,
        motion: scene.sceneIndex === 0 ? "snappy" : "smooth",
        onScreenText: scene.onScreenText,
      })),
    };
    const tokens = doc.scenes.length;
    return { candidate, tokensIn: tokens, tokensOut: tokens };
  };
}

export function createFakeDirectionPolishDriver(): DirectionPolishDriver {
  return async (req) => {
    // Identity polish: returns the document unchanged — predictable bodies
    // for idempotency/key tests; a real polish varies, a fake must not.
    const doc = parseDirectionMd(req.currentMd);
    const candidate = {
      title: doc.title,
      cta: doc.cta,
      scenes: doc.scenes.map((scene) => ({
        sceneIndex: scene.sceneIndex,
        heading: scene.heading,
        narration: scene.narration,
        onScreenText: scene.onScreenText,
        visual: scene.visual ?? `Show: ${scene.heading}`,
        motion: scene.motion,
        durationMs: scene.durationMs,
      })),
    };
    const tokens = doc.scenes.length;
    return { candidate, tokensIn: tokens, tokensOut: tokens };
  };
}
