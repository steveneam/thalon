import { tenantCtx, type CadenceConfig, type TenantCtx } from "@thalon/contracts";
import { openTestDb, sha256Hex, type DbHandle, type Draft } from "@thalon/db";

export interface JudgeFixture {
  handle: DbHandle;
  ctx: TenantCtx;
  draft: Draft;
  /** B7.a: cadence tests judge several drafts in sequence — extra drafts ride the fixture's run. */
  addDraft(opts?: { platform?: string; body?: string }): Promise<Draft>;
  close(): Promise<void>;
}

export interface JudgeFixtureOpts {
  denylist?: string[];
  body?: string;
  tenantSlug?: string;
  /** B3.8: identity on the tenant's active profile — the pipeline appends it as a grounding chunk. */
  identity?: Record<string, unknown>;
  /** B6.8: draft format + meta (the SEO/AEO lens reads `meta.seo` on seoMeta-capable formats). */
  format?: string;
  meta?: Record<string, unknown>;
  /** B7.a: per-platform cadence rules on the tenant's active profile (contracts cadenceConfigSchema). */
  cadence?: CadenceConfig;
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
      ...(opts.identity ? { identity: opts.identity } : {}),
      ...(opts.cadence ? { cadence: opts.cadence } : {}),
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
    ...(opts.format ? { format: opts.format } : {}),
    ...(opts.meta ? { meta: opts.meta } : {}),
  });
  let extraDrafts = 0;
  const addDraft = (extra: { platform?: string; body?: string } = {}) => {
    extraDrafts++;
    return repos.drafts.create(ctx, {
      fanoutRunId: run.id,
      sourceId: source.id,
      platform: extra.platform ?? "alpha",
      body: extra.body ?? `Another thing shipped (${extraDrafts}).`,
      generationKey: sha256Hex(`${ctx.tenantId}:draft-extra-${extraDrafts}`),
    });
  };
  return { handle, ctx, draft, addDraft, close: () => handle.close() };
}
