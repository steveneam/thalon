import { NextResponse } from "next/server";
import { resolveCaptureContext } from "@/lib/intel/captures";
import { IntelStoreError } from "@/lib/intel/store";

/**
 * The context read door (wave-3 §3.3): Create resolves a capture id back
 * into the structured handoff. s102 seated the capture spine durably, so this
 * answers from `intel_captures` — a `?ctx=` link an operator sat on across a
 * restart resolves to the capture they actually made, and an id that really
 * is gone gets an honest 404 rather than someone else's pick. It stays a
 * ROUTE (not an RSC read) because the fallback seat, which still answers for
 * an unseeded tenant, is per-bundle-layer state.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ captureId: string }> }) {
  const { captureId } = await params;
  try {
    return NextResponse.json({ context: await resolveCaptureContext(captureId) });
  } catch (err) {
    if (err instanceof IntelStoreError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    }
    throw err;
  }
}
