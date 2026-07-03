import { createGateway } from "@ai-sdk/gateway";
import { readEnv, type EnvSource } from "./env";

let cached: ReturnType<typeof createGateway> | null = null;

/**
 * This project's OWN AI-gateway wiring (provider-agnostic, v5 `createGateway`).
 * Lazy so the app boots and serves /api/health without a key; any generation
 * call without AI_GATEWAY_API_KEY fails loud with a pointer to .env.example.
 *
 * Every shell call must route through this wrapper so the per-tenant daily
 * budget check (usage_ledger, amendment A2) and tracing sit on ONE choke
 * point. The enforcement itself is `withGatewayGuard` (gateway-guard.ts),
 * generic over any gateway-touching call — B1.1's embeddings are the first
 * caller; the judge lane's generateObject-style calls are the next.
 */
export function getGateway(): ReturnType<typeof createGateway> {
  if (cached) return cached;
  const env = readEnv();
  if (!env.AI_GATEWAY_API_KEY) {
    throw new Error(
      "AI_GATEWAY_API_KEY is not set — copy apps/web/.env.example to apps/web/.env.local and fill it in.",
    );
  }
  cached = createGateway({
    apiKey: env.AI_GATEWAY_API_KEY,
    ...(env.AI_GATEWAY_BASE_URL ? { baseURL: env.AI_GATEWAY_BASE_URL } : {}),
  });
  return cached;
}

/**
 * Model tiers, env-overridable per deployment. The two-tier judge (B1.3) routes
 * per call: `judgeScreen` pre-screens every draft cheaply; `judgeFinal` (a
 * stronger model) is the FINAL gate; disagreement blocks the draft and queues
 * it for the operator. Never collapse the two onto one cheap model — the judge
 * is the safety mechanism (charter, ratified decision 2). `embedding` is B1.1's
 * tier (ingest's grounding-index embeddings).
 */
export function modelTiers(env?: EnvSource) {
  const e = readEnv(env);
  return {
    draft: e.MODEL_DRAFT,
    judgeScreen: e.MODEL_JUDGE_SCREEN,
    judgeFinal: e.MODEL_JUDGE_FINAL,
    embedding: e.MODEL_EMBEDDING,
  };
}
