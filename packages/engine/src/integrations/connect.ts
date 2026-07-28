import { randomBytes } from "node:crypto";
import { resolveDestination, type DestinationKey, type TenantCtx } from "@thalon/contracts";
import type { OauthStateRow } from "@thalon/db";
import type { ThalonEnv } from "@thalon/platform";
import * as arctic from "arctic";
import { connectDestination, openDestinationCredentials, type CredentialCard, type VaultDeps } from "./vault";
import { REDDIT_USER_AGENT } from "./validate";

/**
 * D1 (s83): the GENERIC OAuth connect dance — one begin door, one complete
 * door, one refresh verb, serving every `oauth2`-flavored destination
 * through a small per-provider entry. The dance's yield lands in the
 * EXISTING vault through the existing write door; nothing here invents a
 * second token store. Adding an oauth2 platform = one OAUTH_PROVIDERS
 * entry + its env client pair + the contracts registry row.
 *
 * The OAuth-2.0 client mechanics ride `arctic` (MIT — the prior-art TAKE):
 * per-provider quirks like Reddit's HTTP-Basic token exchange live in the
 * dependency, not hand-rolled per platform. Arctic never becomes the seam:
 * the contract stays the destination registry + this module's verbs.
 */

/** How long a consent round-trip may take before the state row refuses. */
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

/** The ONE dynamic callback route — its path is contract between this module and the web surface. */
export function oauthCallbackPath(destination: DestinationKey): string {
  return `/api/integrations/callback/${destination}`;
}

export class OauthConnectRefusedError extends Error {
  constructor(
    public readonly destination: string,
    public readonly reason:
      | "not_oauth2"
      | "missing_client_pair"
      | "missing_origin"
      | "state_mismatch"
      | "no_refresh_token"
      | "exchange_failed",
    detail: string,
  ) {
    super(`oauth connect for "${destination}" refused (${reason}): ${detail}`);
    this.name = "OauthConnectRefusedError";
  }
}

/** What one provider contributes to the generic dance. */
interface OauthProvider {
  /** Env keys holding the operator's app pair — named in refusals so the missing arm is actionable. */
  clientEnvKeys: { id: keyof ThalonEnv & string; secret: keyof ThalonEnv & string };
  authorizationUrl(env: ThalonEnv, redirectUri: string, state: string): URL;
  exchange(
    env: ThalonEnv,
    redirectUri: string,
    code: string,
  ): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: Date | null }>;
  refresh(
    env: ThalonEnv,
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: Date | null }>;
  /** The cheapest identity read — the card's connectedAs. */
  whoAmI(fetchImpl: typeof fetch, accessToken: string): Promise<string | undefined>;
}

function redditClient(env: ThalonEnv, redirectUri: string): arctic.Reddit {
  return new arctic.Reddit(
    env.SOCIAL_REDDIT_CLIENT_ID ?? "",
    env.SOCIAL_REDDIT_CLIENT_SECRET ?? "",
    redirectUri,
  );
}

function tokensOut(tokens: arctic.OAuth2Tokens): {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
} {
  // Declared without initializers — every branch assigns (no-useless-assignment).
  let refreshToken: string | null;
  try {
    refreshToken = tokens.refreshToken();
  } catch {
    refreshToken = null;
  }
  let expiresAt: Date | null;
  try {
    expiresAt = tokens.accessTokenExpiresAt();
  } catch {
    expiresAt = null;
  }
  return { accessToken: tokens.accessToken(), refreshToken, expiresAt };
}

const OAUTH_PROVIDERS: Partial<Record<DestinationKey, OauthProvider>> = {
  reddit: {
    clientEnvKeys: { id: "SOCIAL_REDDIT_CLIENT_ID", secret: "SOCIAL_REDDIT_CLIENT_SECRET" },
    authorizationUrl(env, redirectUri, state) {
      const scopes = resolveDestination("reddit").connect?.scopes ?? [];
      const url = redditClient(env, redirectUri).createAuthorizationURL(state, [...scopes]);
      // Without duration=permanent Reddit issues NO refresh token and the
      // connection dies in an hour — the one quirk arctic leaves to us.
      url.searchParams.set("duration", "permanent");
      return url;
    },
    async exchange(env, redirectUri, code) {
      return tokensOut(await redditClient(env, redirectUri).validateAuthorizationCode(code));
    },
    async refresh(env, refreshToken) {
      return tokensOut(await redditClient(env, "").refreshAccessToken(refreshToken));
    },
    async whoAmI(fetchImpl, accessToken) {
      const res = await fetchImpl("https://oauth.reddit.com/api/v1/me", {
        headers: { Authorization: `Bearer ${accessToken}`, "User-Agent": REDDIT_USER_AGENT },
      });
      if (!res.ok) return undefined;
      // text() + defensive parse: the engine's ambient fetch response
      // deliberately exposes no json() (the drivers/errors.ts convention).
      let body: { name?: unknown } | null;
      try {
        body = JSON.parse(await res.text()) as { name?: unknown };
      } catch {
        body = null;
      }
      return typeof body?.name === "string" && body.name !== "" ? `u/${body.name}` : undefined;
    },
  },
};

export interface OauthConnectDeps extends VaultDeps {
  repos: VaultDeps["repos"] & {
    oauthStates: {
      create(
        ctx: TenantCtx,
        input: {
          state: string;
          destination: DestinationKey;
          codeVerifier?: string | null;
          expiresAt: Date;
        },
      ): Promise<OauthStateRow>;
      consume(ctx: TenantCtx, state: string, now: Date): Promise<OauthStateRow>;
    };
  };
  fetchImpl?: typeof fetch;
}

function providerFor(destination: DestinationKey, env: ThalonEnv): OauthProvider {
  const def = resolveDestination(destination);
  const provider = OAUTH_PROVIDERS[destination];
  if (def.connect?.flavor !== "oauth2" || !provider) {
    throw new OauthConnectRefusedError(
      destination,
      "not_oauth2",
      `its connect flavor is "${def.connect?.flavor ?? "manual"}" — the dance serves oauth2 destinations only`,
    );
  }
  const missing = [provider.clientEnvKeys.id, provider.clientEnvKeys.secret].filter(
    (key) => !env[key],
  );
  if (missing.length > 0) {
    throw new OauthConnectRefusedError(
      destination,
      "missing_client_pair",
      `the operator app pair is not set: ${missing.join(", ")} — register the platform app once and set both keys`,
    );
  }
  return provider;
}

function appOrigin(env: ThalonEnv): string {
  const origin = env.APP_ORIGIN;
  if (!origin) {
    throw new OauthConnectRefusedError(
      "*",
      "missing_origin",
      "APP_ORIGIN is not set — the redirect URI must match the registered platform app exactly, so it cannot be derived from request headers",
    );
  }
  return origin.replace(/\/$/, "");
}

/**
 * The BEGIN door: mint a single-use state row and hand back the platform's
 * consent URL. The browser goes there; the platform comes back to the ONE
 * dynamic callback route with `code` + `state`.
 */
export async function beginOauthConnect(
  deps: OauthConnectDeps,
  destination: DestinationKey,
  now: Date,
): Promise<{ authorizeUrl: string; state: string }> {
  const provider = providerFor(destination, deps.env);
  const redirectUri = `${appOrigin(deps.env)}${oauthCallbackPath(destination)}`;
  const state = randomBytes(32).toString("base64url");
  await deps.repos.oauthStates.create(deps.ctx, {
    state,
    destination,
    expiresAt: new Date(now.getTime() + OAUTH_STATE_TTL_MS),
  });
  return { authorizeUrl: provider.authorizationUrl(deps.env, redirectUri, state).toString(), state };
}

/**
 * The COMPLETE door: consume the state (single-use, TTL, tenant-walled),
 * exchange the code, prove the identity, and land the token pair in the
 * vault through the existing write door. Refuses to store a pair with no
 * refresh token — that would be a connection built to die silently.
 */
export async function completeOauthConnect(
  deps: OauthConnectDeps,
  destination: DestinationKey,
  input: { code: string; state: string },
  now: Date,
): Promise<CredentialCard> {
  const provider = providerFor(destination, deps.env);
  const stateRow = await deps.repos.oauthStates.consume(deps.ctx, input.state, now);
  if (stateRow.destination !== destination) {
    throw new OauthConnectRefusedError(
      destination,
      "state_mismatch",
      `the state row belongs to a "${stateRow.destination}" flight — a callback cannot be replayed across destinations`,
    );
  }
  const redirectUri = `${appOrigin(deps.env)}${oauthCallbackPath(destination)}`;
  let tokens: Awaited<ReturnType<OauthProvider["exchange"]>>;
  try {
    tokens = await provider.exchange(deps.env, redirectUri, input.code);
  } catch (err) {
    throw new OauthConnectRefusedError(
      destination,
      "exchange_failed",
      err instanceof Error ? err.message : "the token exchange failed",
    );
  }
  if (!tokens.refreshToken) {
    throw new OauthConnectRefusedError(
      destination,
      "no_refresh_token",
      "the platform issued no refresh token — storing an access token alone builds a connection that dies silently; the consent must grant permanent duration",
    );
  }
  const fetchImpl = deps.fetchImpl ?? fetch;
  const connectedAs = await provider.whoAmI(fetchImpl, tokens.accessToken);
  return connectDestination(deps, {
    destination,
    credentials: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken },
    connectedAs: connectedAs ?? null,
    expiresAt: tokens.expiresAt,
  });
}

export interface RefreshOutcome {
  destination: DestinationKey;
  outcome: "refreshed" | "needs_reauth" | "skipped";
  detail: string;
}

/**
 * Refresh ONE oauth2 destination's token pair in place. A refresh refusal
 * flips the card to needs_reauth (the Klaviyo-grammar state the surface
 * renders) rather than throwing the tick over — one dead platform never
 * blocks another's refresh.
 */
export async function refreshOauthCredentials(
  deps: OauthConnectDeps,
  destination: DestinationKey,
): Promise<RefreshOutcome> {
  const provider = providerFor(destination, deps.env);
  // Outside the try ON PURPOSE: a row that will not OPEN is a box-level
  // misconfiguration (wrong/absent master key) — it throws loud (the B-int.1
  // failure posture) and must never be laundered into a needs_reauth card.
  const creds = (await openDestinationCredentials(deps, destination as never)) as {
    accessToken: string;
    refreshToken: string;
  };
  try {
    const tokens = await provider.refresh(deps.env, creds.refreshToken);
    await connectDestination(deps, {
      destination,
      credentials: {
        accessToken: tokens.accessToken,
        // Providers may rotate the refresh token or keep it — store whichever survives.
        refreshToken: tokens.refreshToken ?? creds.refreshToken,
      },
      expiresAt: tokens.expiresAt,
    });
    return { destination, outcome: "refreshed", detail: "token pair renewed into the vault" };
  } catch (err) {
    await deps.repos.tenantCredentials.markStatus(deps.ctx, destination, "needs_reauth");
    return {
      destination,
      outcome: "needs_reauth",
      detail: err instanceof Error ? err.message : "refresh failed",
    };
  }
}

/**
 * The refresh TICK's engine half (rides the sweep-scheduler pattern): every
 * CONNECTED oauth2 destination whose expiry falls inside the horizon gets a
 * renewal attempt. Destinations without an expiry are skipped — nothing to
 * anticipate. Deterministic clock passed in.
 */
export async function refreshExpiringCredentials(
  deps: OauthConnectDeps,
  opts: { now: Date; horizonMs: number },
): Promise<RefreshOutcome[]> {
  const rows = await deps.repos.tenantCredentials.list(deps.ctx);
  const outcomes: RefreshOutcome[] = [];
  for (const row of rows) {
    const destination = row.destination as DestinationKey;
    const def = resolveDestination(destination);
    if (def.connect?.flavor !== "oauth2" || row.status !== "connected") continue;
    if (!row.expiresAt) {
      outcomes.push({ destination, outcome: "skipped", detail: "no expiry recorded" });
      continue;
    }
    if (row.expiresAt.getTime() > opts.now.getTime() + opts.horizonMs) {
      outcomes.push({ destination, outcome: "skipped", detail: "not inside the horizon" });
      continue;
    }
    outcomes.push(await refreshOauthCredentials(deps, destination));
  }
  return outcomes;
}
