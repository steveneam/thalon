import { NextResponse } from "next/server";
import { z } from "zod";
import { recordCapture } from "@/lib/intel/captures";
import { targetSearchQuery } from "@/lib/intel/store";

const bodySchema = z.object({
  query: z.string().min(1).max(300),
  family: z.enum(["post", "video", "page"]).optional(),
});

/**
 * "Target this" on a horizon card: capture the operator's pick and hand
 * Create the capture id (wave-3 §3.3 — the same context spine as promote).
 * Family defaults to "page" — a keyword target's natural destination — and
 * stays changeable on Create.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A query to target is required." }, { status: 400 });
  }
  const capture = await recordCapture(targetSearchQuery(parsed.data.query, parsed.data.family));
  return NextResponse.json({
    capture,
    createHref: `/app/create?ctx=${encodeURIComponent(capture.id)}`,
  });
}
