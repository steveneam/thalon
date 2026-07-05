import { NextResponse } from "next/server";
import { runStaged } from "@/lib/staged-flow/http";
import { getStagedFlow, StagedFlowError } from "@/lib/staged-flow/store";

/**
 * B5.4 fake-driver seam: the staged flow, anchored at any of its stage
 * drafts, served from the in-memory contract-shaped store (apps/web stays
 * engine-free — the architecture pin). Pass 3 swaps the store call for the
 * real staged pipeline behind this same endpoint.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  const result = runStaged(() => {
    const flow = getStagedFlow(draftId);
    if (!flow) throw new StagedFlowError(`draft "${draftId}" belongs to no staged flow`, 404);
    return flow;
  });
  return NextResponse.json(result.body, { status: result.status });
}
