import { destinationKeySchema } from "@thalon/contracts";
import { beginOauthConnect, OauthConnectRefusedError } from "@thalon/engine";
import { readEnv } from "@thalon/platform";
import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/http-errors";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * D1 (s83): the OAuth connect dance's BEGIN door — mints a single-use state
 * row (Postgres, TTL) and answers with the platform's consent URL; the
 * browser goes there and the platform returns to the ONE dynamic callback
 * route. A refusal (wrong flavor, missing operator app pair, no APP_ORIGIN)
 * is a typed 409 naming exactly what is unset — the honest-doors grammar.
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
  try {
    const { authorizeUrl } = await beginOauthConnect(
      { repos, ctx, env: readEnv() },
      destination.data,
      new Date(),
    );
    return NextResponse.json({ authorizeUrl });
  } catch (err) {
    if (err instanceof OauthConnectRefusedError) {
      return NextResponse.json({ error: err.message, reason: err.reason }, { status: 409 });
    }
    return toErrorResponse(err);
  }
}
