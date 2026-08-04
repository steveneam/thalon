import { NextResponse } from "next/server";
import { z } from "zod";
import { toErrorResponse } from "@/lib/http-errors";
import { recordCapture } from "@/lib/intel/captures";
import { promoteLead } from "@/lib/intel/store";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

// Lead cards are the ONE exit that also offers "email" (B-crm.4 front half):
// outreach composes from a lead's context, so trend/search promotes stay 3-family.
const promoteRequestSchema = z.object({
  id: z.string().min(1),
  family: z.enum(["post", "video", "page", "email"]),
});

/**
 * A per-family exit on a lead card: the CRM's gathered context becomes a
 * capture the Create surface resolves — the SAME handoff spine as intel
 * promotes (context flows forward, never retyped). Returns the Create href.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = promoteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Send { id, family: post|video|page|email }." }, { status: 400 });
  }
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) {
    return NextResponse.json({ error: "Set up your workspace profile first." }, { status: 503 });
  }
  try {
    const lead = await repos.leads.get(ctx, parsed.data.id);
    if (!lead) {
      return NextResponse.json({ error: `lead "${parsed.data.id}" not found` }, { status: 404 });
    }
    const latest = await repos.leadScores.latestByLead(ctx, lead.id);
    const capture = await recordCapture(
      promoteLead({
        leadId: lead.id,
        family: parsed.data.family,
        name: lead.name,
        company: lead.company,
        role: lead.role,
        website: lead.website,
        notes: lead.notes,
        painPoint: lead.painPoint,
        score: latest?.score ?? null,
      }),
    );
    return NextResponse.json({
      capture,
      createHref: `/app/create?ctx=${encodeURIComponent(capture.id)}`,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
