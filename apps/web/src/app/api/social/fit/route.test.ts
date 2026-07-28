import { openTestDb, sha256Hex, type DbHandle, type Repos } from "@thalon/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let repos: Repos | undefined;
vi.mock("@/lib/repos", () => ({
  getRepos: () => {
    if (!repos) throw new Error("test db not opened");
    return Promise.resolve(repos);
  },
}));

const { GET } = await import("./route");

let handle: DbHandle | undefined;
let ctx = { tenantId: "" };
let runId = "";
let sourceId = "";
let seq = 0;

beforeEach(async () => {
  handle = await openTestDb();
  repos = handle.repos;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  ctx = { tenantId: tenant.id };
  const profile = await repos.brandProfiles.create(ctx, {
    config: { voice: {}, denylist: [], platformProfiles: {} },
    activate: true,
  });
  const source = await repos.sources.create(ctx, { kind: "prompt", contentHash: sha256Hex("s") });
  sourceId = source.id;
  const run = await repos.fanoutRuns.create(ctx, {
    sourceId: source.id,
    brandProfileId: profile.id,
    brandProfileVersion: profile.version,
    platforms: ["linkedin"],
    promptVersion: "fanout.v1",
    model: "test/model",
    generationKey: sha256Hex(`${tenant.id}:fit-run`),
  });
  runId = run.id;
  seq = 0;
});

afterEach(async () => {
  repos = undefined;
  await handle?.close();
  handle = undefined;
});

async function draft(opts: { body?: string; platform?: string; meta?: Record<string, unknown> } = {}) {
  return repos!.drafts.create(ctx, {
    fanoutRunId: runId,
    sourceId,
    platform: opts.platform ?? "linkedin",
    body: opts.body ?? "A short, fitting post.",
    format: "post",
    generationKey: sha256Hex(`${ctx.tenantId}:fit-draft-${seq++}`),
    ...(opts.meta ? { meta: opts.meta } : {}),
  });
}

function req(query: string): Request {
  return new Request(`http://test.local/api/social/fit${query}`);
}

interface FitBody {
  supported: boolean;
  reason?: string;
  bodyHash?: string;
  suggestedAt?: string;
  fit?: {
    fits: boolean;
    problems: Array<{ code: string; message: string }>;
    text: { billedChars: number; maxChars: number; overBy: number; cutIndex: number; links: string[] };
  };
}

/**
 * C1 wiring #2 — the fit read behind Approve's fit line and preview. The
 * measurement rule lives ONCE, in the engine, and crosses the wire so the
 * preview and the queue producer's refusal can never be two implementations
 * of one rule that eventually disagree.
 */
describe("/api/social/fit", () => {
  it("measures the draft's CURRENT body against the platform's ceiling", async () => {
    const row = await draft({ body: "x".repeat(400) });
    const res = await GET(req(`?draftId=${row.id}&platform=x`));
    expect(res.status).toBe(200);
    const body = (await res.json()) as FitBody;
    expect(body.supported).toBe(true);
    expect(body.fit?.fits).toBe(false);
    expect(body.fit?.text.maxChars).toBe(280);
    expect(body.fit?.text.overBy).toBe(120);
    expect(body.fit?.problems[0].code).toBe("text_over_ceiling");
    // The hash the measurement describes — a caller can tell whether what it
    // is holding still describes the draft in front of it.
    expect(body.bodyHash).toBe(row.bodyHash);
  });

  it("defaults to the draft's OWN platform when the caller names none", async () => {
    const row = await draft({ body: "x".repeat(400) });
    const body = (await (await GET(req(`?draftId=${row.id}`))).json()) as FitBody;
    // linkedin's ceiling is 3000 — the same body that fails on X passes here.
    expect(body.fit?.fits).toBe(true);
    expect(body.fit?.text.maxChars).toBe(3000);
  });

  it("counts a link as X bills it — 23 characters, however long", async () => {
    const link = "https://thalon.example/a/very/long/path/indeed";
    const row = await draft({ body: `read ${link}` });
    const body = (await (await GET(req(`?draftId=${row.id}&platform=x`))).json()) as FitBody;
    expect(body.fit?.text.billedChars).toBe("read ".length + 23);
    expect(body.fit?.text.links).toEqual([link]);
  });

  it("reads the draft's media, so Instagram's text-only refusal is honest either way", async () => {
    const textOnly = await draft({ platform: "instagram" });
    const withoutMedia = (await (
      await GET(req(`?draftId=${textOnly.id}&platform=instagram`))
    ).json()) as FitBody;
    expect(withoutMedia.fit?.problems.map((p) => p.code)).toEqual(["media_required"]);

    const withMedia = await draft({
      platform: "instagram",
      meta: { mediaRefs: [{ ref: "social-media/abc.jpg", contentType: "image/jpeg" }] },
    });
    const measured = (await (
      await GET(req(`?draftId=${withMedia.id}&platform=instagram`))
    ).json()) as FitBody;
    expect(measured.fit?.fits).toBe(true);
  });

  it("says plainly when a platform has no capability row rather than inventing one", async () => {
    const row = await draft({ platform: "blog" });
    const body = (await (await GET(req(`?draftId=${row.id}`))).json()) as FitBody;
    expect(body.supported).toBe(false);
    expect(body.reason).toContain("blog");
  });

  it("suggests a slot in the future, derived from the operator's own rhythm", async () => {
    const row = await draft();
    const planned = new Date(Date.now() - 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000);
    await repos!.plannedSlots.plan(ctx, {
      draftId: row.id,
      scheduledFor: planned.toISOString(),
    });
    const body = (await (await GET(req(`?draftId=${row.id}`))).json()) as FitBody;
    const at = new Date(body.suggestedAt as string);
    expect(at.getTime()).toBeGreaterThan(Date.now());
    // The reused time of day is the operator's own, not an invented default.
    expect(at.getUTCHours()).toBe(planned.getUTCHours());
    expect(at.getUTCMinutes()).toBe(planned.getUTCMinutes());
  });

  it("names the draft, and a foreign one reads as absent (the tenancy wall)", async () => {
    expect((await GET(req(""))).status).toBe(400);
    expect((await GET(req("?draftId=00000000-0000-4000-8000-000000000000"))).status).toBe(404);
  });
});
