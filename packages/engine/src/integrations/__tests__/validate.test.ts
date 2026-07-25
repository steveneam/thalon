import { DESTINATION_KEYS, tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle } from "@thalon/db";
import { readEnv, type ThalonEnv } from "@thalon/platform";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { connectDestination, type VaultDeps } from "../vault";
import { validateDestination, VALIDATE_PROBES } from "../validate";

/**
 * B-int.1 pins: the validate-ping seam — complete over the registry, honest
 * about what it can check, and conservative about what flips a card:
 * validated stamps connected+validatedAt, an auth-shaped refusal marks
 * needs_reauth, an unreachable network changes NOTHING.
 */

const MASTER_B64 = Buffer.alloc(32, 5).toString("base64");

let handle: DbHandle;
let ctx: TenantCtx;
let env: ThalonEnv;

function deps(): VaultDeps {
  return { repos: handle.repos, ctx, env };
}

/** A capturing fake fetch: records (url, init) and returns the scripted response. */
function fakeFetch(status: number, body: unknown) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const impl = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response;
  }) as typeof fetch;
  return { impl, calls };
}

const neverFetch = (async () => {
  throw new Error("this probe must not touch the network");
}) as typeof fetch;

/** A sequenced fake fetch for multi-call probes: one scripted (status, body) per call, in order. */
function fakeFetchSeq(responses: Array<{ status: number; body: unknown }>) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const impl = (async (url: unknown, init?: RequestInit) => {
    const scripted = responses[calls.length];
    if (!scripted) throw new Error(`unscripted fetch call #${calls.length + 1} to ${String(url)}`);
    calls.push({ url: String(url), init });
    return {
      ok: scripted.status >= 200 && scripted.status < 300,
      status: scripted.status,
      json: async () => scripted.body,
    } as Response;
  }) as typeof fetch;
  return { impl, calls };
}

beforeEach(async () => {
  handle = await openTestDb();
  const tenant = await handle.repos.tenants.create({ slug: "self", name: "Self" });
  ctx = tenantCtx(tenant.id);
  env = readEnv({ THALON_VAULT_MASTER_KEY: MASTER_B64 });
});

afterEach(async () => {
  await handle.close();
});

describe("the probe registry", () => {
  it("is COMPLETE: every destination in the contracts registry has a probe (or an explicit unsupported)", () => {
    for (const key of DESTINATION_KEYS) {
      expect(VALIDATE_PROBES[key], `destination "${key}" shipped without a validate probe`).toBeTypeOf(
        "function",
      );
    }
  });
});

describe("validateDestination", () => {
  it("a green probe flips needs_reauth → connected and stamps validatedAt", async () => {
    await connectDestination(deps(), {
      destination: "linkedin",
      credentials: { accessToken: "tok" },
    });
    await handle.repos.tenantCredentials.markStatus(ctx, "linkedin", "needs_reauth");
    const { impl, calls } = fakeFetch(200, { sub: "abc123", name: "Steven" });
    const at = new Date("2026-07-25T05:00:00Z");

    const result = await validateDestination(deps(), "linkedin", { fetchImpl: impl, now: () => at });

    expect(result.probe).toEqual({ outcome: "validated", connectedAs: "Steven" });
    expect(result.flipped).toBe("connected");
    expect(calls[0].url).toBe("https://api.linkedin.com/v2/userinfo");
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    const row = await handle.repos.tenantCredentials.get(ctx, "linkedin");
    expect(row?.status).toBe("connected");
    expect(row?.validatedAt?.toISOString()).toBe(at.toISOString());
    // The probe's discovered identity lands on the card.
    expect(row?.connectedAs).toBe("Steven");
  });

  it("a probe WITHOUT identity data never erases a hand-set connected-as", async () => {
    await connectDestination(deps(), {
      destination: "newsletter_resend",
      credentials: { apiKey: "rk" },
      connectedAs: "ops@example.com",
    });
    const { impl } = fakeFetch(200, {});
    const result = await validateDestination(deps(), "newsletter_resend", { fetchImpl: impl });
    expect(result.probe.outcome).toBe("validated");
    expect((await handle.repos.tenantCredentials.get(ctx, "newsletter_resend"))?.connectedAs).toBe(
      "ops@example.com",
    );
  });

  it("linkedin ALSO probes one VERSIONED endpoint (s69: userinfo alone hid a dead pin) — an active pin answers 400 and validates", async () => {
    await connectDestination(deps(), {
      destination: "linkedin",
      credentials: { accessToken: "tok" },
    });
    const { impl, calls } = fakeFetchSeq([
      { status: 200, body: { sub: "abc123", name: "Steven" } },
      { status: 400, body: { code: "MISSING_REQUIRED_FIELD" } },
    ]);

    const result = await validateDestination(deps(), "linkedin", { fetchImpl: impl });

    expect(result.probe).toEqual({ outcome: "validated", connectedAs: "Steven" });
    expect(result.flipped).toBe("connected");
    expect(calls).toHaveLength(2);
    expect(calls[1].url).toBe("https://api.linkedin.com/rest/images?action=initializeUpload");
    const headers = calls[1].init?.headers as Record<string, string>;
    expect(headers["LinkedIn-Version"]).toMatch(/^\d{6}$/);
    // The malformed body is the point — nothing can ever be initialized.
    expect(calls[1].init?.body).toBe("{}");
  });

  it("linkedin: a DEAD version pin (426) degrades to unreachable — loud detail, but the credential card is NOT flipped", async () => {
    await connectDestination(deps(), {
      destination: "linkedin",
      credentials: { accessToken: "tok" },
    });
    const { impl } = fakeFetchSeq([
      { status: 200, body: { sub: "abc123" } },
      { status: 426, body: { code: "NONEXISTENT_VERSION" } },
    ]);

    const result = await validateDestination(deps(), "linkedin", { fetchImpl: impl });

    expect(result.probe.outcome).toBe("unreachable");
    expect((result.probe as { detail: string }).detail).toContain("LinkedIn-Version");
    expect((result.probe as { detail: string }).detail).toContain("426");
    expect(result.flipped).toBeNull();
    const row = await handle.repos.tenantCredentials.get(ctx, "linkedin");
    expect(row?.status).toBe("connected");
    expect(row?.validatedAt).toBeNull();
  });

  it("linkedin: versioned-endpoint flakiness (5xx) never blocks validation — userinfo already proved the token", async () => {
    await connectDestination(deps(), {
      destination: "linkedin",
      credentials: { accessToken: "tok" },
    });
    const { impl } = fakeFetchSeq([
      { status: 200, body: { name: "Steven" } },
      { status: 503, body: {} },
    ]);

    const result = await validateDestination(deps(), "linkedin", { fetchImpl: impl });

    expect(result.probe).toEqual({ outcome: "validated", connectedAs: "Steven" });
    expect(result.flipped).toBe("connected");
  });

  it("an auth-shaped refusal (401) marks needs_reauth, detail carries status phrasing only", async () => {
    await connectDestination(deps(), {
      destination: "x",
      credentials: { accessToken: "dead-tok" },
    });
    const { impl } = fakeFetch(401, { title: "Unauthorized" });

    const result = await validateDestination(deps(), "x", { fetchImpl: impl });

    expect(result.probe.outcome).toBe("auth_failed");
    expect(result.flipped).toBe("needs_reauth");
    expect((result.probe as { detail: string }).detail).not.toContain("dead-tok");
    expect((await handle.repos.tenantCredentials.get(ctx, "x"))?.status).toBe("needs_reauth");
  });

  it("an unreachable network flips NOTHING — not a credential problem", async () => {
    await connectDestination(deps(), {
      destination: "newsletter_resend",
      credentials: { apiKey: "rk" },
    });
    const result = await validateDestination(deps(), "newsletter_resend", { fetchImpl: neverFetch });

    expect(result.probe.outcome).toBe("unreachable");
    expect(result.flipped).toBeNull();
    const row = await handle.repos.tenantCredentials.get(ctx, "newsletter_resend");
    expect(row?.status).toBe("connected");
    expect(row?.validatedAt).toBeNull();
  });

  it("a platform 5xx is unreachable, not auth_failed — the card keeps its state", async () => {
    await connectDestination(deps(), {
      destination: "intel_youtube",
      credentials: { apiKey: "yk" },
    });
    const { impl } = fakeFetch(503, {});
    const result = await validateDestination(deps(), "intel_youtube", { fetchImpl: impl });
    expect(result.probe.outcome).toBe("unreachable");
    expect(result.flipped).toBeNull();
  });

  it("website_hosted validates without touching the network (no secret to check)", async () => {
    await connectDestination(deps(), { destination: "website_hosted", credentials: {} });
    const result = await validateDestination(deps(), "website_hosted", { fetchImpl: neverFetch });
    expect(result.probe.outcome).toBe("validated");
    expect(result.flipped).toBe("connected");
  });

  it("website_webhook is honestly UNSUPPORTED — no fake validation, no flip, no network", async () => {
    await connectDestination(deps(), {
      destination: "website_webhook",
      credentials: { url: "https://example.com/hook" },
    });
    await handle.repos.tenantCredentials.markStatus(ctx, "website_webhook", "needs_reauth");
    const result = await validateDestination(deps(), "website_webhook", { fetchImpl: neverFetch });
    expect(result.probe.outcome).toBe("unsupported");
    expect(result.flipped).toBeNull();
    expect((await handle.repos.tenantCredentials.get(ctx, "website_webhook"))?.status).toBe(
      "needs_reauth",
    );
  });

  it("wordpress probes users/me with Basic auth built from the pasted pair", async () => {
    await connectDestination(deps(), {
      destination: "website_wordpress",
      credentials: { baseUrl: "https://blog.example.com/", username: "steve", applicationPassword: "app pass" },
    });
    const { impl, calls } = fakeFetch(200, { name: "Steve" });
    const result = await validateDestination(deps(), "website_wordpress", { fetchImpl: impl });

    expect(result.probe).toEqual({ outcome: "validated", connectedAs: "Steve" });
    expect(calls[0].url).toBe("https://blog.example.com/wp-json/wp/v2/users/me");
    const auth = (calls[0].init?.headers as Record<string, string>).Authorization;
    expect(auth).toBe(`Basic ${Buffer.from("steve:app pass", "utf8").toString("base64")}`);
  });

  it("credentials ride HEADERS, never the probe URL", async () => {
    await connectDestination(deps(), {
      destination: "intel_youtube",
      credentials: { apiKey: "SECRET-YT-KEY" },
    });
    const { impl, calls } = fakeFetch(200, {});
    await validateDestination(deps(), "intel_youtube", { fetchImpl: impl });
    expect(calls[0].url).not.toContain("SECRET-YT-KEY");
    expect((calls[0].init?.headers as Record<string, string>)["X-Goog-Api-Key"]).toBe(
      "SECRET-YT-KEY",
    );
  });
});
