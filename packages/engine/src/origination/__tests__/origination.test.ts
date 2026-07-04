import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, sha256Hex, type DbHandle, type Repos } from "@thalon/db";
import { afterEach, describe, expect, it } from "vitest";
import { runOrigination } from "../origination";
import { pillarScriptDraftMetaSchema } from "../schemas";
import {
  createFakePillarScriptDriver,
  type GeneratePillarScriptRequest,
  type PillarScriptDriver,
} from "../shell/generator";

let handle: DbHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

async function setup(identity?: Record<string, unknown>): Promise<{
  ctx: TenantCtx;
  repos: Repos;
  promptSourceId: string;
  docSourceId: string;
}> {
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
  const { source: promptSource } = await repos.sourceChunks.ingest(ctx, {
    kind: "prompt",
    contentHash: sha256Hex("pillar brief"),
    chunks: [
      {
        seq: 0,
        text: "Make a pillar video introducing what the product does.",
        tokenCount: 10,
        contentHash: sha256Hex("brief-0"),
      },
    ],
  });
  const { source: docSource } = await repos.sourceChunks.ingest(ctx, {
    kind: "doc",
    contentHash: sha256Hex("site facts"),
    chunks: [
      {
        seq: 0,
        text: "The product turns one source into judged platform drafts.",
        tokenCount: 10,
        contentHash: sha256Hex("doc-0"),
      },
    ],
  });
  return { ctx, repos, promptSourceId: promptSource.id, docSourceId: docSource.id };
}

function capturingDriver(captured: GeneratePillarScriptRequest[]): PillarScriptDriver {
  const fake = createFakePillarScriptDriver();
  return (req) => {
    captured.push(req);
    return fake(req);
  };
}

describe("runOrigination (B3.9 end-to-end, keyless + networkless)", () => {
  it("prompt + grounding sources -> ONE pillar_script draft in status generated with the pinned meta contract", async () => {
    const { ctx, repos, promptSourceId, docSourceId } = await setup({ company: "Fernwood" });
    const captured: GeneratePillarScriptRequest[] = [];
    const result = await runOrigination(
      ctx,
      repos,
      { promptSourceId, groundingSourceIds: [docSourceId] },
      { driver: capturingDriver(captured), capTokens: 1_000_000 },
    );

    expect(result.created).toBe(true);
    expect(result.draft.status).toBe("generated");
    expect(result.draft.format).toBe("pillar_script");
    expect(result.draft.platform).toBe("video");
    expect(result.draft.tenantId).toBe(ctx.tenantId);

    const meta = pillarScriptDraftMetaSchema.parse(result.draft.meta);
    expect(meta.groundingSourceIds).toEqual([promptSourceId, docSourceId]);
    expect(meta.promptVersion).toBe("pillar-script-generate.v1");
    expect(meta.brandProfileVersion).toBe(1);
    expect(meta.platformProfileVersion).toBe("pillar.v1");
    expect(meta.beats[0].beatIndex).toBe(0);

    // Body = the claim surface: title + hook + narration lines in order.
    expect(result.draft.body).toContain(meta.title);
    expect(result.draft.body).toContain(meta.hook);
    for (const beat of meta.beats) expect(result.draft.body).toContain(beat.narration);

    // The shell saw the brief, the grounding text, and the identity block.
    expect(captured).toHaveLength(1);
    expect(captured[0].operatorPrompt).toContain("introducing what the product does");
    expect(captured[0].groundingText).toContain("judged platform drafts");
    expect(captured[0].identityBlock).toContain("COMPANY: Fernwood");
  });

  it("is idempotent: an identical re-run returns the original draft with ZERO shell calls", async () => {
    const { ctx, repos, promptSourceId, docSourceId } = await setup();
    const request = { promptSourceId, groundingSourceIds: [docSourceId] };
    const first = await runOrigination(ctx, repos, request, {
      driver: createFakePillarScriptDriver(),
      capTokens: 1_000_000,
    });

    let calls = 0;
    const counting: PillarScriptDriver = (req) => {
      calls++;
      return createFakePillarScriptDriver()(req);
    };
    const second = await runOrigination(ctx, repos, request, {
      driver: counting,
      capTokens: 1_000_000,
    });

    expect(second.created).toBe(false);
    expect(second.runId).toBe(first.runId);
    expect(second.draft.id).toBe(first.draft.id);
    expect(calls).toBe(0);
  });

  it("rejects a non-prompt source as the brief — the operator ask must be a prompt source", async () => {
    const { ctx, repos, docSourceId } = await setup();
    await expect(
      runOrigination(
        ctx,
        repos,
        { promptSourceId: docSourceId },
        { driver: createFakePillarScriptDriver(), capTokens: 1_000_000 },
      ),
    ).rejects.toThrow(/expected "prompt"/);
  });

  it("rejects an unknown grounding source id — loudly, before any shell call", async () => {
    const { ctx, repos, promptSourceId } = await setup();
    await expect(
      runOrigination(
        ctx,
        repos,
        { promptSourceId, groundingSourceIds: ["00000000-0000-0000-0000-000000000000"] },
        { driver: createFakePillarScriptDriver(), capTokens: 1_000_000 },
      ),
    ).rejects.toThrow(/grounding source .* not found/);
  });
});
