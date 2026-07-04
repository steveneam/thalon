import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, sha256Hex, type DbHandle, type Repos } from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import { webPageDraftMetaSchema } from "../schemas";
import {
  createFakeWebPageDriver,
  type GenerateWebPageRequest,
  type WebPageDriver,
} from "../shell/generator";
import { runWebPageGeneration } from "../webpage";

let handle: DbHandle | undefined;
let storeRoot: string | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
  if (storeRoot) {
    rmSync(storeRoot, { recursive: true, force: true });
    storeRoot = undefined;
  }
});

async function setup(identity?: Record<string, unknown>): Promise<{
  ctx: TenantCtx;
  repos: Repos;
  objectStore: LocalObjectStore;
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
    contentHash: sha256Hex("landing brief"),
    chunks: [
      {
        seq: 0,
        text: "Make a landing page introducing what the product does.",
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
  storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-webpage-"));
  return { ctx, repos, objectStore: new LocalObjectStore(storeRoot), promptSourceId: promptSource.id, docSourceId: docSource.id };
}

describe("runWebPageGeneration (B3.15 end-to-end, keyless + networkless)", () => {
  it("prompt + grounding -> ONE web_page draft: pinned meta, content-addressed artifact, body derived from the page", async () => {
    const { ctx, repos, objectStore, promptSourceId, docSourceId } = await setup({
      company: "Fernwood",
    });
    const captured: GenerateWebPageRequest[] = [];
    const fake = createFakeWebPageDriver();
    const driver: WebPageDriver = (req) => {
      captured.push(req);
      return fake(req);
    };

    const result = await runWebPageGeneration(
      ctx,
      repos,
      { promptSourceId, groundingSourceIds: [docSourceId] },
      { driver, capTokens: 1_000_000, objectStore },
    );

    expect(result.created).toBe(true);
    expect(result.draft.status).toBe("generated");
    expect(result.draft.format).toBe("web_page");
    expect(result.draft.platform).toBe("web");

    const meta = webPageDraftMetaSchema.parse(result.draft.meta);
    expect(meta.groundingSourceIds).toEqual([promptSourceId, docSourceId]);
    expect(meta.promptVersion).toBe("web-page-generate.v1");
    expect(meta.platformProfileVersion).toBe("web.v1");
    expect(meta.deployStatus).toBe("drafted");
    expect(meta.deployRef).toBeNull();

    // The artifact is durably in the store, content-addressed to its bytes.
    expect(meta.htmlRef).toMatch(/^web-pages\/[0-9a-f]{64}\.html$/);
    const stored = await objectStore.get(meta.htmlRef);
    expect(stored).not.toBeNull();
    const html = stored!.toString("utf8");
    expect(meta.htmlRef).toBe(`web-pages/${sha256Hex(html)}.html`);

    // Body = the artifact's extracted visible text: page copy present, markup absent.
    expect(result.draft.body).toContain("introducing what the product does");
    expect(result.draft.body).toContain("judged platform drafts");
    expect(result.draft.body).not.toMatch(/<|>/);

    // The shell saw the brief, the grounding text, and the identity block.
    expect(captured).toHaveLength(1);
    expect(captured[0].identityBlock).toContain("COMPANY: Fernwood");
  });

  it("is idempotent: an identical re-run returns the original draft with ZERO shell calls", async () => {
    const { ctx, repos, objectStore, promptSourceId, docSourceId } = await setup();
    const request = { promptSourceId, groundingSourceIds: [docSourceId] };
    const first = await runWebPageGeneration(ctx, repos, request, {
      driver: createFakeWebPageDriver(),
      capTokens: 1_000_000,
      objectStore,
    });

    let calls = 0;
    const counting: WebPageDriver = (req) => {
      calls++;
      return createFakeWebPageDriver()(req);
    };
    const second = await runWebPageGeneration(ctx, repos, request, {
      driver: counting,
      capTokens: 1_000_000,
      objectStore,
    });

    expect(second.created).toBe(false);
    expect(second.runId).toBe(first.runId);
    expect(second.draft.id).toBe(first.draft.id);
    expect(calls).toBe(0);
  });

  it("rejects a non-prompt source as the brief", async () => {
    const { ctx, repos, objectStore, docSourceId } = await setup();
    await expect(
      runWebPageGeneration(
        ctx,
        repos,
        { promptSourceId: docSourceId },
        { driver: createFakeWebPageDriver(), capTokens: 1_000_000, objectStore },
      ),
    ).rejects.toThrow(/expected "prompt"/);
  });

  it("exhausts the repair loop and fails loudly when the shell keeps emitting a non-self-contained page", async () => {
    const { ctx, repos, objectStore, promptSourceId } = await setup();
    let calls = 0;
    const leakyDriver: WebPageDriver = async () => {
      calls++;
      return {
        candidate: {
          title: "t",
          description: "d",
          html: '<html><body><script src="https://evil.test/x.js"></script><p>hi</p></body></html>',
        },
        tokensIn: 1,
        tokensOut: 1,
      };
    };
    await expect(
      runWebPageGeneration(
        ctx,
        repos,
        { promptSourceId },
        { driver: leakyDriver, capTokens: 1_000_000, objectStore },
      ),
    ).rejects.toThrow(/irrecoverable after 3 attempt\(s\).*no <script>/s);
    expect(calls).toBe(3); // every structural violation consumed one repair attempt
    // Nothing was ever persisted for the failed generation.
    expect(await objectStore.list("web-pages/")).toEqual([]);
  });
});
