import { NextResponse } from "next/server";
import { z } from "zod";
import { toErrorResponse } from "@/lib/http-errors";
import { ComposeEmailError, composeEmailDraft } from "@/lib/outreach/service";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

const contextSchema = z.object({
  contact: z.string().min(1).optional(),
  company: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
  painPoint: z.string().min(1).optional(),
  sourceUrl: z.string().min(1).optional(),
  notes: z.string().min(1).optional(),
});

const composeRequestSchema = z.object({
  leadId: z.string().min(1),
  prompt: z.string().optional(),
  context: contextSchema.optional(),
});

/**
 * The →Email compose door (B-crm.4 front half): pruned lead context + operator
 * direction → brief source → ONE judged `outreach_email` draft parked in the
 * approve queue. Thin per doctrine (SPINE §80): authorize → service →
 * serialize. NO send path exists behind this route or anywhere else.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = composeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Send { leadId, prompt?, context?: { contact?, company?, role?, painPoint?, sourceUrl?, notes? } }." },
      { status: 400 },
    );
  }
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) {
    return NextResponse.json({ error: "Set up your workspace profile first." }, { status: 503 });
  }
  try {
    const result = await composeEmailDraft(ctx, repos, parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ComposeEmailError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    }
    return toErrorResponse(err);
  }
}
