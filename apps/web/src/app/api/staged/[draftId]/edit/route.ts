import { NextResponse } from "next/server";
import { parseStagedEditRequest, runStaged } from "@/lib/staged-flow/http";
import { applyStagedEdit } from "@/lib/staged-flow/store";

/**
 * B5.4 fake-driver seam: one operator interaction, one verbatim RFC-6902
 * patch, one captured edit_diff row (see ../flow/route.ts). In pass 3 this
 * is where the capture lands through the existing path — approvals.record
 * (edit_diffs + eval_cases, one transaction) with the patch as the diff
 * payload — and the real judge lane re-gates the stage draft.
 */
export async function POST(request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = parseStagedEditRequest(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const result = runStaged(() => applyStagedEdit(draftId, parsed.request));
  return NextResponse.json(result.body, { status: result.status });
}
