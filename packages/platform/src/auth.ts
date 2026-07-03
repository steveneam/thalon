import { resolveSeams } from "./env";

export interface Operator {
  userId: string;
  source: "clerk" | "dev";
}

/**
 * Auth seam: dev (no Clerk keys → fixed local operator, zero cloud deps) →
 * clerk (both keys set). @clerk/nextjs stays a dependency of apps/web (it is
 * Next-bound: middleware/provider); this dynamic import resolves via the
 * workspace hoist and only ever runs when both keys are present. Enabling
 * Clerk also requires mounting clerkMiddleware in apps/web/src/proxy.ts
 * (Next 16 renamed middleware → proxy).
 */
export async function getOperator(): Promise<Operator | null> {
  const seams = resolveSeams();
  if (seams.auth === "clerk") {
    const { auth } = await import("@clerk/nextjs/server");
    const { userId } = await auth();
    return userId ? { userId, source: "clerk" } : null;
  }
  return { userId: "dev-operator", source: "dev" };
}
