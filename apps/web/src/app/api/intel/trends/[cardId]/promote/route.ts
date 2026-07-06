import { NextResponse } from "next/server";
import { IntelStoreError, promoteTrendCard } from "@/lib/intel/store";

/** "Generate from this": promote capture + the prompt seed the Create surface receives. */
export async function POST(_request: Request, { params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  try {
    const { capture, promptSeed } = promoteTrendCard(cardId);
    return NextResponse.json({
      capture,
      createHref: `/app/create?prompt=${encodeURIComponent(promptSeed)}`,
    });
  } catch (err) {
    if (err instanceof IntelStoreError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    }
    throw err;
  }
}
