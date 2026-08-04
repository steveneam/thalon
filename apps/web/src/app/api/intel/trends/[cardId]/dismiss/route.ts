import { NextResponse } from "next/server";
import { recordCapture } from "@/lib/intel/captures";
import { findLiveTrendCard } from "@/lib/intel/live";
import { dismissTrendCard, IntelStoreError } from "@/lib/intel/store";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * Dismiss a trend card — operator signal. B6.5: the card resolves
 * LIVE-first (the persisted sweep bundle), falling back to the demo
 * dataset — one capture door either way. B6.7 landed the durable half
 * (dismiss → eval row, carried from ADR 0005): a LIVE dismissal writes an
 * `intel_dismiss` eval_cases row (repo mechanism, audited) carrying the
 * card's scoring context, so intel triage feeds the same learning spine as
 * operator edits. Demo-card dismissals stay in-memory — synthetic signal
 * must never enter the eval corpus.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  try {
    const repos = await getRepos();
    const ctx = await resolveTenantCtx(repos);
    const liveCard = ctx ? await findLiveTrendCard(ctx.tenantId, cardId) : null;
    const capture = await recordCapture(dismissTrendCard(liveCard ?? cardId));
    if (liveCard && ctx) {
      const evalCase = await repos.evalCases.recordIntelDismiss(ctx, {
        kind: "trend_dismiss",
        input: {
          source: liveCard.source,
          externalId: liveCard.externalId,
          areaName: liveCard.areaName,
          score: liveCard.score,
          reasons: liveCard.reasons,
          text: liveCard.text,
          url: liveCard.url ?? null,
        },
        sourceRef: liveCard.id,
      });
      return NextResponse.json({ capture, evalCaseId: evalCase.id });
    }
    return NextResponse.json({ capture });
  } catch (err) {
    if (err instanceof IntelStoreError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    }
    throw err;
  }
}
