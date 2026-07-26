import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { BudgetExceededError, llmCacheKey, openTestDb, sha256Hex, type DbHandle, type Repos } from "@thalon/db";
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
  /**
   * A DANGLING CACHE POINTER IS A MISS, NOT A DEAD END (s79, founder-found).
   *
   * `llm_cache` holds a pointer; the object store holds the truth. They diverge
   * for ordinary reasons — `THALON_DATA_DIR` is relative, so the store root
   * follows the process's working directory, and the dev server (cwd
   * `apps/web`) shared one cache index with every root-cwd test, script and
   * eval run while writing to a DIFFERENT store. The old code threw, which made
   * the breakage permanent: the row survives, so each retry hit the same dead
   * pointer and video ingest stayed broken forever.
   *
   * The founder found it by pasting a YouTube URL and asking whether
   * transcription still worked. The transcript was fine; this was the failure.
   */
  it("treats a cache row whose object has vanished as a MISS, and heals the row", async () => {
    const { ctx, repos, store } = await setup();
    const fake = createFakeEmbeddingDriver(8);
    let calls = 0;
    const countingDriver: EmbeddingDriver = {
      model: fake.model,
      embed: (texts) => {
        calls += 1;
        return fake.embed(texts);
      },
    };
    const chunk = {
      seq: 0,
      tokenCount: 3,
      contentHash: sha256Hex("vanishing act"),
      text: "vanishing act",
    };
    const input = { chunks: [chunk], model: "test/model", capTokens: 1_000_000 };

    const first = await embedChunks(ctx, repos, input, { driver: countingDriver, objectStore: store });
    expect(first[0].cacheHit).toBe(false);
    expect(calls).toBe(1);

    // Lose the object, keep the row — exactly the live state on dev.
    const rowKey = llmCacheKey({
      promptVersion: "embedding.v1",
      model: "test/model",
      params: {},
      inputHash: chunk.contentHash,
    });
    const row = await repos.caches.llm.get(rowKey);
    expect(row).not.toBeNull();
    rmSync(path.join(storeRoot!, row!.valueRef), { force: true });
    expect(await store.get(row!.valueRef)).toBeNull();

    const dangling: { key: string; valueRef: string }[] = [];
    const second = await embedChunks(ctx, repos, input, {
      driver: countingDriver,
      objectStore: store,
      onCacheDangling: (info) => dangling.push(info),
    });

    // Re-embedded rather than thrown, and reported rather than swallowed.
    expect(second[0].cacheHit).toBe(false);
    expect(second[0].embedding).toHaveLength(8);
    expect(calls).toBe(2);
    expect(dangling).toEqual([{ key: rowKey, valueRef: row!.valueRef }]);

    // HEALED: the next call is a real hit again, with no driver traffic.
    const third = await embedChunks(ctx, repos, input, { driver: countingDriver, objectStore: store });
    expect(third[0].cacheHit).toBe(true);
    expect(calls).toBe(2);
  });
});
