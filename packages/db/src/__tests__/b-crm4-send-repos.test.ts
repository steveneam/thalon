import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { DuplicateSendError } from "../repos/outreach-sends";
import { fixture, type Fixture } from "./helpers";

/**
 * B-crm.4 send-window persistence (outreach_sends + leads consent/lifecycle,
 * migration 0014). Same discipline as b-crm5-learn-repos.test.ts: every
 * behavior test doubles as the tenancy-wall proof and the B4.4
 * events-coverage pin for this window's write fns
 * (`outreach_send.recorded` · `lead.consent_changed` · the widened
 * `lead.status_changed` transitions).
 */

let fx: Fixture | undefined;

afterEach(async () => {
  await fx?.close();
  fx = undefined;
});

async function setup(): Promise<{
  ctx: TenantCtx;
  other: TenantCtx;
  f: Fixture;
  leadId: string;
}> {
  fx = await fixture();
  const stranger = await fx.handle.repos.tenants.create({ slug: "other", name: "Other" });
  const { lead } = await fx.handle.repos.leads.add(fx.ctx, {
    source: "csv",
    email: "sam@example.com",
  });
  return { ctx: fx.ctx, other: tenantCtx(stranger.id), f: fx, leadId: lead.id };
}

function sendInput(leadId: string, draftId: string, overrides: Record<string, unknown> = {}) {
  return {
    leadId,
    draftId,
    provider: "resend" as const,
    providerMessageId: "re_abc123",
    recipientEmail: "sam@example.com",
    bodyHash: "hash-of-what-left",
    touchIndex: 0,
    sentAt: new Date(Date.UTC(2026, 6, 17, 3, 0, 0)),
    ...overrides,
  };
}

describe("outreachSends repo (B-crm.4 s54 window)", () => {
  it("records a provider-accepted send with its audit event and snapshots", async () => {
    const { ctx, f, leadId } = await setup();
    const send = await f.handle.repos.outreachSends.record(ctx, sendInput(leadId, f.draft.id));
    expect(send.provider).toBe("resend");
    expect(send.recipientEmail).toBe("sam@example.com");
    expect(send.bodyHash).toBe("hash-of-what-left");
    expect(send.touchIndex).toBe(0);

    const events = await f.handle.repos.events.list(ctx, { entityType: "outreach_send" });
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("outreach_send.recorded");

    const byDraft = await f.handle.repos.outreachSends.getByDraft(ctx, f.draft.id);
    expect(byDraft?.id).toBe(send.id);
  });

  it("a second send of the same draft FAILS LOUD (never an idempotent replay)", async () => {
    const { ctx, f, leadId } = await setup();
    await f.handle.repos.outreachSends.record(ctx, sendInput(leadId, f.draft.id));
    await expect(
      f.handle.repos.outreachSends.record(
        ctx,
        sendInput(leadId, f.draft.id, { providerMessageId: "re_second" }),
      ),
    ).rejects.toThrow(DuplicateSendError);
    // The failed attempt appended nothing — ledger and audit trail unchanged.
    expect(await f.handle.repos.outreachSends.listForLead(ctx, leadId)).toHaveLength(1);
    expect(await f.handle.repos.events.list(ctx, { entityType: "outreach_send" })).toHaveLength(1);
  });

  it("is tenancy-walled: foreign lead/draft refs throw NotFound; foreign reads see nothing", async () => {
    const { ctx, other, f, leadId } = await setup();
    // The stranger cannot record a send pointing at OUR lead/draft.
    await expect(
      f.handle.repos.outreachSends.record(other, sendInput(leadId, f.draft.id)),
    ).rejects.toThrow(/not found/i);

    await f.handle.repos.outreachSends.record(ctx, sendInput(leadId, f.draft.id));
    expect(await f.handle.repos.outreachSends.getByDraft(other, f.draft.id)).toBeNull();
    expect(await f.handle.repos.outreachSends.listForLead(other, leadId)).toHaveLength(0);
    expect(
      await f.handle.repos.outreachSends.countInWindow(other, {
        from: new Date(Date.UTC(2026, 6, 17)),
        to: new Date(Date.UTC(2026, 6, 18)),
      }),
    ).toBe(0);
  });

  it("countInWindow counts real sends in [from, to) — the ≤cap/day read", async () => {
    const { ctx, f, leadId } = await setup();
    // Two more drafts to send (a draft is sent at most once).
    const d2 = await f.handle.repos.drafts.create(ctx, {
      fanoutRunId: f.draft.fanoutRunId,
      sourceId: f.draft.sourceId,
      platform: "email",
      body: "second",
      generationKey: "gk-send-2",
    });
    const d3 = await f.handle.repos.drafts.create(ctx, {
      fanoutRunId: f.draft.fanoutRunId,
      sourceId: f.draft.sourceId,
      platform: "email",
      body: "third",
      generationKey: "gk-send-3",
    });
    const day = (h: number) => new Date(Date.UTC(2026, 6, 17, h));
    await f.handle.repos.outreachSends.record(ctx, sendInput(leadId, f.draft.id, { sentAt: day(1) }));
    await f.handle.repos.outreachSends.record(
      ctx,
      sendInput(leadId, d2.id, { sentAt: day(23), touchIndex: 1 }),
    );
    // Next day — outside the window.
    await f.handle.repos.outreachSends.record(
      ctx,
      sendInput(leadId, d3.id, { sentAt: new Date(Date.UTC(2026, 6, 18, 1)), touchIndex: 2 }),
    );
    expect(
      await f.handle.repos.outreachSends.countInWindow(ctx, {
        from: new Date(Date.UTC(2026, 6, 17)),
        to: new Date(Date.UTC(2026, 6, 18)),
      }),
    ).toBe(2);
    // listForLead = the cadence derivation read, oldest first.
    const history = await f.handle.repos.outreachSends.listForLead(ctx, leadId);
    expect(history.map((s) => s.touchIndex)).toEqual([0, 1, 2]);
  });

  it("refuses providers outside the contracts list at the zod door", async () => {
    const { ctx, f, leadId } = await setup();
    await expect(
      f.handle.repos.outreachSends.record(
        ctx,
        sendInput(leadId, f.draft.id, { provider: "sendgrid" }),
      ),
    ).rejects.toThrow();
  });
});

describe("leads consent + lifecycle (B-crm.4 s54 window)", () => {
  it("intake defaults to consent none; setConsent records basis + provenance with its event", async () => {
    const { ctx, f, leadId } = await setup();
    const before = await f.handle.repos.leads.get(ctx, leadId);
    expect(before?.consentBasis).toBe("none"); // never gained by omission

    const after = await f.handle.repos.leads.setConsent(ctx, leadId, {
      basis: "inferred-published",
      provenance: { sourceUrl: "https://example.com/contact", note: "published work address" },
    });
    expect(after.consentBasis).toBe("inferred-published");
    const events = await f.handle.repos.events.list(ctx, { entityType: "lead" });
    const consentEvents = events.filter((e) => e.event === "lead.consent_changed");
    expect(consentEvents).toHaveLength(1);
    expect(consentEvents[0].payload).toMatchObject({ from: "none", to: "inferred-published" });

    // Same values again = no-op, emits nothing (the setPinned convention).
    await f.handle.repos.leads.setConsent(ctx, leadId, {
      basis: "inferred-published",
      provenance: { sourceUrl: "https://example.com/contact", note: "published work address" },
    });
    expect(
      (await f.handle.repos.events.list(ctx, { entityType: "lead" })).filter(
        (e) => e.event === "lead.consent_changed",
      ),
    ).toHaveLength(1);

    // Withdrawal (→ none) must always be recordable — not a one-way door.
    const withdrawn = await f.handle.repos.leads.setConsent(ctx, leadId, { basis: "none" });
    expect(withdrawn.consentBasis).toBe("none");
  });

  it("intake paths that KNOW the basis carry it in (waitlist signup = express)", async () => {
    const { ctx, f } = await setup();
    const { lead } = await f.handle.repos.leads.add(ctx, {
      source: "waitlist",
      email: "signup@example.com",
      consentBasis: "express",
      consentProvenance: { note: "waitlist signup 2026-07-14" },
    });
    expect(lead.consentBasis).toBe("express");
  });

  it("setConsent is tenancy-walled", async () => {
    const { other, f, leadId } = await setup();
    await expect(
      f.handle.repos.leads.setConsent(other, leadId, { basis: "express" }),
    ).rejects.toThrow(/not found/i);
  });

  it("outreach lifecycle: scored → contacted; unsubscribed is TERMINAL from any live state", async () => {
    const { ctx, f, leadId } = await setup();
    await f.handle.repos.leads.setStatus(ctx, leadId, "scored");
    const contacted = await f.handle.repos.leads.setStatus(ctx, leadId, "contacted");
    expect(contacted.status).toBe("contacted");
    // contacted → scored is not a thing.
    await expect(f.handle.repos.leads.setStatus(ctx, leadId, "scored")).rejects.toThrow(
      /invalid lead transition/i,
    );
    const unsubscribed = await f.handle.repos.leads.setStatus(ctx, leadId, "unsubscribed");
    expect(unsubscribed.status).toBe("unsubscribed");
    // The one-way door: NOTHING leaves unsubscribed.
    for (const target of ["new", "scored", "contacted", "dismissed"] as const) {
      await expect(f.handle.repos.leads.setStatus(ctx, leadId, target)).rejects.toThrow(
        /invalid lead transition/i,
      );
    }
    // And it is reachable straight from `new` (a request can arrive any time).
    const { lead: fresh } = await f.handle.repos.leads.add(ctx, {
      source: "csv",
      email: "fresh@example.com",
    });
    const gone = await f.handle.repos.leads.setStatus(ctx, fresh.id, "unsubscribed");
    expect(gone.status).toBe("unsubscribed");
  });
});
