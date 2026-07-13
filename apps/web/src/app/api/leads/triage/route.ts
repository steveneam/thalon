import { NextResponse } from "next/server";
import { z } from "zod";
import { toErrorResponse } from "@/lib/http-errors";
import { triageLeads } from "@/lib/leads/service";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

const triageRequestSchema = z.object({
  action: z.enum(["dismiss", "pin", "unpin"]),
  ids: z.array(z.string().min(1)).min(1).max(500),
});

/**
 * The ONE triage door, single or bulk (FRONTEND §0). Every action lands as
 * a lead_triage eval row; a failing id never aborts the rest — the response
 * reports done/failed honestly.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = triageRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Send { action: dismiss|pin|unpin, ids: [leadId, …] }." },
      { status: 400 },
    );
  }
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) {
    return NextResponse.json({ error: "Set up your workspace profile first." }, { status: 503 });
  }
  try {
    return NextResponse.json(await triageLeads(ctx, repos, parsed.data.action, parsed.data.ids));
  } catch (err) {
    return toErrorResponse(err);
  }
}
