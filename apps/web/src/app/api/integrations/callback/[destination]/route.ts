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
  // Two DIFFERENT origin needs, deliberately not one value:
  //  · the redirect_uri handed to the platform must match its registered
  //    entry EXACTLY — that is APP_ORIGIN only, never headers (see connect.ts).
  //  · this redirect goes BACK into our own UI, so it must land on the origin
  //    the operator's BROWSER actually used.
  // Behind a reverse proxy `request.url` carries the container's BIND address
  // (https://0.0.0.0:3000 — observed live on staging), which strands the
  // browser exactly like the dead localhost redirects this door exists to
  // end. The proxy's forwarded host is the honest source; only hostnames the
  // proxy routes can reach us, so it cannot be steered elsewhere.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedOrigin = forwardedHost
    ? `${request.headers.get("x-forwarded-proto") ?? "https"}://${forwardedHost}`
    : null;
  const origin = env.APP_ORIGIN ?? forwardedOrigin ?? new URL(request.url).origin;
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
    const card = await completeOauthConnect(
      { repos, ctx, env },
      destination.data,
      { code, state },
      new Date(),
    );
    // The CARD names what was connected — destinations may share a
    // registered callback URL (s84: instagram rides facebook's), so the path
    // is not the flight.
    return backTo(origin, { connected: card.destination });
  } catch (err) {
    // Error messages here are safe by module discipline (the vault/connect
    // layers never put secret material in an error) and flattening them
    // hides exactly what the operator needs — the honest-doors rule.
    const detail =
      err instanceof Error ? err.message : "the token exchange failed — nothing was stored.";
    return backTo(origin, { connect_error: `${destination.data}: ${detail}` });
  }
}
