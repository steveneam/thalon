import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/lib/testing/server";

let repos: Repos | undefined;
vi.mock("@/lib/repos", () => ({
  getRepos: () => {
    if (!repos) throw new Error("test db not opened");
    return Promise.resolve(repos);
  },
}));

const { POST: OAUTH_BEGIN } = await import("./[destination]/oauth/route");
const { GET: CALLBACK } = await import("./callback/[destination]/route");

/**
 * D1 (s83) route family: the OAuth dance's two HTTP doors. Begin refuses
 * typed-and-named (flavor · missing operator pair · missing origin) and
 * mints the consent URL; the ONE dynamic callback consumes the state
 * single-use, exchanges via arctic (MSW answers the token endpoint — no
 * live network, ever), seals the pair, and REDIRECTS the operator's browser
 * back to Settings with the outcome in the query — a refusal here must
 * never strand a browser on a JSON body.
 */

let handle: DbHandle | undefined;
let ctx: TenantCtx | undefined;
const MASTER_B64 = Buffer.alloc(32, 9).toString("base64");

beforeEach(async () => {
  process.env.THALON_VAULT_MASTER_KEY = MASTER_B64;
  process.env.SOCIAL_REDDIT_CLIENT_ID = "cid";
  process.env.SOCIAL_REDDIT_CLIENT_SECRET = "csecret";
  process.env.APP_ORIGIN = "https://app.example.com";
  handle = await openTestDb();
  repos = handle.repos;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self", plan: "internal" });
  ctx = tenantCtx(tenant.id);
});

afterEach(async () => {
  delete process.env.THALON_VAULT_MASTER_KEY;
  delete process.env.SOCIAL_REDDIT_CLIENT_ID;
  delete process.env.SOCIAL_REDDIT_CLIENT_SECRET;
  delete process.env.APP_ORIGIN;
  repos = undefined;
  ctx = undefined;
  await handle?.close();
  handle = undefined;
});

function param(destination: string): { params: Promise<{ destination: string }> } {
  return { params: Promise.resolve({ destination }) };
}

function beginReq(destination: string): Request {
  return new Request(`http://test.local/api/integrations/${destination}/oauth`, {
    method: "POST",
  });
}

function callbackReq(destination: string, query: Record<string, string>): Request {
  const url = new URL(`http://test.local/api/integrations/callback/${destination}`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return new Request(url, { method: "GET" });
}

function stubExchange() {
  server.use(
    http.post("https://www.reddit.com/api/v1/access_token", () =>
      HttpResponse.json({
        access_token: "at_live",
        refresh_token: "rt_live",
        token_type: "bearer",
        expires_in: 3600,
        scope: "identity submit",
      }),
    ),
    http.get("https://oauth.reddit.com/api/v1/me", () =>
      HttpResponse.json({ name: "steve_ops" }),
    ),
  );
}

describe("POST /api/integrations/[destination]/oauth (begin)", () => {
  it("unknown destination → 400 naming it", async () => {
    const res = await OAUTH_BEGIN(beginReq("myspace"), param("myspace"));
    expect(res.status).toBe(400);
  });

  it("a non-oauth2 destination refuses 409 with its flavor", async () => {
    const res = await OAUTH_BEGIN(beginReq("bluesky"), param("bluesky"));
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('"app_password"');
  });

  it("a missing operator app pair refuses 409 naming BOTH keys", async () => {
    delete process.env.SOCIAL_REDDIT_CLIENT_ID;
    delete process.env.SOCIAL_REDDIT_CLIENT_SECRET;
    const res = await OAUTH_BEGIN(beginReq("reddit"), param("reddit"));
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("SOCIAL_REDDIT_CLIENT_ID");
    expect(body.error).toContain("SOCIAL_REDDIT_CLIENT_SECRET");
  });

  it("armed with the pair + origin → the consent URL (duration=permanent, exact callback) and a stored flight", async () => {
    const res = await OAUTH_BEGIN(beginReq("reddit"), param("reddit"));
    expect(res.status).toBe(200);
    const { authorizeUrl } = (await res.json()) as { authorizeUrl: string };
    const url = new URL(authorizeUrl);
    expect(url.searchParams.get("duration")).toBe("permanent");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://app.example.com/api/integrations/callback/reddit",
    );
    const state = url.searchParams.get("state");
    expect(state).toBeTruthy();
    const row = await repos!.oauthStates.consume(ctx!, state!, new Date());
    expect(row.destination).toBe("reddit");
  });
});

describe("GET /api/integrations/callback/[destination]", () => {
  it("the platform's own refusal (?error=…) redirects back with its words — never a stranded page", async () => {
    const res = await CALLBACK(callbackReq("reddit", { error: "access_denied" }), param("reddit"));
    expect(res.status).toBeGreaterThanOrEqual(302);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/app/settings/integrations");
    expect(location.searchParams.get("connect_error")).toContain("access_denied");
  });

  it("the full dance: begin → callback exchanges, seals the pair, stamps identity, redirects ?connected — and the state is single-use", async () => {
    stubExchange();
    const begin = await OAUTH_BEGIN(beginReq("reddit"), param("reddit"));
    const { authorizeUrl } = (await begin.json()) as { authorizeUrl: string };
    const state = new URL(authorizeUrl).searchParams.get("state")!;

    const res = await CALLBACK(
      callbackReq("reddit", { code: "the-code", state }),
      param("reddit"),
    );
    const location = new URL(res.headers.get("location")!);
    expect(location.searchParams.get("connected")).toBe("reddit");

    const row = await repos!.tenantCredentials.get(ctx!, "reddit");
    expect(row).not.toBeNull();
    expect(row!.connectedAs).toBe("u/steve_ops");
    expect(row!.expiresAt).not.toBeNull();
    // Sealed, never plaintext on the row.
    expect(row!.ciphertext).not.toContain("at_live");

    // Replay: the flight was consumed — the operator is told, nothing stored twice.
    const replay = await CALLBACK(
      callbackReq("reddit", { code: "the-code", state }),
      param("reddit"),
    );
    const replayLocation = new URL(replay.headers.get("location")!);
    expect(replayLocation.searchParams.get("connect_error")).toBeTruthy();
  });

  it("a callback with no code/state redirects with the honest ask to start again", async () => {
    const res = await CALLBACK(callbackReq("reddit", {}), param("reddit"));
    const location = new URL(res.headers.get("location")!);
    expect(location.searchParams.get("connect_error")).toContain("start the connect again");
  });
});
