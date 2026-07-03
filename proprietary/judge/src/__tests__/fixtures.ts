import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, sha256Hex, type DbHandle, type Draft } from "@thalon/db";

export interface JudgeFixture {
  handle: DbHandle;
  ctx: TenantCtx;
  draft: Draft;
  close(): Promise<void>;
}

export interface JudgeFixtureOpts {
  denylist?: string[];
  body?: string;
  tenantSlug?: string;
}

/** Fresh in-memory db, one tenant with a configurable denylist profile, one `generated` draft. */
export async function judgeFixture(opts: JudgeFixtureOpts = {}): Promise<JudgeFixture> {
  const handle = await openTestDb();
  const { repos } = handle;
  const slug = opts.tenantSlug ?? "self";
  const tenant = await repos.tenants.create({ slug, name: `Tenant ${slug}` });
  const ctx = tenantCtx(tenant.id);
  const profile = await repos.brandProfiles.create(ctx, {
    config: {
      voice: { register: "plain" },
      denylist: opts.denylist ?? [],
      platformProfiles: { alpha: { charLimit: 280 } },
    },
    activate: true,
  });
  const source = await repos.sources.create(ctx, {
    kind: "prompt",
    contentHash: sha256Hex(`${slug}-source`),
  });
  const run = await repos.fanoutRuns.create(ctx, {
    sourceId: source.id,
    brandProfileId: profile.id,
    brandProfileVersion: profile.version,
    platforms: ["alpha"],
    promptVersion: "fanout.v1",
    model: "test/model",
    generationKey: sha256Hex(`${ctx.tenantId}:run-1`),
  });
  const draft = await repos.drafts.create(ctx, {
    fanoutRunId: run.id,
    sourceId: source.id,
    platform: "alpha",
    body: opts.body ?? "We shipped a thing today.",
    generationKey: sha256Hex(`${ctx.tenantId}:draft-1`),
  });
  return { handle, ctx, draft, close: () => handle.close() };
}
