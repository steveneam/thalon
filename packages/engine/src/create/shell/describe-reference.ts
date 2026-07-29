import { isStoredRef } from "@thalon/contracts";
import {
  getContentAddressed,
  getGateway,
  getObjectStore,
  isClaudeCliModel,
  modelTiers,
  type ObjectStore,
} from "@thalon/platform";
import { generateObject } from "ai";
import { z } from "zod";
import { pinnedAssetKey } from "../../assets/pin";
import type { ReferenceVisionOutput, ReferenceVisionRequest } from "../reference";
import { readPromptFile } from "./prompt-file";

const PROMPT_FILE = "create-describe-reference.v1.md";

/** `prompt_version` for the describe call (SPINE §3.2). */
export function describeReferencePromptVersion(): string {
  return PROMPT_FILE.replace(/\.md$/, "");
}

/** The prompt file's text. */
export function describeReferencePromptText(): string {
  return readPromptFile(PROMPT_FILE);
}

/**
 * The shape the model must return — the same two fields the seam already
 * renders (`renderReferenceNotes`), validated at the boundary so a shell
 * that free-associates cannot reach the prompt block.
 */
export const referenceVisionOutputSchema = z.strictObject({
  style: z.string().min(1),
  subject: z.string().min(1),
});

/** One driver invocation = one model call: the description plus its token spend (the `EdlDiffCall` convention). */
export interface ReferenceVisionCall {
  output: ReferenceVisionOutput;
  tokensIn: number;
  tokensOut: number;
}

/**
 * The reference-describe shell (SPINE §1: shell is read-only). It reads
 * bytes from the object store and returns text. It never imports
 * `@thalon/db`, never writes anywhere, and — the point of the whole seam —
 * the bytes it reads never leave this module: only the two description
 * fields do. Core (`../reference.ts`) meters this behind `withGatewayGuard`
 * under `create.describe_reference`, exactly as every other family's core
 * meters its own shell.
 */
export type ReferenceVisionCallDriver = (
  request: ReferenceVisionRequest,
) => Promise<ReferenceVisionCall>;

export interface GatewayReferenceVisionDeps {
  /** Where stored bytes come from. Defaults to the configured store; injectable so a test can drive the real driver against a local fixture without a gateway key. */
  store?: ObjectStore;
}

/** Stored image extensions → the IANA type the AI SDK's image part carries. */
const MEDIA_TYPES: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  png: "image/png",
};

/**
 * The live describer: a gateway vision call over the reference's own bytes.
 *
 * THREE REFUSALS, all thrown with the sentence an operator needs, because
 * `describeReference` turns a throw into "reference attached, not yet
 * analysed — <reason>" (spec Error Behavior: degradation is honest and
 * non-blocking). Refusing here rather than returning a plausible description
 * is the whole discipline — a description of an image the model never saw is
 * the fabricated-default failure wearing a new coat.
 *
 *  1. A `claude-cli/*` vision tier. That dev transport (platform/claude-cli)
 *     takes system + prompt TEXT and has no image channel, so the call would
 *     succeed and describe nothing. It is refused by name.
 *  2. Bytes that are missing from the store.
 *  3. Bytes that fail their content address — `getContentAddressed` throws
 *     `ContentAddressMismatchError` and this does not catch it: describing
 *     bytes that no longer hash to the key naming them would put a rotted or
 *     tampered object's description into a prompt.
 *
 * External and audio-family refs never reach here — core refuses them before
 * the guard, so they cost neither a budget assertion nor a call.
 */
export function gatewayReferenceVisionDriver(
  deps: GatewayReferenceVisionDeps = {},
): ReferenceVisionCallDriver {
  return async (request) => {
    const modelId = modelTiers().vision;
    if (isClaudeCliModel(modelId)) {
      throw new Error(
        `MODEL_VISION is set to "${modelId}", a claude-cli transport that carries text only — it cannot be handed an image. Set MODEL_VISION to a gateway model whose tier accepts image input.`,
      );
    }
    const { ref } = request;
    if (!isStoredRef(ref)) {
      // Unreachable through `describeReference` (core refuses external refs
      // first). Loud rather than absent: a future caller reaching the driver
      // directly must not get a description of a URL nobody fetched.
      throw new Error("the reference describer reads stored bytes only — external refs are not fetched");
    }

    const store = deps.store ?? getObjectStore();
    const key = pinnedAssetKey(ref.sha256, ref.ext);
    const bytes = await getContentAddressed(store, key);
    if (!bytes) {
      throw new Error(`reference bytes are not in the object store (${key})`);
    }

    const { object, usage } = await generateObject({
      model: getGateway().languageModel(modelId),
      schema: referenceVisionOutputSchema,
      system: describeReferencePromptText(),
      messages: [
        {
          role: "user",
          content: [
            { type: "image", image: bytes, mediaType: MEDIA_TYPES[ref.ext] },
            {
              type: "text",
              text: request.alt
                ? `The operator labelled this reference: "${request.alt}". Use it as context; describe what you actually see.`
                : "The operator gave this reference no label. Describe what you see.",
            },
          ],
        },
      ],
    });

    return {
      output: object,
      tokensIn: usage.inputTokens ?? 0,
      tokensOut: usage.outputTokens ?? 0,
    };
  };
}

/**
 * Deterministic fake at the CALL level (the fake at the seam level stays
 * `createFakeReferenceVisionDriver` in ../reference.ts). This one exists so
 * the metering path — guard, budget, usage rows — can be exercised end to
 * end with token counts and without a key.
 */
export function createFakeReferenceVisionCallDriver(
  tokens: { tokensIn?: number; tokensOut?: number } = {},
): ReferenceVisionCallDriver {
  return async ({ ref, alt }) => ({
    output: {
      style: `flat studio light, centred composition (${
        isStoredRef(ref) ? `stored ${ref.ext}` : "external"
      })`,
      subject: alt ?? "an unlabelled product photograph",
    },
    tokensIn: tokens.tokensIn ?? 512,
    tokensOut: tokens.tokensOut ?? 64,
  });
}
