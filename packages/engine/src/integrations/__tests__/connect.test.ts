import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle } from "@thalon/db";
import { NotFoundError } from "@thalon/db";
import { readEnv, type ThalonEnv } from "@thalon/platform";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  beginOauthConnect,
  completeOauthConnect,
  OAUTH_STATE_TTL_MS,
  oauthCallbackPath,
  OauthConnectRefusedError,
  refreshExpiringCredentials,
  refreshOauthCredentials,
  type OauthConnectDeps,
} from "../connect";
import { openDestinationCredentials } from "../vault";

/**
 * D1 (s83): the generic OAuth dance — begin mints a single-use state row
 * and the platform's consent URL (duration=permanent: the one Reddit quirk
 * arctic leaves to us), complete consumes the state exactly once and lands
 * the pair in the vault, refresh renews in place and flips needs_reauth on
 * failure. Arctic's token exchange runs against a STUBBED global fetch —
 * never live (the drivers.test.ts discipline).
 */

const MASTER_B64 = Buffer.alloc(32, 7).toString("base64");
const NOW = new Date("2026-08-01T09:30:00Z");

let handle: DbHandle;
let ctx: TenantCtx;
let env: ThalonEnv;

function deps(overrides: Partial<OauthConnectDeps> = {}): OauthConnectDeps {
  return { repos: handle.repos, ctx, env, ...overrides };
}

/** Stub the global fetch arctic uses for its token endpoints; provider extras ride deps.fetchImpl instead. */
function stubTokenEndpoint(body: Record<string, unknown> | (() => Response)) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      // Arctic hands fetch a Request object, not a URL string.
      const url =
        typeof input === "string" ? input : ((input as { url?: unknown }).url ?? String(input));
      if (
        String(url).includes("reddit.com/api/v1/access_token") ||
        String(url).includes("graph.facebook.com")
      ) {
        return typeof body === "function"
          ? body()
          : new Response(JSON.stringify(body), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
      }
      throw new Error(`unexpected live fetch in test: ${String(url)}`);
    }),
  );
}

const whoAmIFetch: typeof fetch = async (url) => {
  if (String(url).endsWith("/api/v1/me")) {
    return new Response(JSON.stringify({ name: "steve_ops" }), { status: 200 });
  }
  throw new Error(`unexpected whoAmI fetch: ${String(url)}`);
};

beforeEach(async () => {
  handle = await openTestDb();
  const tenant = await handle.repos.tenants.create({ slug: "self", name: "Self" });
  ctx = tenantCtx(tenant.id);
  env = readEnv({
    THALON_VAULT_MASTER_KEY: MASTER_B64,
    SOCIAL_REDDIT_CLIENT_ID: "cid",
    SOCIAL_REDDIT_CLIENT_SECRET: "csecret",
    APP_ORIGIN: "https://app.example.com",
  });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await handle.close();
});

describe("beginOauthConnect", () => {
  it("mints a single-use state row and the consent URL — scopes from the registry, duration=permanent, exact callback", async () => {
    const { authorizeUrl, state } = await beginOauthConnect(deps(), "reddit", NOW);
    const url = new URL(authorizeUrl);
    expect(url.origin + url.pathname).toBe("https://www.reddit.com/api/v1/authorize");
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("scope")).toBe("identity submit");
    expect(url.searchParams.get("duration")).toBe("permanent");
    expect(url.searchParams.get("state")).toBe(state);
    expect(url.searchParams.get("redirect_uri")).toBe(
      `https://app.example.com${oauthCallbackPath("reddit")}`,
    );
    const row = await handle.repos.oauthStates.consume(ctx, state, NOW);
    expect(row.destination).toBe("reddit");
    expect(row.expiresAt.getTime()).toBe(NOW.getTime() + OAUTH_STATE_TTL_MS);
  });

  it("refuses a non-oauth2 destination, naming the flavor", async () => {
    await expect(beginOauthConnect(deps(), "bluesky", NOW)).rejects.toThrow(
      /connect flavor is "app_password"/,
    );
  });

  it("refuses when the operator app pair is unset, naming BOTH keys", async () => {
    env = readEnv({ THALON_VAULT_MASTER_KEY: MASTER_B64, APP_ORIGIN: "https://a.example" });
    await expect(beginOauthConnect(deps(), "reddit", NOW)).rejects.toThrow(
      /SOCIAL_REDDIT_CLIENT_ID, SOCIAL_REDDIT_CLIENT_SECRET/,
    );
  });

  it("refuses without APP_ORIGIN — a redirect URI must match the registered app exactly", async () => {
    env = readEnv({
      THALON_VAULT_MASTER_KEY: MASTER_B64,
      SOCIAL_REDDIT_CLIENT_ID: "cid",
      SOCIAL_REDDIT_CLIENT_SECRET: "csecret",
    });
    await expect(beginOauthConnect(deps(), "reddit", NOW)).rejects.toThrow(/APP_ORIGIN is not set/);
  });
});

describe("completeOauthConnect", () => {
  it("consumes the state once, exchanges the code, and lands the PAIR in the vault with identity + expiry", async () => {
    stubTokenEndpoint({
      access_token: "at_1",
      refresh_token: "rt_1",
      token_type: "bearer",
      expires_in: 3600,
      scope: "identity submit",
    });
    const { state } = await beginOauthConnect(deps(), "reddit", NOW);
    const card = await completeOauthConnect(
      deps({ fetchImpl: whoAmIFetch }),
      "reddit",
      { code: "the-code", state },
      NOW,
    );
    expect(card.destination).toBe("reddit");
    expect(card.connectedAs).toBe("u/steve_ops");
    expect(card.expiresAt).not.toBeNull();
    const creds = await openDestinationCredentials(deps(), "reddit");
    expect(creds).toEqual({ accessToken: "at_1", refreshToken: "rt_1" });
    // Single-use: the same callback replayed finds no flight.
    await expect(
      completeOauthConnect(deps({ fetchImpl: whoAmIFetch }), "reddit", { code: "x", state }, NOW),
    ).rejects.toThrow(NotFoundError);
  });

  it("refuses a state minted for another destination — a callback cannot cross flights", async () => {
    stubTokenEndpoint({ access_token: "at", refresh_token: "rt", token_type: "bearer" });
    const row = await handle.repos.oauthStates.create(ctx, {
      state: "st-foreign",
      destination: "bluesky",
      expiresAt: new Date(NOW.getTime() + 60_000),
    });
    await expect(
      completeOauthConnect(deps(), "reddit", { code: "c", state: row.state }, NOW),
    ).rejects.toThrow(/belongs to a "bluesky" flight/);
  });

  it("refuses to store a refresh-token-less yield — nothing lands in the vault", async () => {
    stubTokenEndpoint({ access_token: "at_only", token_type: "bearer", expires_in: 3600 });
    const { state } = await beginOauthConnect(deps(), "reddit", NOW);
    await expect(
      completeOauthConnect(deps({ fetchImpl: whoAmIFetch }), "reddit", { code: "c", state }, NOW),
    ).rejects.toThrow(OauthConnectRefusedError);
    expect(await handle.repos.tenantCredentials.get(ctx, "reddit")).toBeNull();
  });
});

describe("refresh", () => {
  async function connectedReddit(expiresAt: Date | null) {
    stubTokenEndpoint({
      access_token: "at_1",
      refresh_token: "rt_1",
      token_type: "bearer",
      expires_in: 3600,
    });
    const { state } = await beginOauthConnect(deps(), "reddit", NOW);
    await completeOauthConnect(deps({ fetchImpl: whoAmIFetch }), "reddit", { code: "c", state }, NOW);
    if (expiresAt !== null) {
      // openTestDb repos expose no direct expiry setter; re-seal through the
      // write door with the chosen horizon (rotation is the same upsert).
      const creds = await openDestinationCredentials(deps(), "reddit");
      const { connectDestination } = await import("../vault");
      await connectDestination(deps(), { destination: "reddit", credentials: creds, expiresAt });
    }
  }

  it("renews the pair in place; a provider that returns no new refresh token keeps the old one", async () => {
    await connectedReddit(null);
    stubTokenEndpoint({ access_token: "at_2", token_type: "bearer", expires_in: 3600 });
    const outcome = await refreshOauthCredentials(deps({ fetchImpl: whoAmIFetch }), "reddit");
    expect(outcome.outcome).toBe("refreshed");
    expect(await openDestinationCredentials(deps(), "reddit")).toEqual({
      accessToken: "at_2",
      refreshToken: "rt_1",
    });
  });

  it("a refused refresh flips the card to needs_reauth instead of throwing the tick over", async () => {
    await connectedReddit(null);
    stubTokenEndpoint(() => new Response("invalid_grant", { status: 400 }));
    const outcome = await refreshOauthCredentials(deps(), "reddit");
    expect(outcome.outcome).toBe("needs_reauth");
    const row = await handle.repos.tenantCredentials.get(ctx, "reddit");
    expect(row?.status).toBe("needs_reauth");
  });

  it("the tick refreshes inside the horizon, skips outside it, and never touches app_password flavors", async () => {
    await connectedReddit(new Date(NOW.getTime() + 60 * 60 * 1000));
    const { connectDestination } = await import("../vault");
    await connectDestination(deps(), {
      destination: "bluesky",
      credentials: { identifier: "steve.bsky.social", appPassword: "pw" },
    });
    stubTokenEndpoint({ access_token: "at_3", token_type: "bearer", expires_in: 3600 });
    const near = await refreshExpiringCredentials(deps({ fetchImpl: whoAmIFetch }), {
      now: NOW,
      horizonMs: 2 * 60 * 60 * 1000,
    });
    // bluesky is app_password-flavored: not even a "skipped" row — the tick
    // only reasons about oauth2 destinations.
    expect(near).toEqual([
      { destination: "reddit", outcome: "refreshed", detail: "token pair renewed into the vault" },
    ]);
    // Far case: re-seal with an EXPLICIT far expiry (the refresh restamped it
    // from arctic's wall clock, which this fixed-NOW test must not lean on).
    const { connectDestination: reseal } = await import("../vault");
    const creds = await openDestinationCredentials(deps(), "reddit");
    await reseal(deps(), {
      destination: "reddit",
      credentials: creds,
      expiresAt: new Date(NOW.getTime() + 100 * 60 * 60 * 1000),
    });
    const far = await refreshExpiringCredentials(deps(), {
      now: NOW,
      horizonMs: 10 * 60 * 1000,
    });
    expect(far[0].outcome).toBe("skipped");
  });
});

describe("the facebook provider (s83b: the dance yields the PAGE, not the user)", () => {
  const PAGES = [
    { id: "111", name: "Grip Works", access_token: "page_tok_111" },
    { id: "222", name: "Side Project", access_token: "page_tok_222" },
  ];

  function fbEnv(extra: Record<string, string> = {}) {
    return readEnv({
      THALON_VAULT_MASTER_KEY: MASTER_B64,
      SOCIAL_FACEBOOK_CLIENT_ID: "fb_cid",
      SOCIAL_FACEBOOK_CLIENT_SECRET: "fb_csecret",
      APP_ORIGIN: "https://app.example.com",
      ...extra,
    });
  }

  function fbFetch(pages: unknown[]): typeof fetch {
    return (async (url: unknown) => {
      const u = String(url);
      if (u.includes("fb_exchange_token")) {
        return new Response(JSON.stringify({ access_token: "long_user_tok", expires_in: 5184000 }), {
          status: 200,
        });
      }
      if (u.includes("/me/accounts")) {
        return new Response(JSON.stringify({ data: pages }), { status: 200 });
      }
      throw new Error(`unexpected provider fetch: ${u}`);
    }) as typeof fetch;
  }

  it("begin builds the platform's dialog URL with the Page scopes", async () => {
    env = fbEnv();
    const { authorizeUrl } = await beginOauthConnect(deps(), "facebook", NOW);
    const url = new URL(authorizeUrl);
    expect(url.hostname).toBe("www.facebook.com");
    expect(url.searchParams.get("scope")).toBe(
      "pages_manage_posts pages_read_engagement pages_show_list",
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://app.example.com/api/integrations/callback/facebook",
    );
  });

  it("the env-pinned Page wins among several; the vault stores the PAGE token + id, no expiry, named card", async () => {
    env = fbEnv({ SOCIAL_FACEBOOK_PAGE_ID: "111" });
    stubTokenEndpoint({ access_token: "short_user_tok", token_type: "bearer", expires_in: 3600 });
    const { state } = await beginOauthConnect(deps(), "facebook", NOW);
    const card = await completeOauthConnect(
      deps({ fetchImpl: fbFetch(PAGES) }),
      "facebook",
      { code: "c", state },
      NOW,
    );
    expect(card.connectedAs).toBe("Grip Works");
    expect(card.expiresAt).toBeNull();
    expect(await openDestinationCredentials(deps(), "facebook")).toEqual({
      accessToken: "page_tok_111",
      pageId: "111",
    });
  });

  it("exactly one Page decides itself without a pin", async () => {
    env = fbEnv();
    stubTokenEndpoint({ access_token: "short_user_tok", token_type: "bearer" });
    const { state } = await beginOauthConnect(deps(), "facebook", NOW);
    const card = await completeOauthConnect(
      deps({ fetchImpl: fbFetch([PAGES[0]]) }),
      "facebook",
      { code: "c", state },
      NOW,
    );
    expect(card.connectedAs).toBe("Grip Works");
  });

  it("several Pages and no pin REFUSES and names them — a silent pick would connect the wrong identity", async () => {
    env = fbEnv();
    stubTokenEndpoint({ access_token: "short_user_tok", token_type: "bearer" });
    const { state } = await beginOauthConnect(deps(), "facebook", NOW);
    await expect(
      completeOauthConnect(deps({ fetchImpl: fbFetch(PAGES) }), "facebook", { code: "c", state }, NOW),
    ).rejects.toThrow(/2 Pages and none is pinned.*Grip Works \(111\), Side Project \(222\)/);
    expect(await handle.repos.tenantCredentials.get(ctx, "facebook")).toBeNull();
  });

  it("no Pages at all refuses honestly — Facebook posting is Page posting", async () => {
    env = fbEnv();
    stubTokenEndpoint({ access_token: "short_user_tok", token_type: "bearer" });
    const { state } = await beginOauthConnect(deps(), "facebook", NOW);
    await expect(
      completeOauthConnect(deps({ fetchImpl: fbFetch([]) }), "facebook", { code: "c", state }, NOW),
    ).rejects.toThrow(/manages no Pages/);
  });

  it("the refresh tick never touches a facebook row — no expiry is recorded", async () => {
    env = fbEnv({ SOCIAL_FACEBOOK_PAGE_ID: "111" });
    stubTokenEndpoint({ access_token: "short_user_tok", token_type: "bearer" });
    const { state } = await beginOauthConnect(deps(), "facebook", NOW);
    await completeOauthConnect(deps({ fetchImpl: fbFetch(PAGES) }), "facebook", { code: "c", state }, NOW);
    const outcomes = await refreshExpiringCredentials(deps(), {
      now: NOW,
      horizonMs: 365 * 24 * 60 * 60 * 1000,
    });
    expect(outcomes).toEqual([
      { destination: "facebook", outcome: "skipped", detail: "no expiry recorded" },
    ]);
  });
});
