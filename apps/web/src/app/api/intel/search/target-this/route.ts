import { NextResponse } from "next/server";
import { z } from "zod";
import { targetSearchQuery } from "@/lib/intel/store";

const bodySchema = z.object({ query: z.string().min(1).max(300) });

/** "Target this" on a horizon card: capture the operator's pick and hand the query to Create as context. */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A query to target is required." }, { status: 400 });
  }
  const { capture, promptSeed } = targetSearchQuery(parsed.data.query);
  return NextResponse.json({
    capture,
    createHref: `/app/create?keyword=${encodeURIComponent(promptSeed)}`,
  });
}
