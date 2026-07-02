import { resolveSeams } from "@/lib/env";

export interface Operator {
  userId: string;
  source: "clerk" | "dev";
}

/**
 * Auth seam: dev (no Clerk keys → fixed local operator, zero cloud deps) →
 * clerk (both keys set). Enabling Clerk also requires mounting clerkMiddleware
 * in src/proxy.ts (Next 16 renamed middleware → proxy); until then only the
 * dev branch runs, so @clerk/nextjs is never imported without its keys.
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
