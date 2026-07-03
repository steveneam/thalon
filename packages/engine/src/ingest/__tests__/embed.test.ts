import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { BudgetExceededError, openTestDb, sha256Hex, type DbHandle, type Repos } from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import { embedChunks } from "../embed";
import { createFakeEmbeddingDriver, type EmbeddingDriver } from "../shell/embedder";

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

async function setup(): Promise<{ ctx: TenantCtx; repos: Repos; store: LocalObjectStore }> {
  handle = await openTestDb();
  const tenant = await handle.repos.tenants.create({ slug: "self", name: "Self" });
  const ctx = tenantCtx(tenant.id);
  storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-embed-"));
  const store = new LocalObjectStore(storeRoot);
  return { ctx, repos: handle.repos, store };
}

describe("embedChunks (the B1.1 gateway choke-point caller)", () => {
  it("cache hit skips the driver entirely", async () => {
    const { ctx, repos, store } = await setup();
    let calls = 0;
    const fake = createFakeEmbeddingDriver(8);
    const countingDriver: EmbeddingDriver = {
      model: fake.model,
      embed: (texts) => {
        calls += 1;
        return fake.embed(texts);
      },
    };
    const chunk = {
      seq: 0,
      tokenCount: 2,
      contentHash: sha256Hex("hello world"),
      text: "hello world",
    };

    const first = await embedChunks(
      ctx,
      repos,
      { chunks: [chunk], model: "test/model", capTokens: 1_000_000 },
      { driver: countingDriver, objectStore: store },
    );
    expect(calls).toBe(1);
    expect(first[0].cacheHit).toBe(false);

    const second = await embedChunks(
      ctx,
      repos,
      { chunks: [chunk], model: "test/model", capTokens: 1_000_000 },
      { driver: countingDriver, objectStore: store },
    );
    expect(calls).toBe(1);
    expect(second[0].cacheHit).toBe(true);
    expect(second[0].embedding).toEqual(first[0].embedding);
  });

  it("hard-stops at the tenant daily budget cap and never silently degrades", async () => {
    const { ctx, repos, store } = await setup();
    const chunk = {
      seq: 0,
      tokenCount: 2,
      contentHash: sha256Hex("over budget"),
      text: "over budget",
    };

    await expect(
      embedChunks(
        ctx,
        repos,
        { chunks: [chunk], model: "test/model", capTokens: 0 },
        { driver: createFakeEmbeddingDriver(8), objectStore: store },
      ),
    ).rejects.toThrow(BudgetExceededError);

    const events = await repos.events.list(ctx, { entityType: "tenant" });
    expect(events.map((e) => e.event)).toContain("budget.exceeded");
  });
});
