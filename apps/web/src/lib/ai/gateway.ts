import { createGateway } from "@ai-sdk/gateway";

let cached: ReturnType<typeof createGateway> | null = null;

/**
 * This project's OWN AI-gateway wiring (provider-agnostic, v5 `createGateway`).
 * Lazy so the app boots and serves /api/health without a key; any generation
 * call without AI_GATEWAY_API_KEY fails loud with a pointer to .env.example.
 */
export function getGateway(): ReturnType<typeof createGateway> {
  if (cached) return cached;
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    throw new Error(
      "AI_GATEWAY_API_KEY is not set — copy apps/web/.env.example to apps/web/.env.local and fill it in.",
    );
  }
  const baseURL = process.env.AI_GATEWAY_BASE_URL;
  cached = createGateway({ apiKey, ...(baseURL ? { baseURL } : {}) });
  return cached;
}

/**
 * Model tiers, env-overridable per deployment. The two-tier judge (B1.3) routes
 * per call: `judgeScreen` pre-screens every draft cheaply; `judgeFinal` (a
 * stronger model) is the FINAL gate; disagreement blocks the draft and queues
 * it for the operator. Never collapse the two onto one cheap model — the judge
 * is the safety mechanism (charter, ratified decision 2).
 */
export function modelTiers() {
  return {
    draft: process.env.MODEL_DRAFT ?? "meta/llama-3.3-70b",
    judgeScreen: process.env.MODEL_JUDGE_SCREEN ?? "meta/llama-3.3-70b",
    judgeFinal: process.env.MODEL_JUDGE_FINAL ?? "anthropic/claude-sonnet-4.5",
  };
}
