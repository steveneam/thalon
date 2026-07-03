import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, sha256Hex, type DbHandle, type Draft, type FanoutRun } from "@thalon/db";

export interface Seeded {
  handle: DbHandle;
  ctx: TenantCtx;
  run: FanoutRun;
  draft: Draft;
  close(): Promise<void>;
}

let seq = 0;

/** Fresh in-memory db (the B0.4 test pattern) with one tenant, active profile, source, run, and a `generated` draft. */
export async function seedDraft(overrides: { platform?: string; body?: string } = {}): Promise<Seeded> {
  const handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self (dogfood)" });
  const ctx = tenantCtx(tenant.id);
  await repos.brandProfiles.create(ctx, {
    config: { voice: {}, denylist: [], platformProfiles: {} },
    activate: true,
  });
  const { run, draft } = await seedAdditionalRun(handle, ctx, overrides);
  return { handle, ctx, run, draft, close: () => handle.close() };
}

/** Adds another fan-out run + draft to an already-seeded fixture, reusing its active brand profile. */
export async function seedAdditionalRun(
  handle: DbHandle,
  ctx: TenantCtx,
  overrides: { platform?: string; body?: string } = {},
): Promise<{ run: FanoutRun; draft: Draft }> {
  const { repos } = handle;
  const profile = await repos.brandProfiles.getActive(ctx);
  if (!profile) throw new Error("seedAdditionalRun requires an active brand profile");
  const n = ++seq;
  const platform = overrides.platform ?? "linkedin";
  const source = await repos.sources.create(ctx, { kind: "prompt", contentHash: sha256Hex(`source-${n}`) });
  const run = await repos.fanoutRuns.create(ctx, {
    sourceId: source.id,
    brandProfileId: profile.id,
    brandProfileVersion: profile.version,
    platforms: [platform],
    promptVersion: "fanout.v1",
    model: "test/model",
    generationKey: sha256Hex(`${ctx.tenantId}:run:${n}`),
  });
  const draft = await repos.drafts.create(ctx, {
    fanoutRunId: run.id,
    sourceId: source.id,
    platform,
    body: overrides.body ?? "We shipped a thing today.",
    generationKey: sha256Hex(`${ctx.tenantId}:draft:${n}`),
  });
  return { run, draft };
}
