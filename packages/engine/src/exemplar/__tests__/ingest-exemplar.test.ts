import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { LocalObjectStore } from "@thalon/platform";
import { afterEach, describe, expect, it } from "vitest";
import { createFakeEmbeddingDriver, type EmbeddingDriver } from "../../ingest/shell/embedder";
import { ingestExemplar } from "../ingest-exemplar";

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
  storeRoot = mkdtempSync(path.join(tmpdir(), "thalon-ingest-exemplar-"));
  const objectStore = new LocalObjectStore(storeRoot);
  const embedder = createFakeEmbeddingDriver(1536);
  return { ctx, repos: handle.repos, objectStore, embedder };
}

describe("ingestExemplar (B2.4 end-to-end, keyless + networkless)", () => {
  it("strips PII BEFORE storing or embedding — the persisted chunk never carries the raw email/phone", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    const result = await ingestExemplar(
      ctx,
      repos,
      {
        kind: "exemplar",
        text: "Great post! Reach out to jane@example.com or 555-123-4567 for a repost.".repeat(5),
      },
      { embedder, objectStore, capTokens: 1_000_000 },
    );
    expect(result.created).toBe(true);
    expect(result.redactions.emails).toBeGreaterThan(0);
    expect(result.redactions.phones).toBeGreaterThan(0);

    const source = await repos.sources.get(ctx, result.sourceId);
    expect(source?.kind).toBe("exemplar");
    expect((source?.meta as Record<string, unknown>).piiRedactions).toEqual(result.redactions);

    const chunks = await repos.sourceChunks.listBySource(ctx, result.sourceId);
    for (const chunk of chunks) {
      expect(chunk.text).not.toContain("jane@example.com");
      expect(chunk.text).not.toContain("555-123-4567");
    }
  });

  it("persists voice_sample sources under that kind", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    const result = await ingestExemplar(
      ctx,
      repos,
      { kind: "voice_sample", text: "This is how we talk to our customers, plainly and warmly." },
      { embedder, objectStore, capTokens: 1_000_000 },
    );
    const source = await repos.sources.get(ctx, result.sourceId);
    expect(source?.kind).toBe("voice_sample");
  });

  it("is idempotent on the PII-STRIPPED content hash: re-ingesting the same raw text does not duplicate rows or re-embed", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    const text = "Reach jane@example.com about this great result.";
    const first = await ingestExemplar(
      ctx,
      repos,
      { kind: "exemplar", text },
      { embedder, objectStore, capTokens: 1_000_000 },
    );
    const second = await ingestExemplar(
      ctx,
      repos,
      { kind: "exemplar", text },
      { embedder, objectStore, capTokens: 1_000_000 },
    );
    expect(second.sourceId).toBe(first.sourceId);
    expect(second.created).toBe(false);
    const chunks = await repos.sourceChunks.listBySource(ctx, first.sourceId);
    expect(chunks).toHaveLength(first.chunkCount);
  });

  it("attaches generic per-source metrics via source_metrics, even on a repeat (idempotent-content) ingest", async () => {
    const { ctx, repos, objectStore, embedder } = await setup();
    const text = "A high-performing post about our new gear.";
    const first = await ingestExemplar(
      ctx,
      repos,
      { kind: "exemplar", text, metrics: [{ name: "likes", value: 120 }] },
      { embedder, objectStore, capTokens: 1_000_000 },
    );
    await ingestExemplar(
      ctx,
      repos,
      { kind: "exemplar", text, metrics: [{ name: "likes", value: 150 }] },
      { embedder, objectStore, capTokens: 1_000_000 },
    );
    const metrics = await repos.sourceMetrics.listBySource(ctx, first.sourceId);
    expect(metrics.map((m) => m.metricValue)).toEqual([120, 150]);
    expect(metrics.every((m) => m.metricName === "likes")).toBe(true);
  });
});
