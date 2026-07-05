import { NextResponse } from "next/server";
import { runStaged } from "@/lib/staged-flow/http";
import { advanceStagedFlow } from "@/lib/staged-flow/store";

/**
 * B5.4 fake-driver seam: generate the next stage's candidates (see
 * ../flow/route.ts). The structural gate holds here exactly as in the
 * engine: a stage advances only from a queued/approved draft — the store
 * refuses (409) otherwise, and the final stage refuses always (export is
 * deterministic core, never a stage).
 */
export async function POST(_request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  const result = runStaged(() => advanceStagedFlow(draftId));
  return NextResponse.json(result.body, { status: result.status });
}
