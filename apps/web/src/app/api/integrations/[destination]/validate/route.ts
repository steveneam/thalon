import { destinationKeySchema } from "@thalon/contracts";
import { listIntegrationCards, validateDestination } from "@thalon/engine";
import { readEnv } from "@thalon/platform";
import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * B-int.2: the on-demand validate ping — the cheapest official read-only
 * probe per destination (B-int.1 seam, incl. the s69 versioned-endpoint
 * check for LinkedIn). Flips the stored card honestly: validated stamps
 * connected+validatedAt, an auth-shaped refusal marks needs_reauth, an
 * unreachable platform (or a dead engine version pin) changes nothing and
 * says so in the probe detail.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ destination: string }> },
) {
  const raw = (await params).destination;
  const destination = destinationKeySchema.safeParse(raw);
  if (!destination.success) {
    return NextResponse.json({ error: `Unknown destination "${raw}".` }, { status: 400 });
  }
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) {
    return NextResponse.json({ error: "Set up your workspace profile first." }, { status: 503 });
  }
  const deps = { repos, ctx, env: readEnv() };
  try {
    const validation = await validateDestination(deps, destination.data);
    const { features } = await repos.entitlements.getEffective(ctx);
    const cards = await listIntegrationCards(deps, { features });
    const card = cards.find((c) => c.destination === destination.data);
    return NextResponse.json({ card, probe: validation.probe });
  } catch (err) {
    return toErrorResponse(err);
  }
}
