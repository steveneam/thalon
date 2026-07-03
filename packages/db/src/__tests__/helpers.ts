import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle } from "../client";
import { sha256Hex } from "../hash";
import type { Draft } from "../types";

export interface Fixture {
  handle: DbHandle;
  ctx: TenantCtx;
  draft: Draft;
  close(): Promise<void>;
}

/** Fresh in-memory db with one tenant, active profile, source, run, and a `generated` draft. */
export async function fixture(): Promise<Fixture> {
  const handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self (dogfood)" });
  const ctx = tenantCtx(tenant.id);
  const profile = await repos.brandProfiles.create(ctx, {
    config: {
      voice: { register: "plain" },
      denylist: ["guaranteed returns"],
      platformProfiles: { alpha: { charLimit: 280 } },
    },
    activate: true,
  });
  const source = await repos.sources.create(ctx, {
    kind: "prompt",
    contentHash: sha256Hex("a launch announcement"),
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
    body: "We shipped a thing today.",
    generationKey: sha256Hex(`${ctx.tenantId}:draft-1`),
  });
  return { handle, ctx, draft, close: () => handle.close() };
}
