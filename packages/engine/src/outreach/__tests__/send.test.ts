import {
  FINAL_JUDGE_GATE,
  tenantCtx,
  type ConsentBasis,
  type TenantCtx,
} from "@thalon/contracts";
import {
  DuplicateSendError,
  NotFoundError,
  openTestDb,
  sha256Hex,
  type DbHandle,
  type Draft,
  type LeadRow,
  type Repos,
} from "@thalon/db";
import { readEnv } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import {
  ConsentRefusedError,
  DailyCapReachedError,
  DraftAlreadySentError,
  DraftNotApprovedError,
  LeadNotContactableError,
  NotSendableFormatError,
  NotSendDayError,
  OutreachDisarmedError,
  SenderIdentityError,
  SequenceCompleteError,
  TouchNotDueError,
} from "../errors";
import { sendApprovedEmail } from "../send";
import { createFakeSendTransport, resolveSendTransport, TransportDisarmedError } from "../transport";

const DAY = 24 * 60 * 60 * 1000;
/** 2026-07-15T12:00Z = Wednesday (default send-day weights: weekdays on, wed 1.5, weekends 0). */
const WED_NOON = Date.UTC(2026, 6, 15, 12);
const MON_NOON = WED_NOON + 5 * DAY;
const SAT_NOON = WED_NOON + 3 * DAY;

const IDENTITY = { company: "Thalon", links: { site: "https://thalon.example" } };
const SUBJECT = "A quick thought for Riverbend Plumbing";
const EMAIL_BODY = [
  "Hi Sam,",
  "Thalon helps trades businesses turn their site into local work — see https://thalon.example.",
  'If you would rather not hear from us, reply "unsubscribe" and we never write again.',
].join("\n\n");

let handle: DbHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

interface Fixture {
  ctx: TenantCtx;
  /** The REAL repos over the frozen surface — the outreach block persists through create/getActive (the s54 gap closed at Sprint-8 window 2), so no test double arms the door. */
  repos: Repos;
  profile: { id: string; version: number };
  runId: string;
  sourceId: string;
  lead: LeadRow;
  draftSeq: { n: number };
}

/** `sequence: null` = create the profile WITHOUT an outreach block (the disarmed-tenant case); undefined = `{}`, which the write door parses to the full defaults. */
async function setup(
  opts: {
    identity?: Record<string, unknown>;
    sequence?: Record<string, unknown> | null;
    consentBasis?: ConsentBasis;
  } = {},
): Promise<Fixture> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  const ctx = tenantCtx(tenant.id);
  const sequence = opts.sequence === null ? undefined : (opts.sequence ?? {});
  const profile = await repos.brandProfiles.create(ctx, {
    config: {
      voice: {},
      denylist: [],
      platformProfiles: {},
      identity: opts.identity ?? IDENTITY,
      ...(sequence ? { outreach: sequence } : {}),
    },
    activate: true,
  });
  const { source } = await repos.sourceChunks.ingest(ctx, {
    kind: "prompt",
    contentHash: sha256Hex("lead brief"),
    chunks: [{ seq: 0, text: "Brief.", tokenCount: 1, contentHash: sha256Hex("brief-0") }],
  });
  const run = await repos.fanoutRuns.create(ctx, {
    sourceId: source.id,
    brandProfileId: profile.id,
    brandProfileVersion: profile.version,
    platforms: ["email"],
    promptVersion: "outreach-email-generate.v3",
    model: "test/model",
    generationKey: `${ctx.tenantId}:send-run`,
  });
  const basis = opts.consentBasis ?? "express";
  const { lead } = await repos.leads.add(ctx, {
    source: "csv",
    email: "sam@riverbendplumbing.example",
    name: "Sam Reyes",
    // "none" defers to the column default — consent never gained by omission.
    ...(basis !== "none"
      ? { consentBasis: basis, consentProvenance: { note: "waitlist signup 2026-07-14" } }
      : {}),
  });
  const scored = await repos.leads.setStatus(ctx, lead.id, "scored");
  return {
    ctx,
    repos,
    profile: { id: profile.id, version: profile.version },
    runId: run.id,
    sourceId: source.id,
    lead: scored,
    draftSeq: { n: 0 },
  };
}

async function approve(ctx: TenantCtx, repos: Repos, draft: Draft): Promise<Draft> {
  await repos.drafts.transition(ctx, draft.id, "judging");
  await repos.judgeResults.append(ctx, { draftId: draft.id, gate: FINAL_JUDGE_GATE, verdict: "pass" });
  await repos.drafts.transition(ctx, draft.id, "queued");
  return repos.drafts.transition(ctx, draft.id, "approved");
}

async function createOutreachDraft(
  f: Fixture,
  opts: {
    leadId?: string;
    email?: string;
    name?: string | null;
    subject?: string;
    emailBody?: string;
    approve?: boolean;
  } = {},
): Promise<Draft> {
  const subject = opts.subject ?? SUBJECT;
  const emailBody = opts.emailBody ?? EMAIL_BODY;
  const draft = await f.repos.drafts.create(f.ctx, {
    fanoutRunId: f.runId,
    sourceId: f.sourceId,
    platform: "email",
    // The registry expectedBody derivation (I1): body = subject + emailBody.
    body: [subject, emailBody].join("\n\n"),
    format: "outreach_email",
    generationKey: `${f.ctx.tenantId}:send-draft-${f.draftSeq.n++}`,
    meta: {
      subject,
      emailBody,
      recipient: {
        leadId: opts.leadId ?? f.lead.id,
        email: opts.email ?? f.lead.email,
        name: opts.name === undefined ? f.lead.name : opts.name,
      },
      groundingSourceIds: [f.sourceId],
      promptVersion: "outreach-email-generate.v3",
      brandProfileVersion: f.profile.version,
      platformProfileVersion: "outreach-email.v1",
    },
  });
  return opts.approve === false ? draft : approve(f.ctx, f.repos, draft);
}

/** A ledger filler: records a real send row (FK-walled) without going through the door. */
async function recordFiller(
  f: Fixture,
  opts: { leadId?: string; sentAtMs: number; touchIndex?: number },
): Promise<{ draftId: string }> {
  const draft = await createOutreachDraft(f, { approve: false });
  await f.repos.outreachSends.record(f.ctx, {
    sentAt: new Date(opts.sentAtMs),
    leadId: opts.leadId ?? f.lead.id,
    draftId: draft.id,
    provider: "resend",
    providerMessageId: `filler-${draft.id}`,
    recipientEmail: f.lead.email,
    bodyHash: draft.bodyHash,
    touchIndex: opts.touchIndex ?? 0,
  });
  return { draftId: draft.id };
}

function door(f: Fixture, draftId: string, nowMs: number, repos?: Repos) {
  return sendApprovedEmail(
    f.ctx,
    repos ?? f.repos,
    { draftId, nowMs },
    { transport: createFakeSendTransport() },
  );
}

describe("sendApprovedEmail — the refusal ladder, arm by arm", () => {
  it("arm a: a missing draft throws NotFoundError (the tenant wall)", async () => {
    const f = await setup();
    await expect(door(f, "00000000-0000-4000-8000-000000000000", WED_NOON)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("arm a: a non-sendable format refuses — only registry-sendable formats reach the door", async () => {
    const f = await setup();
    const post = await f.repos.drafts.create(f.ctx, {
      fanoutRunId: f.runId,
      sourceId: f.sourceId,
      platform: "linkedin",
      body: "a social post",
      format: "post",
      generationKey: `${f.ctx.tenantId}:post-draft`,
      meta: {},
    });
    const approved = await approve(f.ctx, f.repos, post);
    await expect(door(f, approved.id, WED_NOON)).rejects.toBeInstanceOf(NotSendableFormatError);
  });

  it("arm a: an unapproved draft refuses — it re-enters the gate, never the door", async () => {
    const f = await setup();
    const draft = await createOutreachDraft(f, { approve: false });
    const rejection = await door(f, draft.id, WED_NOON).catch((err) => err);
    expect(rejection).toBeInstanceOf(DraftNotApprovedError);
    expect((rejection as Error).message).toContain('status "generated"');
  });

  it("arm b: a missing lead throws NotFoundError", async () => {
    const f = await setup();
    const draft = await createOutreachDraft(f, {
      leadId: "00000000-0000-4000-8000-000000000001",
    });
    const rejection = await door(f, draft.id, WED_NOON).catch((err) => err);
    expect(rejection).toBeInstanceOf(NotFoundError);
    expect((rejection as Error).message).toContain("lead");
  });

  it("arm b: an unsubscribed lead REFUSES — the one-way door, no send path ever crosses it", async () => {
    const f = await setup();
    const draft = await createOutreachDraft(f);
    await f.repos.leads.setStatus(f.ctx, f.lead.id, "unsubscribed");
    const rejection = await door(f, draft.id, WED_NOON).catch((err) => err);
    expect(rejection).toBeInstanceOf(LeadNotContactableError);
    expect((rejection as Error).message).toContain("unsubscribed");
    expect((rejection as Error).message).toContain("ONE-WAY");
  });

  it('arm b: a lead not yet scored refuses (status "new")', async () => {
    const f = await setup();
    const { lead: fresh } = await f.repos.leads.add(f.ctx, {
      source: "csv",
      email: "kim@example.com",
      consentBasis: "express",
    });
    const draft = await createOutreachDraft(f, { leadId: fresh.id, email: fresh.email, name: null });
    const rejection = await door(f, draft.id, WED_NOON).catch((err) => err);
    expect(rejection).toBeInstanceOf(LeadNotContactableError);
    expect((rejection as LeadNotContactableError).status).toBe("new");
  });

  it('arm c: consent basis "none" refuses (AU Spam Act invariant 1 — the default, never gained by omission)', async () => {
    const f = await setup({ consentBasis: "none" });
    const draft = await createOutreachDraft(f);
    const rejection = await door(f, draft.id, WED_NOON).catch((err) => err);
    expect(rejection).toBeInstanceOf(ConsentRefusedError);
    expect((rejection as ConsentRefusedError).basis).toBe("none");
  });

  it("arm d: an identity block without a company name refuses — an unnamed sender cannot be verified", async () => {
    const f = await setup({ identity: {} });
    const draft = await createOutreachDraft(f);
    const rejection = await door(f, draft.id, WED_NOON).catch((err) => err);
    expect(rejection).toBeInstanceOf(SenderIdentityError);
    expect((rejection as Error).message).toContain("identity.company");
  });

  it("arm d: a judged body that never names the sender refuses (invariant 2)", async () => {
    const f = await setup();
    const draft = await createOutreachDraft(f, {
      subject: "A quick thought",
      emailBody: 'Hi Sam,\n\nSee https://thalon.example.\n\nReply "unsubscribe" to opt out.',
    });
    const rejection = await door(f, draft.id, WED_NOON).catch((err) => err);
    expect(rejection).toBeInstanceOf(SenderIdentityError);
    expect((rejection as Error).message).toContain("never names the sender");
  });

  it("arm d: an identity block with no links refuses — no contactable identity configured", async () => {
    const f = await setup({ identity: { company: "Thalon" } });
    const draft = await createOutreachDraft(f);
    const rejection = await door(f, draft.id, WED_NOON).catch((err) => err);
    expect(rejection).toBeInstanceOf(SenderIdentityError);
    expect((rejection as Error).message).toContain("no links");
  });

  it("arm d: a judged body without any identity link refuses — the recipient must be able to reach the sender", async () => {
    const f = await setup();
    const draft = await createOutreachDraft(f, {
      emailBody: 'Hi Sam,\n\nThalon can help.\n\nReply "unsubscribe" to opt out.',
    });
    const rejection = await door(f, draft.id, WED_NOON).catch((err) => err);
    expect(rejection).toBeInstanceOf(SenderIdentityError);
    expect((rejection as Error).message).toContain("contact links");
  });

  it("arm d: a judged body without an unsubscribe affordance refuses", async () => {
    const f = await setup();
    const draft = await createOutreachDraft(f, {
      emailBody: "Hi Sam,\n\nThalon can help — see https://thalon.example.",
    });
    const rejection = await door(f, draft.id, WED_NOON).catch((err) => err);
    expect(rejection).toBeInstanceOf(SenderIdentityError);
    expect((rejection as Error).message).toContain("unsubscribe");
  });

  it('arm e: a profile without an "outreach" block refuses — absence disarms (the s54 persistence gap closed at Sprint-8 window 2: the block now rides the REAL path)', async () => {
    const f = await setup({ sequence: null });
    const draft = await createOutreachDraft(f);
    const rejection = await door(f, draft.id, WED_NOON).catch((err) => err);
    expect(rejection).toBeInstanceOf(OutreachDisarmedError);
    expect((rejection as Error).message).toContain('"outreach" block');
  });

  it("arm e: the daily batch cap refuses at the ceiling (UTC day window)", async () => {
    const f = await setup({ sequence: { dailyBatchCap: 1 } });
    await recordFiller(f, { sentAtMs: WED_NOON - 60 * 60 * 1000 }); // same UTC day
    const draft = await createOutreachDraft(f);
    const rejection = await door(f, draft.id, WED_NOON).catch((err) => err);
    expect(rejection).toBeInstanceOf(DailyCapReachedError);
    expect((rejection as DailyCapReachedError).cap).toBe(1);
    expect((rejection as DailyCapReachedError).sentToday).toBe(1);
  });

  it("arm e: an already-sent draft refuses — a draft is sent at most once, ever", async () => {
    const f = await setup();
    const draft = await createOutreachDraft(f);
    await f.repos.outreachSends.record(f.ctx, {
      sentAt: new Date(WED_NOON - 7 * DAY),
      leadId: f.lead.id,
      draftId: draft.id,
      provider: "resend",
      providerMessageId: "already-sent-1",
      recipientEmail: f.lead.email,
      bodyHash: draft.bodyHash,
      touchIndex: 0,
    });
    const rejection = await door(f, draft.id, WED_NOON).catch((err) => err);
    expect(rejection).toBeInstanceOf(DraftAlreadySentError);
    expect((rejection as DraftAlreadySentError).providerMessageId).toBe("already-sent-1");
  });

  it("arm e: a touch ahead of its offset refuses with the exact due time", async () => {
    const f = await setup();
    await recordFiller(f, { sentAtMs: WED_NOON }); // touch 0 on Wednesday
    const draft = await createOutreachDraft(f);
    const rejection = await door(f, draft.id, WED_NOON + DAY).catch((err) => err); // Thursday
    expect(rejection).toBeInstanceOf(TouchNotDueError);
    expect((rejection as TouchNotDueError).touchIndex).toBe(1);
    expect((rejection as TouchNotDueError).dueAtMs).toBe(WED_NOON + 3 * DAY); // D3
  });

  it("arm e: an exhausted sequence refuses — nothing further is ever due", async () => {
    const f = await setup({ sequence: { touchOffsetsDays: [0] } });
    await recordFiller(f, { sentAtMs: WED_NOON });
    const draft = await createOutreachDraft(f);
    const rejection = await door(f, draft.id, WED_NOON + 7 * DAY).catch((err) => err);
    expect(rejection).toBeInstanceOf(SequenceCompleteError);
  });

  it("arm e: a weight-0 day refuses — weekends are off by default", async () => {
    const f = await setup();
    const draft = await createOutreachDraft(f);
    const rejection = await door(f, draft.id, SAT_NOON).catch((err) => err);
    expect(rejection).toBeInstanceOf(NotSendDayError);
    expect((rejection as NotSendDayError).day).toBe("sat");
  });
});

describe("sendApprovedEmail — through the door (fake transport only)", () => {
  it("touch 0: sends the judged pieces, records the audit snapshot, crosses scored → contacted", async () => {
    const f = await setup();
    const draft = await createOutreachDraft(f);
    const transport = createFakeSendTransport();
    const result = await sendApprovedEmail(
      f.ctx,
      f.repos,
      { draftId: draft.id, nowMs: WED_NOON },
      { transport },
    );

    // The transport saw the judged pieces — subject line + email body, never the joined claim surface.
    expect(transport.calls).toEqual([{ to: f.lead.email, subject: SUBJECT, text: EMAIL_BODY }]);

    // The ledger row snapshots what actually left.
    expect(result.send.providerMessageId).toBe("fake-msg-1");
    expect(result.send.provider).toBe("resend");
    expect(result.send.recipientEmail).toBe(f.lead.email);
    expect(result.send.bodyHash).toBe(draft.bodyHash);
    expect(result.send.touchIndex).toBe(0);
    expect(result.send.sentAt.getTime()).toBe(WED_NOON);
    expect((await f.repos.outreachSends.getByDraft(f.ctx, draft.id))?.id).toBe(result.send.id);

    // First touch crosses the lifecycle door.
    expect(result.touchIndex).toBe(0);
    expect(result.transitioned).toBe(true);
    expect(result.lead.status).toBe("contacted");
  });

  it("touch 2 skips the transition — the lead is already contacted", async () => {
    const f = await setup();
    const transport = createFakeSendTransport();
    const first = await createOutreachDraft(f);
    await sendApprovedEmail(f.ctx, f.repos, { draftId: first.id, nowMs: WED_NOON }, { transport });

    const second = await createOutreachDraft(f);
    // D3 falls on Saturday (weight 0); Monday is the earliest send day past due.
    const result = await sendApprovedEmail(
      f.ctx,
      f.repos,
      { draftId: second.id, nowMs: MON_NOON },
      { transport },
    );
    expect(result.touchIndex).toBe(1);
    expect(result.send.touchIndex).toBe(1);
    expect(result.send.providerMessageId).toBe("fake-msg-2");
    expect(result.transitioned).toBe(false);
    expect(result.lead.status).toBe("contacted");
  });

  it("a transport failure records NOTHING — no ledger row, no lifecycle change", async () => {
    const f = await setup();
    const draft = await createOutreachDraft(f);
    const transport = createFakeSendTransport({ failWith: new Error("provider down") });
    await expect(
      sendApprovedEmail(f.ctx, f.repos, { draftId: draft.id, nowMs: WED_NOON }, { transport }),
    ).rejects.toThrow("provider down");
    expect(transport.calls).toHaveLength(1); // the door DID reach the transport
    expect(await f.repos.outreachSends.getByDraft(f.ctx, draft.id)).toBeNull();
    expect((await f.repos.leads.get(f.ctx, f.lead.id))?.status).toBe("scored");
  });

  it("the unique key backstops the pre-check: a raced double-send surfaces DuplicateSendError LOUD", async () => {
    const f = await setup();
    const draft = await createOutreachDraft(f);
    await sendApprovedEmail(
      f.ctx,
      f.repos,
      { draftId: draft.id, nowMs: WED_NOON },
      { transport: createFakeSendTransport() },
    );
    // Simulate the race: this door's pre-send reads miss the row another
    // process just recorded — the repo's (tenant, draft) unique key must
    // still fail LOUD, never idempotent-replay (the provider call happened).
    const racing: Repos = {
      ...f.repos,
      outreachSends: {
        ...f.repos.outreachSends,
        getByDraft: async () => null,
        listForLead: async () => [],
      },
    };
    await expect(
      sendApprovedEmail(
        f.ctx,
        racing,
        { draftId: draft.id, nowMs: WED_NOON },
        { transport: createFakeSendTransport() },
      ),
    ).rejects.toBeInstanceOf(DuplicateSendError);
  });

  it("disarmed by default: resolveSendTransport over an empty env refuses even a fully-armed door", async () => {
    const f = await setup();
    const draft = await createOutreachDraft(f);
    await expect(
      sendApprovedEmail(
        f.ctx,
        f.repos,
        { draftId: draft.id, nowMs: WED_NOON },
        { transport: resolveSendTransport(readEnv({})) },
      ),
    ).rejects.toBeInstanceOf(TransportDisarmedError);
    expect(await f.repos.outreachSends.getByDraft(f.ctx, draft.id)).toBeNull();
    expect((await f.repos.leads.get(f.ctx, f.lead.id))?.status).toBe("scored");
  });
});
