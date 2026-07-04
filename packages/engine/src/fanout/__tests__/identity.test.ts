import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, sha256Hex, type DbHandle, type Repos } from "@thalon/db";
import { afterEach, describe, expect, it } from "vitest";
import { runFanout } from "../fanout";
import {
  createFakeDraftGeneratorDriver,
  type DraftGeneratorDriver,
  type GenerateDraftRequest,
} from "../shell/generator";

let handle: DbHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

async function setup(
  identity?: Record<string, unknown>,
): Promise<{ ctx: TenantCtx; repos: Repos; sourceId: string }> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self (dogfood)" });
  const ctx = tenantCtx(tenant.id);
  await repos.brandProfiles.create(ctx, {
    config: {
      voice: { register: "plain" },
      denylist: [],
      platformProfiles: {},
      ...(identity ? { identity } : {}),
    },
    activate: true,
  });
  const { source } = await repos.sourceChunks.ingest(ctx, {
    kind: "prompt",
    contentHash: sha256Hex("a launch announcement"),
    chunks: [
      {
        seq: 0,
        text: "We shipped a major feature today.",
        tokenCount: 6,
        contentHash: sha256Hex("chunk-0"),
      },
    ],
  });
  return { ctx, repos, sourceId: source.id };
}

function capturingDriver(captured: GenerateDraftRequest[]): DraftGeneratorDriver {
  const fake = createFakeDraftGeneratorDriver();
  return (req) => {
    captured.push(req);
    return fake(req);
  };
}

describe("fan-out identity threading (B3.8, keyless + networkless)", () => {
  it("the active profile's identity rides along automatically — rendered block in the request, prompt version in draft meta", async () => {
    const { ctx, repos, sourceId } = await setup({
      company: "Fernwood Outfitters",
      oneLiner: "A fictional gear shop.",
      facts: ["Family-run shop."],
    });
    const captured: GenerateDraftRequest[] = [];
    const result = await runFanout(
      ctx,
      repos,
      { sourceId, platforms: ["linkedin"] },
      { driver: capturingDriver(captured), capTokens: 1_000_000 },
    );

    expect(captured).toHaveLength(1);
    expect(captured[0].identityBlock).toBe(
      [
        "COMPANY: Fernwood Outfitters",
        "WHAT IT DOES: A fictional gear shop.",
        "FACTS:",
        "- Family-run shop.",
      ].join("\n"),
    );
    const meta = result.drafts[0].meta as Record<string, unknown>;
    expect(meta.identityPromptVersion).toBe("fanout-identity-context.v1");
  });

  it("an identity-less profile threads nothing — request and meta stay byte-identical to pre-B3.8", async () => {
    const { ctx, repos, sourceId } = await setup();
    const captured: GenerateDraftRequest[] = [];
    const result = await runFanout(
      ctx,
      repos,
      { sourceId, platforms: ["linkedin"] },
      { driver: capturingDriver(captured), capTokens: 1_000_000 },
    );

    expect(captured).toHaveLength(1);
    expect(captured[0].identityBlock).toBeUndefined();
    const meta = result.drafts[0].meta as Record<string, unknown>;
    expect(meta.identityPromptVersion).toBeUndefined();
  });

  it("identity round-trips through the versioned profile store (create → getActive → fan-out)", async () => {
    const { ctx, repos } = await setup({ company: "Fernwood" });
    const active = await repos.brandProfiles.getActive(ctx);
    expect(active?.identity).toMatchObject({ company: "Fernwood" });
    expect(active?.version).toBe(1);
  });
});
