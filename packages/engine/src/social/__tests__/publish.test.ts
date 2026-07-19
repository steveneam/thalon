import { FINAL_JUDGE_GATE, tenantCtx, type SocialPlatform, type TenantCtx } from "@thalon/contracts";
import {
  DuplicatePublicationError,
  NotFoundError,
  openTestDb,
  sha256Hex,
  type DbHandle,
  type Draft,
  type Repos,
} from "@thalon/db";
import { afterEach, describe, expect, it } from "vitest";
import {
  DraftAlreadyPublishedError,
  SocialCredentialInvalidError,
  SocialDailyCapReachedError,
  SocialDraftNotApprovedError,
  SocialFormatNotPublishableError,
  SocialPublishDisarmedError,
  SocialPublisherDisarmedError,
} from "../errors";
import { publishApprovedDraft } from "../publish";
import {
  createFakeSocialPublisher,
  resolveSocialPublisher,
  type FakeSocialPublisher,
  type SocialPublisher,
} from "../registry";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(Date.UTC(2026, 6, 15, 12));
const POST_BODY = "Three ways trades businesses turn their site into local work. A thread.";

let handle: DbHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

interface Fixture {
  ctx: TenantCtx;
  /** The REAL repos over the frozen surface — the social block persists through create/getActive (Sprint-8 window 2), so no test double arms the door. */
  repos: Repos;
  runId: string;
  sourceId: string;
  draftSeq: { n: number };
}

/** `social: null` = create the profile WITHOUT a social block (the disarmed-tenant case); undefined = the default armed block. */
async function setup(
  opts: { social?: Record<string, unknown> | null } = {},
): Promise<Fixture> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  const ctx = tenantCtx(tenant.id);
  const social =
    opts.social === null ? undefined : (opts.social ?? { linkedin: { maxPostsPerDay: 2 } });
  const profile = await repos.brandProfiles.create(ctx, {
    config: {
      voice: {},
      denylist: [],
      platformProfiles: {},
      identity: { company: "Thalon", links: { site: "https://thalon.example" } },
      ...(social ? { social } : {}),
    },
    activate: true,
  });
  const { source } = await repos.sourceChunks.ingest(ctx, {
    kind: "prompt",
    contentHash: sha256Hex("post brief"),
    chunks: [{ seq: 0, text: "Brief.", tokenCount: 1, contentHash: sha256Hex("brief-0") }],
  });
  const run = await repos.fanoutRuns.create(ctx, {
    sourceId: source.id,
    brandProfileId: profile.id,
    brandProfileVersion: profile.version,
    platforms: ["linkedin"],
    promptVersion: "fanout-generate.v1",
    model: "test/model",
    generationKey: `${ctx.tenantId}:publish-run`,
  });
  return {
    ctx,
    repos,
    runId: run.id,
    sourceId: source.id,
    draftSeq: { n: 0 },
  };
}

async function approve(ctx: TenantCtx, repos: Repos, draft: Draft): Promise<Draft> {
  await repos.drafts.transition(ctx, draft.id, "judging");
  await repos.judgeResults.append(ctx, { draftId: draft.id, gate: FINAL_JUDGE_GATE, verdict: "pass" });
  await repos.drafts.transition(ctx, draft.id, "queued");
  return repos.drafts.transition(ctx, draft.id, "approved");
}

async function createPostDraft(
  f: Fixture,
  opts: { body?: string; format?: string; approve?: boolean } = {},
): Promise<Draft> {
  const draft = await f.repos.drafts.create(f.ctx, {
    fanoutRunId: f.runId,
    sourceId: f.sourceId,
    platform: "linkedin",
    body: opts.body ?? POST_BODY,
    format: opts.format ?? "post",
    generationKey: `${f.ctx.tenantId}:publish-draft-${f.draftSeq.n++}`,
    meta: {},
  });
  return opts.approve === false ? draft : approve(f.ctx, f.repos, draft);
}

/** A ledger filler: records a real publication row (FK-walled) without going through the door. */
async function recordFiller(
  f: Fixture,
  opts: { platform?: string; publishedAt: Date },
): Promise<void> {
  const draft = await createPostDraft(f, { approve: false });
  await f.repos.socialPublications.record(f.ctx, {
    draftId: draft.id,
    platform: opts.platform ?? "linkedin",
    externalPostId: `filler-${draft.id}`,
    bodyHash: draft.bodyHash,
    publishedAt: opts.publishedAt,
  });
}

function door(
  f: Fixture,
  draftId: string,
  opts: {
    repos?: Repos;
    publisher?: SocialPublisher;
    platform?: SocialPlatform;
    now?: Date;
  } = {},
): { publisher: SocialPublisher; result: ReturnType<typeof publishApprovedDraft> } {
  const publisher = opts.publisher ?? createFakeSocialPublisher();
  const result = publishApprovedDraft(
    { ctx: f.ctx, repos: opts.repos ?? f.repos, resolvePublisher: () => publisher },
    { draftId, platform: opts.platform ?? "linkedin" },
    opts.now ?? NOW,
  );
  return { publisher, result };
}

describe("publishApprovedDraft — the refusal ladder, rung by rung", () => {
  it("rung a: a missing draft throws NotFoundError (the tenant wall)", async () => {
    const f = await setup();
    const { result } = door(f, "00000000-0000-4000-8000-000000000000");
    await expect(result).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rung a: a non-post format refuses — only the social post family reaches this door", async () => {
    const f = await setup();
    const email = await createPostDraft(f, { format: "outreach_email" });
    const rejection = await door(f, email.id).result.catch((err) => err);
    expect(rejection).toBeInstanceOf(SocialFormatNotPublishableError);
    expect((rejection as Error).message).toContain("outreach_email");
  });

  it("rung a: an unapproved draft refuses — it re-enters the gate, never the door", async () => {
    const f = await setup();
    const draft = await createPostDraft(f, { approve: false });
    const rejection = await door(f, draft.id).result.catch((err) => err);
    expect(rejection).toBeInstanceOf(SocialDraftNotApprovedError);
    expect((rejection as Error).message).toContain('status "generated"');
  });

  it("rung b: an unarmed platform refuses BEFORE any call, naming its missing arms verbatim", async () => {
    const f = await setup();
    const draft = await createPostDraft(f);
    const unarmed = resolveSocialPublisher("linkedin", {});
    const rejection = await door(f, draft.id, { publisher: unarmed }).result.catch((err) => err);
    expect(rejection).toBeInstanceOf(SocialPublisherDisarmedError);
    expect((rejection as Error).message).toContain("SOCIAL_LINKEDIN_ACCESS_TOKEN");
    expect((rejection as Error).message).toContain("SOCIAL_LINKEDIN_ARMED");
    expect(await f.repos.socialPublications.listForDraft(f.ctx, draft.id)).toEqual([]);
  });

  it("rung b: an invalid credential shape refuses (dead credentials surface from drivers at B-pub.2+)", async () => {
    const f = await setup();
    const draft = await createPostDraft(f);
    const invalid = resolveSocialPublisher(
      "linkedin",
      { SOCIAL_LINKEDIN_ACCESS_TOKEN: "tok\nbroken", SOCIAL_LINKEDIN_ARMED: "true" },
      { linkedin: () => createFakeSocialPublisher() },
    );
    const rejection = await door(f, draft.id, { publisher: invalid }).result.catch((err) => err);
    expect(rejection).toBeInstanceOf(SocialCredentialInvalidError);
  });

  it('rung c: a profile without a "social" block refuses — absence disarms (the block now persists through the REAL path: the B-pub.1 gap closed at Sprint-8 window 2)', async () => {
    const f = await setup({ social: null });
    const draft = await createPostDraft(f);
    const rejection = await door(f, draft.id).result.catch((err) => err);
    expect(rejection).toBeInstanceOf(SocialPublishDisarmedError);
    expect((rejection as Error).message).toContain('"social" block');
  });

  it("rung c: no active brand profile refuses", async () => {
    const f = await setup();
    const draft = await createPostDraft(f);
    const bare: Repos = {
      ...f.repos,
      brandProfiles: { ...f.repos.brandProfiles, getActive: async () => null },
    };
    const rejection = await door(f, draft.id, { repos: bare }).result.catch((err) => err);
    expect(rejection).toBeInstanceOf(SocialPublishDisarmedError);
    expect((rejection as Error).message).toContain("no active brand profile");
  });

  it("rung c: a social block without the target platform refuses — an unconfigured platform is disarmed", async () => {
    const f = await setup({ social: { x: { maxPostsPerDay: 1 } } });
    const draft = await createPostDraft(f);
    const rejection = await door(f, draft.id).result.catch((err) => err);
    expect(rejection).toBeInstanceOf(SocialPublishDisarmedError);
    expect((rejection as Error).message).toContain('"linkedin"');
  });

  it("rung d: the per-platform daily cap refuses AT the cap", async () => {
    const f = await setup({ social: { linkedin: { maxPostsPerDay: 2 } } });
    await recordFiller(f, { publishedAt: new Date(NOW.getTime() - 60_000) });
    await recordFiller(f, { publishedAt: new Date(NOW.getTime() - 30_000) });
    const draft = await createPostDraft(f);
    const rejection = await door(f, draft.id).result.catch((err) => err);
    expect(rejection).toBeInstanceOf(SocialDailyCapReachedError);
    expect((rejection as SocialDailyCapReachedError).cap).toBe(2);
    expect((rejection as SocialDailyCapReachedError).publishedToday).toBe(2);
  });

  it("rung d: one-under the cap publishes — and yesterday's posts never count (UTC-day window)", async () => {
    const f = await setup({ social: { linkedin: { maxPostsPerDay: 2 } } });
    await recordFiller(f, { publishedAt: new Date(NOW.getTime() - DAY) });
    await recordFiller(f, { publishedAt: new Date(NOW.getTime() - 60_000) });
    const draft = await createPostDraft(f);
    const { result } = door(f, draft.id);
    const { publication } = await result;
    expect(publication.draftId).toBe(draft.id);
  });

  it("rung d: a cap of 0 = configured but paused — refuses immediately", async () => {
    const f = await setup({ social: { linkedin: { maxPostsPerDay: 0 } } });
    const draft = await createPostDraft(f);
    const rejection = await door(f, draft.id).result.catch((err) => err);
    expect(rejection).toBeInstanceOf(SocialDailyCapReachedError);
    expect((rejection as SocialDailyCapReachedError).cap).toBe(0);
  });

  it("rung e: a draft already on the platform refuses with the recorded external post id", async () => {
    const f = await setup();
    const draft = await createPostDraft(f);
    await f.repos.socialPublications.record(f.ctx, {
      draftId: draft.id,
      platform: "linkedin",
      externalPostId: "ext-1",
      bodyHash: draft.bodyHash,
      publishedAt: new Date(NOW.getTime() - 60_000),
    });
    const rejection = await door(f, draft.id).result.catch((err) => err);
    expect(rejection).toBeInstanceOf(DraftAlreadyPublishedError);
    expect((rejection as DraftAlreadyPublishedError).externalPostId).toBe("ext-1");
  });

  it("rung e: cross-posting the SAME draft to a DIFFERENT platform stays legal (the ledger's key design)", async () => {
    const f = await setup();
    const draft = await createPostDraft(f);
    await f.repos.socialPublications.record(f.ctx, {
      draftId: draft.id,
      platform: "x",
      externalPostId: "x-1",
      bodyHash: draft.bodyHash,
      publishedAt: new Date(NOW.getTime() - 60_000),
    });
    const { publisher, result } = door(f, draft.id);
    const { publication } = await result;
    expect(publication.platform).toBe("linkedin");
    expect((publisher as FakeSocialPublisher).calls).toHaveLength(1);
  });

  it("the racing backstop: a duplicate insert surfaces DuplicatePublicationError LOUD — the platform call already happened", async () => {
    const f = await setup();
    const draft = await createPostDraft(f);
    await f.repos.socialPublications.record(f.ctx, {
      draftId: draft.id,
      platform: "linkedin",
      externalPostId: "ext-raced",
      bodyHash: draft.bodyHash,
      publishedAt: new Date(NOW.getTime() - 60_000),
    });
    // Blind the pre-check to simulate the race: the unique key must still refuse.
    const blinded: Repos = {
      ...f.repos,
      socialPublications: { ...f.repos.socialPublications, listForDraft: async () => [] },
    };
    const { publisher, result } = door(f, draft.id, { repos: blinded });
    const rejection = await result.catch((err) => err);
    expect(rejection).toBeInstanceOf(DuplicatePublicationError);
    expect((publisher as FakeSocialPublisher).calls).toHaveLength(1);
  });
});

describe("publishApprovedDraft — the happy path", () => {
  it("platform accepted → ledger row + event, the judged body verbatim, exactly once", async () => {
    const f = await setup();
    const draft = await createPostDraft(f);
    const { publisher, result } = door(f, draft.id);
    const { publication } = await result;

    expect(publication.tenantId).toBe(f.ctx.tenantId);
    expect(publication.draftId).toBe(draft.id);
    expect(publication.platform).toBe("linkedin");
    expect(publication.externalPostId).toBe("fake-post-1");
    expect(publication.bodyHash).toBe(draft.bodyHash);
    expect(publication.publishedAt.getTime()).toBe(NOW.getTime());

    expect((publisher as FakeSocialPublisher).calls).toEqual([
      { draftId: draft.id, text: POST_BODY },
    ]);
    expect(await f.repos.socialPublications.listForDraft(f.ctx, draft.id)).toHaveLength(1);

    const events = await f.repos.events.list(f.ctx, { limit: 100 });
    expect(events.map((e) => e.event)).toContain("social.published");
  });

  it("a platform failure AFTER the call records NOTHING — a ledger row is only ever a platform-accepted fact", async () => {
    const f = await setup();
    const draft = await createPostDraft(f);
    const failing = createFakeSocialPublisher({ failWith: new Error("platform down") });
    const { result } = door(f, draft.id, { publisher: failing });
    await expect(result).rejects.toThrow("platform down");
    expect(failing.calls).toHaveLength(1);
    expect(await f.repos.socialPublications.listForDraft(f.ctx, draft.id)).toEqual([]);
  });
});
