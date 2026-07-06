import { NextResponse } from "next/server";
import { z } from "zod";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";
import { joinWaitlist } from "@/lib/waitlist/join";
import { checkRateLimit } from "@/lib/waitlist/rate-limit";

const joinRequestSchema = z.object({
  email: z
    .string()
    .max(254)
    .transform((s) => s.trim().toLowerCase())
    .pipe(z.email()),
  ref: z.string().min(1).max(64).optional(),
});

/** The landing page's one write path (B6.1) — thin per doctrine: limit, parse, delegate. */
export async function POST(request: Request) {
  // First proxy hop is the client IP on the deploy target; "unknown" pools
  // direct/local traffic into one bucket, which only ever over-limits.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limit = checkRateLimit(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many signups from this address — try again in a minute." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = joinRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  // Unseeded deployment — a service state, not a caller mistake (503, not 404).
  if (!ctx) {
    return NextResponse.json({ error: "The waitlist is not open yet." }, { status: 503 });
  }

  try {
    const result = await joinWaitlist(repos, ctx, parsed.data);
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
