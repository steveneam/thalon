import { NextResponse } from "next/server";
import { findLiveTrendCard } from "@/lib/intel/live";
import { dismissTrendCard, IntelStoreError } from "@/lib/intel/store";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * Dismiss a trend card — operator signal, captured as the payload shape the
 * eval-row door lands durably (dismiss → eval row, ADR 0005). B6.5: the
 * card resolves LIVE-first (the persisted sweep bundle), falling back to
 * the demo dataset — one capture door either way.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  try {
    const repos = await getRepos();
    const ctx = await resolveTenantCtx(repos);
    const liveCard = ctx ? await findLiveTrendCard(ctx.tenantId, cardId) : null;
    return NextResponse.json({ capture: dismissTrendCard(liveCard ?? cardId) });
  } catch (err) {
    if (err instanceof IntelStoreError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    }
    throw err;
  }
}
