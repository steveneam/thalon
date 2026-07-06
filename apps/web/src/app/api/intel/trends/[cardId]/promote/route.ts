import { NextResponse } from "next/server";
import { z } from "zod";
import { IntelStoreError, promoteTrendCard } from "@/lib/intel/store";

const bodySchema = z.object({
  family: z.enum(["post", "video", "page"]),
  titleIndex: z.number().int().min(0).optional(),
  angleIndex: z.number().int().min(0).optional(),
});

/**
 * A per-family exit on a trend card (wave-3 §3): the promote capture carries
 * the full dossier context; Create receives the CAPTURE ID and resolves it —
 * never a retyped prompt string.
 */
export async function POST(request: Request, { params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A target family (post · video · page) is required." },
      { status: 400 },
    );
  }
  try {
    const { capture } = promoteTrendCard(cardId, parsed.data);
    return NextResponse.json({
      capture,
      createHref: `/app/create?ctx=${encodeURIComponent(capture.id)}`,
    });
  } catch (err) {
    if (err instanceof IntelStoreError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    }
    throw err;
  }
}
