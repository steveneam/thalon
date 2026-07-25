import { destinationKeySchema } from "@thalon/contracts";
import { connectDestination, listIntegrationCards, validateDestination } from "@thalon/engine";
import { readEnv } from "@thalon/platform";
import { NextResponse } from "next/server";
import { z } from "zod";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * B-int.2: the guided-manual (mode 2) connect door — paste, seal, then
 * validate in the same call. The write door shape-checks BEFORE crypto (a
 * malformed paste stores nothing, issue paths only ride the error); the
 * follow-up validate ping probes the platform read-only and stamps the card
 * honestly — a pasted-but-dead token comes back needs_reauth immediately,
 * and a probe-discovered identity (@handle / name / page) becomes the
 * card's connected-as. Credentials exist only in this request's body and
 * the sealed envelope; the response carries the derived card + the probe
 * outcome, never a secret.
 */

const bodySchema = z.object({
  credentials: z.unknown(),
  expiresAt: z.iso.datetime().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ destination: string }> },
) {
  const raw = (await params).destination;
  const destination = destinationKeySchema.safeParse(raw);
  if (!destination.success) {
    return NextResponse.json({ error: `Unknown destination "${raw}".` }, { status: 400 });
  }
  const body: unknown = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A credentials object is required (fields per the destination's connect shape)." },
      { status: 400 },
    );
  }
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) {
    return NextResponse.json({ error: "Set up your workspace profile first." }, { status: 503 });
  }
  const deps = { repos, ctx, env: readEnv() };
  try {
    await connectDestination(deps, {
      destination: destination.data,
      credentials: parsed.data.credentials ?? {},
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    });
    const validation = await validateDestination(deps, destination.data);
    const { features } = await repos.entitlements.getEffective(ctx);
    const cards = await listIntegrationCards(deps, { features });
    const card = cards.find((c) => c.destination === destination.data);
    return NextResponse.json({ card, probe: validation.probe });
  } catch (err) {
    return toErrorResponse(err);
  }
}
