import { destinationKeySchema } from "@thalon/contracts";
import { completeOauthConnect } from "@thalon/engine";
import { readEnv } from "@thalon/platform";
import { NextResponse } from "next/server";
import { getRepos } from "@/lib/repos";
import { resolveTenantCtx } from "@/lib/tenant";

/**
 * D1 (s83): THE dynamic OAuth callback — one route serves every
 * oauth2-flavored destination; no per-platform callback pages exist. The
 * platform lands the browser here with `code` + `state`; the exchange runs
 * server-side (state consumed single-use, tokens sealed into the vault),
 * and the browser continues to Settings → Integrations, which renders the
 * outcome in the sheet's own chrome:
 *   success  → ?connected=<destination>      (the card now reads Connected as …)
 *   refusal  → ?connect_error=<message>      (honest failure + a way back)
 * A refusal REDIRECTS rather than 409s because the caller is the operator's
 * BROWSER mid-consent, not a fetch — a JSON body here would strand them on
 * a blank page with no way back (the Mobbin failure-state grammar).
 */

const SETTINGS_PATH = "/app/settings/integrations";

function backTo(origin: string, params: Record<string, string>): NextResponse {
  const url = new URL(SETTINGS_PATH, origin);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ destination: string }> },
) {
  const env = readEnv();
  // The callback's own origin fallback: request URL. APP_ORIGIN governs what
  // the platform app registered; for the redirect BACK into our own app the
  // request's origin is the honest source.
  const origin = env.APP_ORIGIN ?? new URL(request.url).origin;
  const raw = (await params).destination;
  const destination = destinationKeySchema.safeParse(raw);
  if (!destination.success) {
    return backTo(origin, { connect_error: `Unknown destination "${raw}".` });
  }
  const search = new URL(request.url).searchParams;
  // The platform's own refusal (user denied, app misconfigured) arrives as
  // ?error=… with no code — surface its words, not ours.
  const platformError = search.get("error");
  if (platformError) {
    return backTo(origin, {
      connect_error: `${destination.data}: the platform refused the consent — "${platformError}". Nothing was stored.`,
    });
  }
  const code = search.get("code");
  const state = search.get("state");
  if (!code || !state) {
    return backTo(origin, {
      connect_error: `${destination.data}: the platform's callback carried no code/state — start the connect again.`,
    });
  }
  const repos = await getRepos();
  const ctx = await resolveTenantCtx(repos);
  if (!ctx) {
    return backTo(origin, { connect_error: "Set up your workspace profile first." });
  }
  try {
    await completeOauthConnect(
      { repos, ctx, env },
      destination.data,
      { code, state },
      new Date(),
    );
    return backTo(origin, { connected: destination.data });
  } catch (err) {
    // Error messages here are safe by module discipline (the vault/connect
    // layers never put secret material in an error) and flattening them
    // hides exactly what the operator needs — the honest-doors rule.
    const detail =
      err instanceof Error ? err.message : "the token exchange failed — nothing was stored.";
    return backTo(origin, { connect_error: `${destination.data}: ${detail}` });
  }
}
