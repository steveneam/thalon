import { FINAL_JUDGE_GATE, tenantCtx, type TenantCtx } from "@thalon/contracts";
import {
  InvalidStateError,
  NotFoundError,
  openTestDb,
  sha256Hex,
  type DbHandle,
  type Draft,
  type Repos,
} from "@thalon/db";
import { afterEach, describe, expect, it } from "vitest";
import {
  SocialDraftNotApprovedError,
  SocialFormatNotPublishableError,
  SocialPostDoesNotFitError,
  SocialScheduleInPastError,
} from "../errors";
import { scheduleApprovedDraft, suggestNextSlot } from "../schedule";

/**
 * C2 (s82): the queue producer. The refusal ladder is the point — a queue
 * row is a COMMITMENT, so everything that would make the commitment
 * dishonest is refused before the row exists, and the frozen repo keeps
 * owning idempotency and the clash.
 */

const NOW = new Date(Date.UTC(2026, 6, 28, 9, 0));
const SOON = new Date(Date.UTC(2026, 6, 28, 18, 0));
const POST_BODY = "Three ways trades businesses turn their site into local work.";

let handle: DbHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

interface Fixture {
  ctx: TenantCtx;
  repos: Repos;
  runId: string;
  sourceId: string;
  seq: { n: number };
}

async function setup(): Promise<Fixture> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  const ctx = tenantCtx(tenant.id);
  const profile = await repos.brandProfiles.create(ctx, {
    config: {
      voice: {},
      denylist: [],
      platformProfiles: {},
      identity: { company: "Thalon", links: { site: "https://thalon.example" } },
    },
    activate: true,
  });
  const { source } = await repos.sourceChunks.ingest(ctx, {
    kind: "prompt",
    contentHash: sha256Hex("schedule brief"),
    chunks: [{ seq: 0, text: "Brief.", tokenCount: 1, contentHash: sha256Hex("brief-0") }],
  });
  const run = await repos.fanoutRuns.create(ctx, {
    sourceId: source.id,
    brandProfileId: profile.id,
    brandProfileVersion: profile.version,
    platforms: ["linkedin"],
    promptVersion: "fanout-generate.v2",
    model: "test/model",
    generationKey: `${ctx.tenantId}:schedule-run`,
  });
  return { ctx, repos, runId: run.id, sourceId: source.id, seq: { n: 0 } };
}

async function approve(f: Fixture, draft: Draft): Promise<Draft> {
  await f.repos.drafts.transition(f.ctx, draft.id, "judging");
  await f.repos.judgeResults.append(f.ctx, {
    draftId: draft.id,
    gate: FINAL_JUDGE_GATE,
    verdict: "pass",
  });
  await f.repos.drafts.transition(f.ctx, draft.id, "queued");
  return f.repos.drafts.transition(f.ctx, draft.id, "approved");
}

async function draftFor(
  f: Fixture,
  opts: { body?: string; format?: string; platform?: string; approve?: boolean; meta?: Record<string, unknown> } = {},
): Promise<Draft> {
  const draft = await f.repos.drafts.create(f.ctx, {
    fanoutRunId: f.runId,
    sourceId: f.sourceId,
    platform: opts.platform ?? "linkedin",
    body: opts.body ?? POST_BODY,
    format: opts.format ?? "post",
    generationKey: `${f.ctx.tenantId}:schedule-draft-${f.seq.n++}`,
    meta: opts.meta ?? {},
  });
  return opts.approve === false ? draft : approve(f, draft);
}

describe("scheduleApprovedDraft — the producer's refusal ladder", () => {
  it("writes ONE queue row for an approved, fitting draft at a future slot", async () => {
    const f = await setup();
    const draft = await draftFor(f);
    const { row, created, fit } = await scheduleApprovedDraft(
      { ctx: f.ctx, repos: f.repos },
      { draftId: draft.id, platform: "linkedin", scheduledAt: SOON.toISOString() },
      NOW,
    );
    expect(created).toBe(true);
    expect(row.status).toBe("pending");
    expect(row.draftId).toBe(draft.id);
    expect(row.scheduledAt?.toISOString()).toBe(SOON.toISOString());
    expect(fit.fits).toBe(true);
    // The row is a commitment, not a publish — nothing reached a platform.
    expect(await f.repos.socialPublications.listForDraft(f.ctx, draft.id)).toEqual([]);
  });

  it("rung a: a missing draft throws NotFoundError (the tenancy wall)", async () => {
    const f = await setup();
    await expect(
      scheduleApprovedDraft(
        { ctx: f.ctx, repos: f.repos },
        { draftId: "00000000-0000-4000-8000-000000000000", platform: "x", scheduledAt: SOON },
        NOW,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rung a: a non-publishable format refuses — the registry flag decides, never a name branch", async () => {
    const f = await setup();
    const email = await draftFor(f, { format: "outreach_email" });
    await expect(
      scheduleApprovedDraft(
        { ctx: f.ctx, repos: f.repos },
        { draftId: email.id, platform: "linkedin", scheduledAt: SOON },
        NOW,
      ),
    ).rejects.toBeInstanceOf(SocialFormatNotPublishableError);
  });

  it("rung a: an unapproved draft cannot be committed to a time", async () => {
    const f = await setup();
    const draft = await draftFor(f, { approve: false });
    const err = await scheduleApprovedDraft(
      { ctx: f.ctx, repos: f.repos },
      { draftId: draft.id, platform: "linkedin", scheduledAt: SOON },
      NOW,
    ).catch((e) => e);
    expect(err).toBeInstanceOf(SocialDraftNotApprovedError);
    expect((err as Error).message).toContain('status "generated"');
  });

  it("rung b: a slot in the past refuses — a past slot is 'publish now' in a schedule's clothes", async () => {
    const f = await setup();
    const draft = await draftFor(f);
    const past = new Date(NOW.getTime() - 60_000);
    const err = await scheduleApprovedDraft(
      { ctx: f.ctx, repos: f.repos },
      { draftId: draft.id, platform: "linkedin", scheduledAt: past },
      NOW,
    ).catch((e) => e);
    expect(err).toBeInstanceOf(SocialScheduleInPastError);
    expect((err as Error).message).toContain(past.toISOString());
    expect(await f.repos.publishQueue.list(f.ctx)).toEqual([]);
  });

  it("rung b: NOW itself is not the future — the boundary refuses", async () => {
    const f = await setup();
    const draft = await draftFor(f);
    await expect(
      scheduleApprovedDraft(
        { ctx: f.ctx, repos: f.repos },
        { draftId: draft.id, platform: "linkedin", scheduledAt: NOW },
        NOW,
      ),
    ).rejects.toBeInstanceOf(SocialScheduleInPastError);
  });

  it("rung c: a post the platform will bounce never becomes a commitment", async () => {
    const f = await setup();
    const draft = await draftFor(f, { body: "x".repeat(400) });
    const err = await scheduleApprovedDraft(
      { ctx: f.ctx, repos: f.repos },
      { draftId: draft.id, platform: "x", scheduledAt: SOON },
      NOW,
    ).catch((e) => e);
    expect(err).toBeInstanceOf(SocialPostDoesNotFitError);
    expect((err as Error).message).toContain("280");
    expect(await f.repos.publishQueue.list(f.ctx)).toEqual([]);
  });

  it("rung c: the SAME body fits LinkedIn and not X — the platform decides, not the draft", async () => {
    const f = await setup();
    const draft = await draftFor(f, { body: "x".repeat(400) });
    const { row } = await scheduleApprovedDraft(
      { ctx: f.ctx, repos: f.repos },
      { draftId: draft.id, platform: "linkedin", scheduledAt: SOON },
      NOW,
    );
    expect(row.platform).toBe("linkedin");
    await expect(
      scheduleApprovedDraft(
        { ctx: f.ctx, repos: f.repos },
        { draftId: draft.id, platform: "x", scheduledAt: SOON },
        NOW,
      ),
    ).rejects.toBeInstanceOf(SocialPostDoesNotFitError);
  });

  it("rung c: a text-only draft cannot be scheduled to Instagram", async () => {
    const f = await setup();
    const draft = await draftFor(f, { platform: "instagram" });
    const err = await scheduleApprovedDraft(
      { ctx: f.ctx, repos: f.repos },
      { draftId: draft.id, platform: "instagram", scheduledAt: SOON },
      NOW,
    ).catch((e) => e);
    expect(err).toBeInstanceOf(SocialPostDoesNotFitError);
    expect((err as Error).message).toContain("text-only");
  });

  it("rung c: the fit is measured on the CURRENT body, never on the generation stamp", async () => {
    const f = await setup();
    // A stamp claiming it fits, over a body that does not.
    const draft = await draftFor(f, {
      body: "x".repeat(400),
      meta: { platformFit: { fits: true, problems: [], billedChars: 10, maxChars: 280, bodyHash: "stale" } },
    });
    await expect(
      scheduleApprovedDraft(
        { ctx: f.ctx, repos: f.repos },
        { draftId: draft.id, platform: "x", scheduledAt: SOON },
        NOW,
      ),
    ).rejects.toBeInstanceOf(SocialPostDoesNotFitError);
  });

  it("does NOT check arming — scheduling for an unarmed platform is legitimate; the row waits", async () => {
    const f = await setup();
    // The tenant has no `social` block at all: the publish door would refuse
    // at rung c. The producer still commits the row — arming is the
    // consumer's question, and a queue unusable before the founder's GO
    // would defeat the purpose.
    const draft = await draftFor(f);
    const { row } = await scheduleApprovedDraft(
      { ctx: f.ctx, repos: f.repos },
      { draftId: draft.id, platform: "linkedin", scheduledAt: SOON },
      NOW,
    );
    expect(row.status).toBe("pending");
  });

  it("replaying the exact same schedule writes nothing new (the repo's idempotency)", async () => {
    const f = await setup();
    const draft = await draftFor(f);
    const first = await scheduleApprovedDraft(
      { ctx: f.ctx, repos: f.repos },
      { draftId: draft.id, platform: "linkedin", scheduledAt: SOON },
      NOW,
    );
    const replay = await scheduleApprovedDraft(
      { ctx: f.ctx, repos: f.repos },
      { draftId: draft.id, platform: "linkedin", scheduledAt: SOON },
      NOW,
    );
    expect(replay.created).toBe(false);
    expect(replay.row.id).toBe(first.row.id);
    expect(await f.repos.publishQueue.list(f.ctx)).toHaveLength(1);
  });

  it("a DIFFERENT time for an already-queued draft+platform refuses, naming the row in the way", async () => {
    const f = await setup();
    const draft = await draftFor(f);
    await scheduleApprovedDraft(
      { ctx: f.ctx, repos: f.repos },
      { draftId: draft.id, platform: "linkedin", scheduledAt: SOON },
      NOW,
    );
    const err = await scheduleApprovedDraft(
      { ctx: f.ctx, repos: f.repos },
      { draftId: draft.id, platform: "linkedin", scheduledAt: new Date(SOON.getTime() + 3_600_000) },
      NOW,
    ).catch((e) => e);
    expect(err).toBeInstanceOf(InvalidStateError);
    expect((err as Error).message).toContain("cancel that row");
  });

  it("planned slots and queue rows stay DISTINCT facts — scheduling writes no plan", async () => {
    const f = await setup();
    const draft = await draftFor(f);
    await scheduleApprovedDraft(
      { ctx: f.ctx, repos: f.repos },
      { draftId: draft.id, platform: "linkedin", scheduledAt: SOON },
      NOW,
    );
    expect(await f.repos.plannedSlots.getForDraft(f.ctx, draft.id)).toBeNull();
  });

  it("the queue row's write emits its own event — the engine invents no second audit path", async () => {
    const f = await setup();
    const draft = await draftFor(f);
    const { row } = await scheduleApprovedDraft(
      { ctx: f.ctx, repos: f.repos },
      { draftId: draft.id, platform: "linkedin", scheduledAt: SOON },
      NOW,
    );
    const events = await f.repos.events.list(f.ctx, {
      entityType: "publish_queue",
      entityId: row.id,
    });
    expect(events.map((e) => e.event)).toEqual(["publish_queue.enqueued"]);
  });
});

describe("suggestNextSlot — derived from the planned_slots grammar", () => {
  const now = new Date(Date.UTC(2026, 6, 28, 9, 13));

  it("with no history at all, snaps forward from now (the calendar's own 15-minute snap)", () => {
    const at = suggestNextSlot({ taken: [], now, leadMinutes: 60 });
    expect(at.toISOString()).toBe(new Date(Date.UTC(2026, 6, 28, 10, 15)).toISOString());
  });

  it("reuses the operator's own time of day rather than inventing one", () => {
    const yesterday = new Date(Date.UTC(2026, 6, 27, 18, 30));
    const at = suggestNextSlot({ taken: [yesterday], now, leadMinutes: 60 });
    expect(at.toISOString()).toBe(new Date(Date.UTC(2026, 6, 28, 18, 30)).toISOString());
  });

  it("rolls forward a day when the reused time has already passed today", () => {
    const early = new Date(Date.UTC(2026, 6, 27, 7, 0));
    const at = suggestNextSlot({ taken: [early], now, leadMinutes: 60 });
    expect(at.toISOString()).toBe(new Date(Date.UTC(2026, 6, 29, 7, 0)).toISOString());
  });

  it("skips a day whose slot is already taken — the suggestion never collides", () => {
    const rhythm = new Date(Date.UTC(2026, 6, 27, 18, 30));
    const tomorrowTaken = new Date(Date.UTC(2026, 6, 28, 18, 30));
    const at = suggestNextSlot({
      taken: [rhythm, tomorrowTaken],
      now,
      leadMinutes: 60,
      gapMinutes: 60,
    });
    expect(at.toISOString()).toBe(new Date(Date.UTC(2026, 6, 29, 18, 30)).toISOString());
  });

  it("respects the lead time — nothing is ever suggested for the next few minutes", () => {
    const at = suggestNextSlot({ taken: [], now, leadMinutes: 180 });
    expect(at.getTime()).toBeGreaterThanOrEqual(now.getTime() + 180 * 60_000);
  });

  it("is pure — the same inputs give the same instant, twice", () => {
    const taken = [new Date(Date.UTC(2026, 6, 27, 18, 30))];
    expect(suggestNextSlot({ taken, now }).toISOString()).toBe(
      suggestNextSlot({ taken, now }).toISOString(),
    );
  });
});
