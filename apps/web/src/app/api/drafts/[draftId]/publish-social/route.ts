import { NextResponse } from "next/server";
import { socialPlatformSchema } from "@thalon/contracts";
import { publishApprovedSocial } from "@/lib/approve-queue/actions";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * s67: publish an APPROVED post-family draft to ONE social platform — the
 * post loop's operator door. Thin wiring over `publishApprovedSocial`
 * (lib/approve-queue/actions.ts): the engine door owns every refusal rung
 * and the ledger write; a refusal surfaces as a typed 409 naming exactly
 * what is missing (arming pair, social block, cap, duplicate). One call =
 * at most one platform post — cross-posting is one explicit call per
 * platform, mirroring the per-platform approval doctrine.
 */
export async function POST(request: Request, { params }: { params: Promise<{ draftId: string }> }) {
  const { draftId } = await params;
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) return NextResponse.json({ error: "tenant not found" }, { status: 404 });
  const body: unknown = await request.json().catch(() => ({}));
  const rawPlatform =
    typeof body === "object" && body !== null ? (body as { platform?: unknown }).platform : undefined;
  const parsed = socialPlatformSchema.safeParse(rawPlatform);
  if (!parsed.success) {
    return NextResponse.json(
      { error: `"platform" must be one of: ${socialPlatformSchema.options.join(", ")}` },
      { status: 400 },
    );
  }
  try {
    const result = await publishApprovedSocial(repos, ctx, draftId, parsed.data, new Date());
    return NextResponse.json({ publication: result.publication });
  } catch (err) {
    return toErrorResponse(err);
  }
}
