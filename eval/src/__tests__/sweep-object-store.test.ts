import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx } from "@thalon/contracts";
import { openTestDb, sha256Hex, type DbHandle } from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import { sweepObjectStore } from "../sweep-object-store";

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

describe("object-store orphan sweep (B4.6)", () => {
  it("keeps db-referenced refs + protected cache keys, reports orphans on dry-run, deletes only with --delete", async () => {
    handle = await openTestDb();
    const { repos } = handle;
    storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-sweep-"));
    const store = new LocalObjectStore(storeRoot);

    const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
    const ctx = tenantCtx(tenant.id);
    const profile = await repos.brandProfiles.create(ctx, {
      config: { voice: {}, denylist: [], platformProfiles: {} },
      activate: true,
    });

    // Referenced: a crawl source's rawRef and a web_page draft's htmlRef.
    const rawRef = `crawl-pages/${sha256Hex("crawl")}.json`;
    await store.put(rawRef, "[]");
    const source = await repos.sources.create(ctx, {
      kind: "site_crawl",
      contentHash: sha256Hex("crawl"),
      rawRef,
    });
    const html = "<html>ok</html>";
    const htmlRef = `web-pages/${sha256Hex(html)}.html`;
    await store.put(htmlRef, html);
    const run = await repos.fanoutRuns.create(ctx, {
      sourceId: source.id,
      brandProfileId: profile.id,
      brandProfileVersion: profile.version,
      platforms: ["web"],
      promptVersion: "v1",
      model: "test/model",
      generationKey: `${ctx.tenantId}:sweep-run`,
    });
    await repos.drafts.create(ctx, {
      fanoutRunId: run.id,
      sourceId: source.id,
      platform: "web",
      body: "ok",
      format: "web_page",
      generationKey: `${ctx.tenantId}:sweep-draft`,
      meta: {
        title: "T",
        description: "D",
        htmlRef,
        groundingSourceIds: [source.id],
        promptVersion: "v1",
        brandProfileVersion: profile.version,
        platformProfileVersion: "web.v1",
      },
    });

    // Unreferenced orphan + a protected cache key.
    await store.put("web-pages/0000.html", "<html>orphan</html>");
    await store.put("embeddings/somekey.json", "[]");

    const dryRun = await sweepObjectStore(repos, store);
    expect(dryRun.orphans).toEqual(["web-pages/0000.html"]);
    expect(dryRun.deleted).toBe(0);
    expect(await store.get("web-pages/0000.html")).not.toBeNull();

    const wet = await sweepObjectStore(repos, store, { deleteOrphans: true });
    expect(wet.deleted).toBe(1);
    expect(await store.get("web-pages/0000.html")).toBeNull();
    expect(await store.get(htmlRef)).not.toBeNull();
    expect(await store.get(rawRef)).not.toBeNull();
    expect(await store.get("embeddings/somekey.json")).not.toBeNull();
  });
});
