import { NextResponse } from "next/server";
import { parseStagedPickRequest, runStaged } from "@/lib/staged-flow/http";
import { pickStagedCandidate } from "@/lib/staged-flow/store";

/** B5.4 fake-driver seam: operator picks one of the stage's 2–3 candidates (see ../flow/route.ts). */
export async function POST(request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = parseStagedPickRequest(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const result = runStaged(() => pickStagedCandidate(draftId, parsed.request.candidateId));
  return NextResponse.json(result.body, { status: result.status });
}
