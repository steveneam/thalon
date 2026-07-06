import { NextResponse } from "next/server";
import { IntelStoreError, resolveCreateContext } from "@/lib/intel/store";

/**
 * The context read door (wave-3 §3.3): Create resolves a capture id back
 * into the structured handoff. Lives as a ROUTE (not an RSC read) on
 * purpose — route handlers and server components are bundled in separate
 * layers, so only the route layer shares the fake-driver store instance
 * with the promote/dismiss/target writers.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ captureId: string }> }) {
  const { captureId } = await params;
  try {
    return NextResponse.json({ context: resolveCreateContext(captureId) });
  } catch (err) {
    if (err instanceof IntelStoreError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    }
    throw err;
  }
}
