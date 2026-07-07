import { readEnv } from "@thalon/platform";
import { NextResponse, type NextRequest } from "next/server";
import { gateRequest } from "@/lib/auth/gate";

/**
 * B6.7 workspace auth gate (ADR 0007 decision 4, invariant): app-level
 * basic auth over every non-public route — the landing, blog, feeds,
 * health, and the waitlist POST stay public; /app, /approve, /brand, and
 * the rest of /api do not. Living IN the app (not only at a host's edge)
 * keeps the invariant true on any deployment, including the Vercel swap
 * path; the box's edge auth stacks on top during stealth staging as
 * defense in depth. Decision logic is pure and lives in lib/auth/gate.ts.
 */
export function proxy(request: NextRequest) {
  const decision = gateRequest({
    pathname: request.nextUrl.pathname,
    authorization: request.headers.get("authorization"),
    credential: readEnv().WORKSPACE_BASIC_AUTH,
    // NODE_ENV is Next's own, deliberately not in the platform env schema
    // (the lib/site.ts precedent for out-of-schema reads).
    production: process.env.NODE_ENV === "production",
  });
  if (decision.action === "allow") return NextResponse.next();
  if (decision.action === "unavailable") {
    return new NextResponse(
      "Workspace auth is not configured on this deployment (WORKSPACE_BASIC_AUTH) — the workspace fails closed, never open.",
      { status: 503 },
    );
  }
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "www-authenticate": 'Basic realm="Thalon workspace", charset="UTF-8"' },
  });
}

export const config = {
  // Static assets skip the gate entirely; everything else reaches
  // gateRequest, whose public list is a closed allowlist (a new route is
  // gated by default).
  matcher: ["/((?!_next/|favicon\\.ico|icon\\.svg|opengraph-image).*)"],
};
