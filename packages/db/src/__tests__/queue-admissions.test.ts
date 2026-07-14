import { tenantCtx } from "@thalon/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { sha256Hex } from "../hash";
import type { Draft } from "../types";
import { fixture, type Fixture } from "./helpers";

const EPOCH = new Date(0);

let fx: Fixture | undefined;
afterEach(async () => {
  await fx?.close();
  fx = undefined;
});

/** generated → judging → queued through the real transition door (I1 needs the passing final row first). */
async function admit(f: Fixture, draft: Draft): Promise<void> {
  const { repos } = f.handle;
  await repos.drafts.transition(f.ctx, draft.id, "judging");
  await repos.judgeResults.append(f.ctx, {
    draftId: draft.id,
    gate: "g3_final",
    verdict: "pass",
  });
  await repos.drafts.transition(f.ctx, draft.id, "queued");
}

async function addDraft(f: Fixture, platform: string, n: number): Promise<Draft> {
  return f.handle.repos.drafts.create(f.ctx, {
    fanoutRunId: f.draft.fanoutRunId,
    sourceId: f.draft.sourceId,
    platform,
    body: `Draft number ${n}.`,
    generationKey: sha256Hex(`${f.ctx.tenantId}:extra-${n}`),
  });
}

describe("drafts.listQueueAdmissions (B7.a — read-only over the I4 audit spine)", () => {
  it("returns the admission for a queued draft, filtered by platform", async () => {
    fx = await fixture();
    await admit(fx, fx.draft);

    const alpha = await fx.handle.repos.drafts.listQueueAdmissions(fx.ctx, {
      platform: "alpha",
      since: EPOCH,
    });
    expect(alpha).toHaveLength(1);
    expect(alpha[0].draftId).toBe(fx.draft.id);
    expect(alpha[0].admittedAt).toBeInstanceOf(Date);

    const beta = await fx.handle.repos.drafts.listQueueAdmissions(fx.ctx, {
      platform: "beta",
      since: EPOCH,
    });
    expect(beta).toEqual([]);
  });

  it("an approved draft still consumes its slot; rejected and blocked drafts free theirs", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    await admit(fx, fx.draft);
    await repos.drafts.transition(fx.ctx, fx.draft.id, "approved");
    expect(
      await repos.drafts.listQueueAdmissions(fx.ctx, { platform: "alpha", since: EPOCH }),
    ).toHaveLength(1);

    const second = await addDraft(fx, "alpha", 2);
    await admit(fx, second);
    await repos.drafts.transition(fx.ctx, second.id, "rejected");
    const admissions = await repos.drafts.listQueueAdmissions(fx.ctx, {
      platform: "alpha",
      since: EPOCH,
    });
    expect(admissions.map((a) => a.draftId)).toEqual([fx.draft.id]);
  });

  it("respects `since` — admissions before the horizon are not returned", async () => {
    fx = await fixture();
    await admit(fx, fx.draft);
    const future = new Date(Date.now() + 60_000);
    expect(
      await fx.handle.repos.drafts.listQueueAdmissions(fx.ctx, {
        platform: "alpha",
        since: future,
      }),
    ).toEqual([]);
  });

  it("a re-admitted draft counts once, at its latest admission", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    await admit(fx, fx.draft);
    // The re-judge loop: queued → judging → queued writes a second to-queued
    // event for the same draft (body unchanged, so I1's existing passing
    // g3_final row still unlocks the queue).
    await repos.drafts.transition(fx.ctx, fx.draft.id, "judging");
    await repos.drafts.transition(fx.ctx, fx.draft.id, "queued");

    const admissions = await repos.drafts.listQueueAdmissions(fx.ctx, {
      platform: "alpha",
      since: EPOCH,
    });
    expect(admissions).toHaveLength(1);
    expect(admissions[0].draftId).toBe(fx.draft.id);
  });

  it("tenancy: another tenant's admissions are invisible", async () => {
    fx = await fixture();
    await admit(fx, fx.draft);
    const stranger = await fx.handle.repos.tenants.create({ slug: "other", name: "Other" });
    expect(
      await fx.handle.repos.drafts.listQueueAdmissions(tenantCtx(stranger.id), {
        platform: "alpha",
        since: EPOCH,
      }),
    ).toEqual([]);
  });
});
