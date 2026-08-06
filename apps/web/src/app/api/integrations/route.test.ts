import { DESTINATION_KEYS, tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, sha256Hex, type DbHandle, type Repos } from "@thalon/db";
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

const { GET } = await import("./route");
const { DELETE } = await import("./[destination]/route");
const { POST: CONNECT } = await import("./[destination]/connect/route");
const { POST: VALIDATE } = await import("./[destination]/validate/route");
const { GET: PUBLISHED } = await import("./published/route");

/**
 * B-int.2 route family: cards read (honest states over the whole registry),
 * mode-2 connect (shape-checked, sealed, validated in one call), on-demand
 * validate, disconnect, and the published view. Platform pings ride MSW —
 * no live network, ever.
 */

let handle: DbHandle | undefined;
let ctx: TenantCtx | undefined;
const MASTER_B64 = Buffer.alloc(32, 9).toString("base64");

beforeEach(async () => {
  process.env.THALON_VAULT_MASTER_KEY = MASTER_B64;
  handle = await openTestDb();
  repos = handle.repos;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self", plan: "internal" });
  ctx = tenantCtx(tenant.id);
});

afterEach(async () => {
  delete process.env.THALON_VAULT_MASTER_KEY;
  repos = undefined;
  ctx = undefined;
  await handle?.close();
  handle = undefined;
});

function param(destination: string): { params: Promise<{ destination: string }> } {
  return { params: Promise.resolve({ destination }) };
}

function connectReq(body: unknown): Request {
  return new Request("http://test.local/api/integrations/x/connect", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** The LinkedIn pair: unversioned userinfo + the s69 versioned-pin probe. */
function linkedinGreen(): void {
  server.use(
    http.get("https://api.linkedin.com/v2/userinfo", () =>
      HttpResponse.json({ sub: "abc", name: "Steven" }),
    ),
    http.post("https://api.linkedin.com/rest/images", () =>
      HttpResponse.json({ code: "MISSING_REQUIRED_FIELD" }, { status: 400 }),
    ),
  );
}

describe("GET /api/integrations (the cards read)", () => {
  it("serves the COMPLETE registry, fresh tenant reading not_connected everywhere", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const { cards } = (await res.json()) as {
      cards: Array<{ destination: string; state: string; fields: unknown[] }>;
    };
    expect(cards.map((c) => c.destination)).toEqual(DESTINATION_KEYS);
    for (const card of cards) expect(card.state).toBe("not_connected");
  });

  /**
   * Phase 0 (s112): the MASTER key reaches the surface, so the arm control can
   * stop offering "Live — due posts go out on their own" on a deployment whose
   * tick cannot send anything. It is a disclosure and the read is the only way
   * the page can learn it — if this stops being served the surface silently
   * goes back to claiming an outcome the box cannot produce.
   */
  it("discloses the queue's MASTER key, and reads it exactly like the consumer does", async () => {
    const saved = process.env.SOCIAL_QUEUE_ARMED;
    try {
      delete process.env.SOCIAL_QUEUE_ARMED;
      const off = (await (await GET()).json()) as { queueArmed: boolean };
      expect(off.queueArmed, "absent must read as NOT armed").toBe(false);

      // The exactly-"true" rule the consumer uses: anything that merely looks
      // affirmative must never arm a seam.
      for (const nearly of ["1", "TRUE", "yes", "", "true "]) {
        process.env.SOCIAL_QUEUE_ARMED = nearly;
        const res = (await (await GET()).json()) as { queueArmed: boolean };
        expect(res.queueArmed, `"${nearly}" must not arm the queue`).toBe(false);
      }

      process.env.SOCIAL_QUEUE_ARMED = "true";
      const on = (await (await GET()).json()) as { queueArmed: boolean };
      expect(on.queueArmed).toBe(true);
    } finally {
      if (saved === undefined) delete process.env.SOCIAL_QUEUE_ARMED;
      else process.env.SOCIAL_QUEUE_ARMED = saved;
    }
  });
});

describe("POST /api/integrations/:destination/connect (mode-2 guided connect)", () => {
  it("rejects an unknown destination and a malformed paste loudly — nothing stores, issue paths only", async () => {
    expect((await CONNECT(connectReq({ credentials: {} }), param("myspace"))).status).toBe(400);

    const bad = await CONNECT(connectReq({ credentials: { accessToken: "" } }), param("linkedin"));
    expect(bad.status).toBe(400);
    const body = (await bad.json()) as { error: string; fields: string[] };
    expect(body.fields).toEqual(["accessToken"]);
    expect(body.error).not.toContain("Bearer");

    const cards = (await (await GET()).json()) as { cards: Array<{ destination: string; state: string }> };
    expect(cards.cards.find((c) => c.destination === "linkedin")?.state).toBe("not_connected");
  });

  it("seals, validates in the same call, and the probe-discovered identity lands on the card", async () => {
    linkedinGreen();
    const res = await CONNECT(
      connectReq({ credentials: { accessToken: "tok" } }),
      param("linkedin"),
    );
    expect(res.status).toBe(200);
    const { card, probe } = (await res.json()) as {
      card: { state: string; connectedAs: string | null; validatedAt: string | null };
      probe: { outcome: string };
    };
    expect(probe.outcome).toBe("validated");
    expect(card.state).toBe("connected");
    expect(card.connectedAs).toBe("Steven");
    expect(card.validatedAt).not.toBeNull();
    // The response never carries the pasted secret or an envelope field.
    const raw = JSON.stringify({ card, probe });
    expect(raw).not.toContain("tok");
    expect(raw).not.toContain("ciphertext");
  });

  it("a pasted-but-dead token comes back needs_reauth immediately — connect is never silently green", async () => {
    server.use(
      http.get("https://api.linkedin.com/v2/userinfo", () =>
        HttpResponse.json({ message: "expired" }, { status: 401 }),
      ),
    );
    const res = await CONNECT(
      connectReq({ credentials: { accessToken: "dead" } }),
      param("linkedin"),
    );
    expect(res.status).toBe(200);
    const { card, probe } = (await res.json()) as {
      card: { state: string };
      probe: { outcome: string };
    };
    expect(probe.outcome).toBe("auth_failed");
    expect(card.state).toBe("needs_reauth");
  });
});

describe("POST /api/integrations/:destination/validate + DELETE (the card's other doors)", () => {
  it("validate on a never-connected destination is an honest 404; disconnect then empties the card", async () => {
    expect((await VALIDATE(new Request("http://t"), param("linkedin"))).status).toBe(404);

    linkedinGreen();
    await CONNECT(connectReq({ credentials: { accessToken: "tok" } }), param("linkedin"));
    const revalidated = await VALIDATE(new Request("http://t"), param("linkedin"));
    expect(revalidated.status).toBe(200);

    const gone = await DELETE(new Request("http://t"), param("linkedin"));
    expect(gone.status).toBe(200);
    const cards = (await (await GET()).json()) as { cards: Array<{ destination: string; state: string }> };
    expect(cards.cards.find((c) => c.destination === "linkedin")?.state).toBe("not_connected");
  });
});

describe("GET /api/integrations/published (the published view)", () => {
  it("joins the social ledger newest-first with the way back on every item", async () => {
    if (!repos || !ctx) throw new Error("setup failed");
    // Minimal draft chain for a ledger row.
    const profile = await repos.brandProfiles.create(ctx, {
      config: { voice: {}, denylist: [], platformProfiles: {} },
      activate: true,
    });
    const source = await repos.sources.create(ctx, { kind: "prompt", contentHash: sha256Hex("b") });
    const run = await repos.fanoutRuns.create(ctx, {
      sourceId: source.id,
      brandProfileId: profile.id,
      brandProfileVersion: profile.version,
      platforms: ["linkedin"],
      promptVersion: "fanout.v1",
      model: "test/model",
      generationKey: sha256Hex(`${ctx.tenantId}:run-1`),
    });
    const draft = await repos.drafts.create(ctx, {
      fanoutRunId: run.id,
      sourceId: source.id,
      platform: "linkedin",
      body: "The first live post.",
      generationKey: sha256Hex(`${ctx.tenantId}:draft-1`),
    });
    await repos.socialPublications.record(ctx, {
      draftId: draft.id,
      platform: "linkedin",
      externalPostId: "urn:li:share:9",
      bodyHash: sha256Hex(draft.body),
      publishedAt: new Date("2026-07-25T09:00:00Z"),
      meta: { permalink: "https://www.linkedin.com/feed/update/urn:li:share:9" },
    });

    const res = await PUBLISHED();
    expect(res.status).toBe(200);
    const view = (await res.json()) as {
      items: Array<{ kind: string; permalink?: string; excerpt?: string }>;
      socialTotal: number;
      webTotal: number;
    };
    expect(view.socialTotal).toBe(1);
    expect(view.webTotal).toBe(0);
    expect(view.items).toHaveLength(1);
    expect(view.items[0].permalink).toBe("https://www.linkedin.com/feed/update/urn:li:share:9");
    expect(view.items[0].excerpt).toBe("The first live post.");
  });
});
