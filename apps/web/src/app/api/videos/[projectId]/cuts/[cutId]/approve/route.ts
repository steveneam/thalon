import { NextResponse } from "next/server";
import { CUT_CAPTION_GATE, runCutCaptionGate } from "@thalon/judge";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";
import { getCutDetail } from "@/lib/videos/queries";

/**
 * B-ve.4 approve door (ADR 0010 invariant): rendered → approved, behind the
 * judge gate. Every text layer of the cut's EDL passes the G1 denylist lens
 * (per-tenant denylist as DATA from the active brand profile) BEFORE the
 * repo transition fires; a red verdict refuses 422 with the verbatim
 * per-line matches and changes nothing. The repo door demands the green
 * receipt, which lands in the video_cut.approved event — every approval
 * says what vouched for it.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; cutId: string }> },
) {
  const { projectId, cutId } = await params;
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return NextResponse.json({ error: "tenant not found" }, { status: 404 });
  try {
    const cut = await getCutDetail(repos, ctx, projectId, cutId);
    if (!cut) return NextResponse.json({ error: "video cut not found" }, { status: 404 });

    const profile = await repos.brandProfiles.getActive(ctx);
    const denylist = (profile?.denylist as string[] | undefined) ?? [];
    const gate = runCutCaptionGate(cut.edl, denylist);
    if (gate.verdict === "fail") {
      return NextResponse.json(
        {
          error: `judge gate ${CUT_CAPTION_GATE} refused ${gate.failures.length} of ${gate.lines} caption line(s)`,
          failures: gate.failures,
        },
        { status: 422 },
      );
    }

    await repos.videoCuts.approve(ctx, cutId, {
      gate: CUT_CAPTION_GATE,
      verdict: "pass",
      lines: gate.lines,
    });
    const detail = await getCutDetail(repos, ctx, projectId, cutId);
    return NextResponse.json({ cut: detail });
  } catch (err) {
    return toErrorResponse(err);
  }
}
