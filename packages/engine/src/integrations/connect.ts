import { randomBytes } from "node:crypto";
import { resolveDestination, type DestinationKey, type TenantCtx } from "@thalon/contracts";
import type { OauthStateRow } from "@thalon/db";
import type { ThalonEnv } from "@thalon/platform";
import * as arctic from "arctic";
import { FACEBOOK_GRAPH_VERSION } from "../social/drivers/facebook";
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

/**
 * What one provider contributes to the generic dance (s83b: providers
 * return the destination's own CREDENTIALS SHAPE, because platforms
 * disagree about what a connection IS — Reddit yields a token pair,
 * Facebook yields a derived Page token + page id and has no refresh token
 * at all. The vault write door still validates the shape; a provider
 * cannot invent fields the registry doesn't declare).
 */
interface OauthProvider {
  /** Env keys holding the operator's app pair — named in refusals so the missing arm is actionable. */
  clientEnvKeys: { id: keyof ThalonEnv & string; secret: keyof ThalonEnv & string };
  authorizationUrl(env: ThalonEnv, redirectUri: string, state: string): URL;
  /** Code → the destination's credentials + card facts. Throws OauthConnectRefusedError for provider-specific refusals (reddit: a yield with no refresh token must not store). */
  exchange(
    env: ThalonEnv,
    redirectUri: string,
    code: string,
    fetchImpl: typeof fetch,
  ): Promise<{
    credentials: Record<string, string>;
    expiresAt: Date | null;
    connectedAs?: string;
  }>;
  /** Renew in place from the stored credentials; a throw flips the card to needs_reauth. */
  refresh(
    env: ThalonEnv,
    credentials: Record<string, string>,
    fetchImpl: typeof fetch,
  ): Promise<{ credentials: Record<string, string>; expiresAt: Date | null }>;
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

/** text() + defensive parse: the engine's ambient fetch response deliberately exposes no json() (the drivers/errors.ts convention). */
async function jsonOf(res: { text(): Promise<string> }): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = JSON.parse(await res.text());
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
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
    async exchange(env, redirectUri, code, fetchImpl) {
      const tokens = tokensOut(await redditClient(env, redirectUri).validateAuthorizationCode(code));
      if (!tokens.refreshToken) {
        throw new OauthConnectRefusedError(
          "reddit",
          "no_refresh_token",
          "the platform issued no refresh token — storing an access token alone builds a connection that dies silently; the consent must grant permanent duration",
        );
      }
      // The cheapest identity read — the card's connectedAs.
      let connectedAs: string | undefined;
      const res = await fetchImpl("https://oauth.reddit.com/api/v1/me", {
        headers: { Authorization: `Bearer ${tokens.accessToken}`, "User-Agent": REDDIT_USER_AGENT },
      });
      if (res.ok) {
        const body = await jsonOf(res);
        const name = body?.name;
        connectedAs = typeof name === "string" && name !== "" ? `u/${name}` : undefined;
      }
      return {
        credentials: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken },
        expiresAt: tokens.expiresAt,
        connectedAs,
      };
    },
    async refresh(env, credentials) {
      const tokens = tokensOut(await redditClient(env, "").refreshAccessToken(credentials.refreshToken));
      return {
        credentials: {
          accessToken: tokens.accessToken,
          // Providers may rotate the refresh token or keep it — store whichever survives.
          refreshToken: tokens.refreshToken ?? credentials.refreshToken,
        },
        expiresAt: tokens.expiresAt,
      };
    },
  },

  /**
   * s83b (founder-directed): Facebook rides the dance for the SELF tenant —
   * the operator's own app in Development mode needs no App Review for its
   * own admin's Page, which is the whole dogfood case (the B-int.4 review
   * wall is about OTHER tenants and is untouched). The yield is not the user
   * token: it is the derived PAGE token + page id — exactly the shape the
   * facebook vault entry stores — via short token → fb_exchange_token
   * long-lived → /me/accounts. Page tokens derived from a long-lived user
   * token do not expire, so expiresAt is null and the refresh tick never
   * needs to touch this row.
   */
  facebook: {
    clientEnvKeys: { id: "SOCIAL_FACEBOOK_CLIENT_ID", secret: "SOCIAL_FACEBOOK_CLIENT_SECRET" },
    authorizationUrl(env, redirectUri, state) {
      const scopes = resolveDestination("facebook").connect?.scopes ?? [];
      return new arctic.Facebook(
        env.SOCIAL_FACEBOOK_CLIENT_ID ?? "",
        env.SOCIAL_FACEBOOK_CLIENT_SECRET ?? "",
        redirectUri,
      ).createAuthorizationURL(state, [...scopes]);
    },
    async exchange(env, redirectUri, code, fetchImpl) {
      const graph = `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}`;
      const short = tokensOut(
        await new arctic.Facebook(
          env.SOCIAL_FACEBOOK_CLIENT_ID ?? "",
          env.SOCIAL_FACEBOOK_CLIENT_SECRET ?? "",
          redirectUri,
        ).validateAuthorizationCode(code),
      );
      // Long-lived exchange (~60 days) — the credentials travel as query
      // params because that is the endpoint's own contract.
      const longRes = await fetchImpl(
        `${graph}/oauth/access_token?grant_type=fb_exchange_token` +
          `&client_id=${encodeURIComponent(env.SOCIAL_FACEBOOK_CLIENT_ID ?? "")}` +
          `&client_secret=${encodeURIComponent(env.SOCIAL_FACEBOOK_CLIENT_SECRET ?? "")}` +
          `&fb_exchange_token=${encodeURIComponent(short.accessToken)}`,
      );
      const longBody = longRes.ok ? await jsonOf(longRes) : null;
      const userToken =
        typeof longBody?.access_token === "string" ? longBody.access_token : short.accessToken;
      // The Page derivation: the account's pages, with their own tokens.
      const pagesRes = await fetchImpl(`${graph}/me/accounts?fields=id,name,access_token`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      if (!pagesRes.ok) {
        throw new OauthConnectRefusedError(
          "facebook",
          "exchange_failed",
          `the Pages read failed (HTTP ${pagesRes.status}) — without a Page there is nothing to post as`,
        );
      }
      const pages = (await jsonOf(pagesRes))?.data;
      const list = Array.isArray(pages)
        ? (pages as Array<{ id?: unknown; name?: unknown; access_token?: unknown }>).filter(
            (p) => typeof p.id === "string" && typeof p.access_token === "string",
          )
        : [];
      // Which Page? The env pin wins when set (the operator already chose);
      // else exactly one page decides itself; else refuse and NAME them —
      // picking silently would connect the wrong identity.
      const pinned = env.SOCIAL_FACEBOOK_PAGE_ID;
      const page =
        (pinned ? list.find((p) => p.id === pinned) : undefined) ??
        (list.length === 1 ? list[0] : undefined);
      if (!page) {
        const names = list.map((p) => `${String(p.name ?? "?")} (${String(p.id)})`).join(", ");
        throw new OauthConnectRefusedError(
          "facebook",
          "exchange_failed",
          list.length === 0
            ? "the account manages no Pages — Facebook posting is Page posting, so there is nothing to connect"
            : `the account manages ${list.length} Pages and none is pinned — set SOCIAL_FACEBOOK_PAGE_ID to one of: ${names}`,
        );
      }
      return {
        credentials: { accessToken: String(page.access_token), pageId: String(page.id) },
        // A Page token derived from a long-lived user token does not expire.
        expiresAt: null,
        connectedAs: typeof page.name === "string" ? page.name : undefined,
      };
    },
    async refresh(_env, credentials) {
      // Never reached in practice: the row stores no expiry, so the tick
      // skips it. Stated rather than left to be discovered.
      return { credentials, expiresAt: null };
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
  const fetchImpl = deps.fetchImpl ?? fetch;
  let yielded: Awaited<ReturnType<OauthProvider["exchange"]>>;
  try {
    yielded = await provider.exchange(deps.env, redirectUri, input.code, fetchImpl);
  } catch (err) {
    // A provider's own typed refusal travels as-is (reddit's
    // no_refresh_token, facebook's no-Page); everything else is the
    // exchange failing.
    if (err instanceof OauthConnectRefusedError) throw err;
    throw new OauthConnectRefusedError(
      destination,
      "exchange_failed",
      err instanceof Error ? err.message : "the token exchange failed",
    );
  }
  return connectDestination(deps, {
    destination,
    credentials: yielded.credentials,
    connectedAs: yielded.connectedAs ?? null,
    expiresAt: yielded.expiresAt,
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
  const creds = (await openDestinationCredentials(deps, destination as never)) as Record<
    string,
    string
  >;
  const fetchImpl = deps.fetchImpl ?? fetch;
  try {
    const renewed = await provider.refresh(deps.env, creds, fetchImpl);
    await connectDestination(deps, {
      destination,
      credentials: renewed.credentials,
      expiresAt: renewed.expiresAt,
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
