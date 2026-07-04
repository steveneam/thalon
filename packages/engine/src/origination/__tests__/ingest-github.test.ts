import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import type { Fetcher } from "../../ingest/fetcher";
import { createFakeEmbeddingDriver, type EmbeddingDriver } from "../../ingest/shell/embedder";
import { ingestGithubReadme } from "../ingest-github";

class FixtureFetcher implements Fetcher {
  constructor(private readonly pages: Record<string, string>) {}

  async fetch(url: string) {
    const html = this.pages[url];
    if (html === undefined) throw new Error(`no fixture registered for "${url}"`);
    return { html };
  }
}

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

async function setup(): Promise<{
  ctx: TenantCtx;
  repos: Repos;
  objectStore: LocalObjectStore;
  embedder: EmbeddingDriver;
}> {
  handle = await openTestDb();
  const tenant = await handle.repos.tenants.create({ slug: "self", name: "Self" });
  const ctx = tenantCtx(tenant.id);
  storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-github-"));
  const objectStore = new LocalObjectStore(storeRoot);
  const embedder = createFakeEmbeddingDriver(1536);
  return { ctx, repos: handle.repos, objectStore, embedder };
}

const README_TEXT = "# Demo Tool\n\nA tool that does one demonstrable thing, documented plainly.";
const README_JSON = JSON.stringify({
  content: Buffer.from(README_TEXT, "utf8").toString("base64"),
  encoding: "base64",
});

describe("ingestGithubReadme (B3.9, keyless + networkless)", () => {
  it("fetches the official readme endpoint and lands a doc source with the decoded text", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    const fetcher = new FixtureFetcher({
      "https://api.github.com/repos/acme/demo-tool/readme": README_JSON,
    });
    const result = await ingestGithubReadme(
      ctx,
      repos,
      { repo: "acme/demo-tool" },
      { fetcher, embedder, objectStore, capTokens: 1_000_000 },
    );

    expect(result.created).toBe(true);
    const source = await repos.sources.get(ctx, result.sourceId);
    expect(source?.kind).toBe("doc");
    const chunks = await repos.sourceChunks.listBySource(ctx, result.sourceId);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.map((c) => c.text).join(" ")).toContain("one demonstrable thing");
  });

  it("rejects a malformed repo identifier before any network call", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    const fetcher = new FixtureFetcher({});
    await expect(
      ingestGithubReadme(
        ctx,
        repos,
        { repo: "not a repo" },
        { fetcher, embedder, objectStore, capTokens: 1_000_000 },
      ),
    ).rejects.toThrow(/invalid GitHub repo/);
  });

  it("fails loudly on an unexpected endpoint shape (private repo / API change)", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    const fetcher = new FixtureFetcher({
      "https://api.github.com/repos/acme/private/readme": JSON.stringify({ message: "Not Found" }),
    });
    await expect(
      ingestGithubReadme(
        ctx,
        repos,
        { repo: "acme/private" },
        { fetcher, embedder, objectStore, capTokens: 1_000_000 },
      ),
    ).rejects.toThrow(/unexpected shape/);
  });
});
