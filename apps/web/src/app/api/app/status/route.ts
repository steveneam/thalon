import { NextResponse } from "next/server";
import { readEnv, resolveSeams } from "@thalon/platform";
import type { WorkspaceStatus } from "@/lib/workspace/types";

/**
 * Seam-status readout (docs/FRONTEND.md §3 dashboard): the doctor's
 * internals as a card — which driver each env choke-point seam selected,
 * models, budget. Read-only display of resolveSeams()/readEnv(); NAMES only,
 * never key material (resolveSeams already reduces keys to
 * configured/unconfigured).
 */
export async function GET() {
  const env = readEnv();
  const seams = resolveSeams();
  const status: WorkspaceStatus = {
    seams,
    drivers: {
      render: env.RENDER_DRIVER,
      transcript: env.TRANSCRIPT_PROVIDER,
      searchIntel: env.SEARCH_INTEL_SOURCE,
    },
    models: {
      draft: env.MODEL_DRAFT,
      judgeScreen: env.MODEL_JUDGE_SCREEN,
      judgeFinal: env.MODEL_JUDGE_FINAL,
      embedding: env.MODEL_EMBEDDING,
    },
    budget: { tenantDailyTokens: env.TENANT_DAILY_TOKEN_BUDGET },
    tenantSlug: env.DEMO_TENANT_SLUG,
  };
  return NextResponse.json(status);
}
