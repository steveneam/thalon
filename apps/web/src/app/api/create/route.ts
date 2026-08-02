import { createBriefSchema } from "@thalon/contracts";
import { InvalidStateError } from "@thalon/db";
import { runCreate } from "@thalon/engine";
import { gatewayJudgeDriver } from "@thalon/judge";
import { NextResponse } from "next/server";
import { createDoor } from "@/lib/create/families";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * The Create run door (B-create.4 remainder): brief → `runCreate` — plan
 * derived, refused-before-written, dispatched to the family engines that
 * judge their own output, recorded as ONE `create_runs` row (spec R1). Thin
 * per doctrine: authorize → gate → service → serialize.
 *
 * THE SEQUENCE GATE LIVES HERE TOO, not only on the button: post/page
 * generation waits on the founder's recorded go-ahead
 * (`lib/create/families.ts` is the one seam and this route reads it), so a
 * hand-crafted POST cannot walk past a gate the surface honestly states.
 * When his GO lands, flipping the seam arms both at once.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = createBriefSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Send a create brief — { family, mode, prompt?, platforms?, … }." },
      { status: 400 },
    );
  }
  const brief = parsed.data;

  const door = createDoor(brief.family, {
    hasLead: typeof brief.context?.leadId === "string" && brief.context.leadId.length > 0,
  });
  if (!door.armed) {
    // The same sentence the surface shows — a refusal, stated, never a 500.
    return NextResponse.json({ error: door.reason }, { status: 409 });
  }

  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) {
    return NextResponse.json({ error: "Set up your workspace profile first." }, { status: 503 });
  }
  try {
    // The same driver wiring as every judged door in this app.
    const result = await runCreate(ctx, repos, brief, {
      judge: { screenDriver: gatewayJudgeDriver(), finalDriver: gatewayJudgeDriver() },
    });
    return NextResponse.json({
      runId: result.run.id,
      status: result.run.status,
      dispatched: result.dispatched,
      children: result.children,
      failures: result.failures,
    });
  } catch (err) {
    if (err instanceof InvalidStateError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return toErrorResponse(err);
  }
}
