import { destinationKeySchema } from "@thalon/contracts";
import { disconnectDestination } from "@thalon/engine";
import { readEnv } from "@thalon/platform";
import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * B-int.2: disconnect — the row deletes, the event ledger remembers
 * (repo semantics). Arming follows the vault (B-int.1 vault-first
 * resolution), so a disconnected destination stops filling driver seats on
 * the next resolve; the env pairs remain the emergency override.
 */
export async function DELETE(
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
  try {
    await disconnectDestination({ repos, ctx, env: readEnv() }, destination.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
