import { NextResponse } from "next/server";
import { dismissTrendCard, IntelStoreError } from "@/lib/intel/store";

/**
 * Dismiss a trend card — operator signal, captured in the fake-driver store
 * as the payload shape pass 3 lands durably (dismiss → eval row, ADR 0005).
 */
export async function POST(_request: Request, { params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  try {
    return NextResponse.json({ capture: dismissTrendCard(cardId) });
  } catch (err) {
    if (err instanceof IntelStoreError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    }
    throw err;
  }
}
